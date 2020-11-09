const {wait} = require('../modules/Helpers');
const {getDb} = require('../modules/Database');
const moment = require('moment');

module.exports = class Sender {

    constructor(mailingId, collection, telegram) {
        this.id = mailingId;
        this.collection = collection;
        this.chunkSize = 5;
        this.telegram = telegram;
    }

    async init() {
        await this.loadMailing();
        return this;
    }

    async loadMailing() {
        this.mailing = await this.collection.findOne({id: this.id});
    }

    getNextChats() {
        return this.mailing.chats.splice(0, this.chunkSize);
    }

    getText() {
        return this.mailing.text;
    }

    async sendNextChunk() {
        let sendPromises = this.getNextChats().map( chatId => this.sendMailingToChat(chatId) );
        return Promise.all(sendPromises);
    }

    setChatBlock(chatId) {
        if (!this.mailing.blocked) {
            this.mailing.blocked = [];
        }

        this.mailing.blocked.push(chatId);
    }

    setChatFailed(chatId) {
        if (!this.mailing.failed) {
            this.mailing.failed = [];
        }

        this.mailing.failed.push(chatId);
    }

    setChatFinished(chatId) {
        if (!this.mailing.finished) {
            this.mailing.finished = [];
        }

        this.mailing.finished.push(chatId);
    }

    async sendMailingToChat(chatId) {
        let response = false;
        let options = {};

        try {
            response = await this.telegram.sendMessage(chatId, this.getText(), options);
            this.setChatFinished(chatId);
        }
        catch (sendError) {
            if (sendError && sendError.code) {
                if (sendError.code === 403) {
                    this.setChatBlock(chatId);
                    return false;
                }

                if (sendError.code === 429) {
                    let waitTimeMs = sendError.parameters && sendError.parameters.retry_after
                        ? (sendError.parameters.retry_after || 1) * 1000
                        : 1000;

                    await wait(waitTimeMs);
                    return this.sendMailingToChat(chatId);
                }

                this.setChatFailed(chatId);
                return false;
            }
        }

        return response;
    }

    async saveMailingState() {
        const db = await getDb();
        const mailings = db.collection('mailings');

        if (!this.mailing.id) {
            this.mailing.id = shortid.generate();
        }

        if (this.mailing._id) {
            delete this.mailing['_id'];
        }

        let updateResult = await mailings.findOneAndReplace({id: this.mailing.id}, this.mailing, {upsert: true, returnOriginal: false});
        return updateResult.value || false;
    }

    initProgress() {
        if (!this.mailing.total) {
            this.mailing.total = this.mailing.chats.length;
        }
    }

    updateProgress() {
        let finishedCount = this.mailing.finished ? this.mailing.finished.length : 0;
        this.mailing.progress = this.mailing.total ? finishedCount / this.mailing.total : 0;
    }

    async startSending() {
        this.mailing.dateStarted = moment().unix();
        this.initProgress();

        while (!this.isFinished()) {
            await this.sendNextChunk();
            this.updateProgress();
            await this.saveMailingState();
        }

        this.mailing.dateFinished = moment().unix();
        await this.saveMailingState();
    }

    isFinished() {
        return this.mailing.chats.length === 0;
    }
}