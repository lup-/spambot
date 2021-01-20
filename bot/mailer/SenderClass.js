const Telegram = require('telegraf/telegram');
const Markup = require('telegraf/markup');
const imgbbUploader = require('imgbb-uploader');
const tempWrite = require('temp-write');
const fs = require('fs');

const {wait} = require('../modules/Helpers');
const {getDb} = require('../modules/Database');
const {escapeHTML} = require('../bots/helpers/common');
const config = require('../../backend/config');
const moment = require('moment');

const MAILING_DB_NAME = 'botofarmer';

const TEST_QUEUE_SIZE = 13000;
const TEST_BOT_ID = 'mailer_bot';
const MAILER_BOT_ID = TEST_BOT_ID;
const TEST_CHAT_ID = 483896081;
const TEST_USER_ID = 483896081;

const STATUS_NEW = 'new';
const STATUS_BLOCKED = 'blocked';
const STATUS_FAILED = 'failed';
const STATUS_FINISHED = 'sent';
const STATUS_VIEWED = 'read';
const STATUSES_SUCCESS = [STATUS_FINISHED, STATUS_VIEWED];
const STATUSES_FAILED = [STATUS_BLOCKED, STATUS_FAILED];
const STATUSES_PROCESSED = [STATUS_FINISHED, STATUS_VIEWED, STATUS_BLOCKED, STATUS_FAILED];

const MAILING_STATUS_NEW = 'new';
const MAILING_STATUS_PROCESSING = 'processing';
const MAILING_STATUS_PAUSED = 'paused';
const MAILING_STATUS_FINISHED = 'finished';

const IMGBB_TOKEN = process.env.IMGBB_TOKEN;

const API_ROOT = process.env.TGAPI_ROOT || 'https://api.telegram.org'

class Sender {
    constructor(mailingId = false, test = false) {
        this.id = mailingId;
        this.chunkSize = 5;
        this.bots = false;
        this.isTest = test;
        this.stop = false;
        this.stopResolve = false;
    }

    async init(mailing = false) {
        if (mailing) {
            this.mailing = mailing;
        }
        else {
            await this.loadMailing();
        }
        return this;
    }

    getTelegram(token) {
        return new Telegram(token, {apiRoot: API_ROOT});
    }

    makeTestQueue() {
        if (!this.id) {
            return false;
        }

        return Array(TEST_QUEUE_SIZE).fill(false).map(_ => ({
            mailing: this.id,
            bot: TEST_BOT_ID,
            userId: TEST_USER_ID,
            chatId: TEST_CHAT_ID,
            status: STATUS_NEW
        }));
    }

    async makeQueue() {
        if (this.isTest) {
            return this.makeTestQueue();
        }

        let bots = await this.getBots();
        let hasTarget = this.mailing.target && this.mailing.target.length > 0;
        let cmpToMongo = {'>': '$gt', '<': '$lt', '=': '$eq', '!=': '$ne'};

        if (hasTarget) {
            let targetBotIds = this.mailing.target.reduce((bots, target) => {
                if (target.type === 'bots') {
                    if (!bots) {
                        bots = [];
                    }

                    bots = bots.concat(target.value).filter((botId, index, allBots) => allBots.indexOf(botId) === index);
                }

                return bots;
            }, false);

            if (targetBotIds) {
                bots = bots.filter(bot => targetBotIds.indexOf(bot.id) !== -1);
            }

        }

        let queue = [];
        for (const bot of bots) {
            let db = await getDb(bot.dbName);
            let matchConditions = [];
            let queueIsEmpty = false;

            if (hasTarget) {
                for (const target of this.mailing.target) {
                    let mongoCmp = {};
                    if (target.type !== 'bots' && target.cmp) {
                        mongoCmp[ cmpToMongo[target.cmp] ] = moment(target.value).unix();
                    }

                    if (target.type === 'activity') {
                        let activityCount = await db.collection('activity').countDocuments();
                        let hasActivity = activityCount > 0;

                        if (hasActivity) {
                            let activeUsers = await db.collection('activity').aggregate([
                                {$match: {date: mongoCmp}},
                                {$group: {"_id": "$userId"}}
                            ]).toArray();

                            let hasActiveUsersInPeriod = activeUsers && activeUsers.length > 0;
                            if (!hasActiveUsersInPeriod) {
                                queueIsEmpty = true;
                                break;
                            }

                            let activeUsersIds = activeUsers.map(user => user._id);
                            matchConditions.push({id: {$in: activeUsersIds}});
                        }
                    }

                    if (target.type === 'register') {
                        matchConditions.push({registered: mongoCmp});
                    }

                    if (target.type === 'mailing') {
                        let mailingDb = await getDb(MAILING_DB_NAME);
                        let mailingUsers = await mailingDb.collection('mailingQueue').aggregate([
                            {$match: {sentAt: mongoCmp, status: {$in: STATUSES_SUCCESS, bot: bot.id}}},
                            {$group: {"_id": "$userId"}}
                        ]).toArray();

                        let hasMailingUsersInPeriod = mailingUsers && mailingUsers.length > 0;
                        if (!hasMailingUsersInPeriod) {
                            queueIsEmpty = true;
                            break;
                        }

                        let mailingUsersIds = mailingUsers.map(user => user._id);
                        matchConditions.push({id: {$in: mailingUsersIds}});
                    }
                }
            }

            if (!queueIsEmpty) {
                let pipe = matchConditions.map(cond => ({'$match': cond}));
                let foundUsers = await db.collection('users').aggregate(pipe).toArray();
                queue = queue.concat(foundUsers.map(user => ({
                    mailing: this.id,
                    bot: bot.id,
                    userId: user.user.id,
                    chatId: user.chat.id,
                    status: STATUS_NEW
                })));
            }
        }

        return queue;
    }

    async initQueue() {
        if (!this.id) {
            return false;
        }

        let mailingDb = await getDb(MAILING_DB_NAME);
        let queueCount = await mailingDb.collection('mailingQueue').countDocuments({mailing: this.id});
        if (queueCount > 0) {
            return;
        }

        let queue = await this.makeQueue();

        if (queue.length > 0) {
            let result = await mailingDb.collection('mailingQueue').insertMany(queue);
            return result && result.result && result.result.ok;
        }

        return false;
    }

    async loadMailing() {
        let db = await getDb(MAILING_DB_NAME);
        this.mailing = await db.collection('mailings').findOne({id: this.id});
    }

    async getBots() {
        if (this.bots) {
            return this.bots;
        }

        this.bots = await config.botList();
        return this.bots;
    }

    async getBot(botId) {
        let bots = await this.getBots();
        return bots.find(bot => bot.id === botId);
    }

    async getNextChats(chunkSize = false) {
        if (!chunkSize) {
            chunkSize = this.chunkSize;
        }
        let db = await getDb(MAILING_DB_NAME);
        let chats = await db.collection('mailingQueue').find({
            mailing: this.id,
            status: STATUS_NEW,
        }).limit(chunkSize).toArray();
        return chats;
    }

    getMessage() {
        let rawHTML = this.mailing.text;
        return escapeHTML(rawHTML);
    }

    getExtra() {
        let extra = {};
        if (this.mailing.buttons && this.mailing.buttons.length > 0) {
            let buttons = this.mailing.buttons.map(button => Markup.urlButton(button.text, button.link));
            extra = Markup.inlineKeyboard(buttons).extra();
        }

        extra.parse_mode = 'HTML';
        return extra;
    }

    async sendNextChunk(chunkSize = false) {
        let chats = await this.getNextChats(chunkSize);
        let sendPromises = chats.map( chat => this.sendMailingToChat(chat) );
        return Promise.all(sendPromises);
    }

    async setChatBlock(chat) {
        if (!chat._id) {
            return false;
        }

        let db = await getDb(MAILING_DB_NAME);
        return db.collection('mailingQueue').updateOne({_id: chat._id}, {$set: {status: STATUS_BLOCKED}});
    }

    async setChatFailed(chat, error) {
        if (!chat._id) {
            return false;
        }

        let db = await getDb(MAILING_DB_NAME);
        return db.collection('mailingQueue').updateOne({_id: chat._id}, {$set: {status: STATUS_FAILED, error}});
    }

    async setChatFinished(chat, messageId) {
        if (!chat._id) {
            return false;
        }

        let db = await getDb(MAILING_DB_NAME);
        return db.collection('mailingQueue').updateOne({_id: chat._id}, {$set: {status: STATUS_FINISHED, messageId}});
    }

    dataUriToBuffer(uri) {
        let data = uri.split(',')[1];
        return Buffer.from(data,'base64');
    }

    async uploadImage(imageBuffer) {
        let uploadedImage = false;

        try {
            const imagePath = tempWrite.sync(imageBuffer);
            uploadedImage = await imgbbUploader(IMGBB_TOKEN, imagePath);
            fs.unlinkSync(imagePath);
        }
        catch (e) {
            throw e;
        }

        return uploadedImage;
    }

    getBestPhoto(photos) {
        let widths = photos.map(photo => photo.width);
        let maxWidth = Math.max.apply(null, widths);

        return photos.find(photo => photo.width === maxWidth);
    }

    async sendSinglePhotoMessage(chatId, telegram) {
        let options = this.getExtra();
        options['caption'] = this.getMessage();

        if (this.mailing.cachedImage) {
            return telegram.sendPhoto(chatId, this.mailing.cachedImage.file_id, options);
        }
        else {
            let image = this.mailing.photos[0];
            let buffer = this.dataUriToBuffer(image.src);
            let apiMessage = await telegram.sendPhoto(chatId, {source: buffer}, options);
            this.mailing.cachedImage = this.getBestPhoto(apiMessage.photo);
            await this.saveMailingState();
            return apiMessage;
        }
    }

    async sendLinkedPhotoMessage(chatId, telegram) {
        if (!this.mailing.cachedImage) {
            let image = this.mailing.photos[0];
            let buffer = this.dataUriToBuffer(image.src);
            let uploadedImage = await this.uploadImage(buffer);
            if (!uploadedImage) {
                return false;
            }
            this.mailing.cachedImage = uploadedImage;
            await this.saveMailingState();
        }

        const emptyChar = '‎';
        let imageUrl = this.mailing.cachedImage.url;
        let text = this.getMessage();

        text = `<a href="${imageUrl}">${emptyChar}</a> ${text}`;
        return telegram.sendMessage(chatId, text, this.getExtra());
    }

    async sendMediaGroupMessage(chatId, telegram) {
        let media;
        if (this.mailing.cachedImage) {
            media = this.mailing.cachedImage.map(photo => photo.file_id);
        }
        else {
            media = this.mailing.photos.map(image => {
                return {media: {source: this.dataUriToBuffer(image.src)}, type: 'photo'};
            });
        }

        let mediaGroup;
        let result;
        let hasKeyboard = this.mailing.buttons && this.mailing.buttons.length > 0;

        if (hasKeyboard) {
            mediaGroup = await telegram.sendMediaGroup(chatId, media);
            result = await telegram.sendMessage(chatId, this.getMessage(), this.getExtra());
        }
        else {
            media[0]['caption'] = this.getMessage();
            media[0]['parse_mode'] = 'HTML';
            mediaGroup = await telegram.sendMediaGroup(chatId, media, {});
            result = mediaGroup[0];
        }

        if (!this.mailing.cachedImage) {
            this.mailing.cachedImage = mediaGroup.reduce((files, message) => {
                let photo = this.getBestPhoto(message.photo);
                files.push(photo);
                return files;
            }, []);

            await this.saveMailingState();
        }

        return result;
    }

    async sendPlainTextMessage(chatId, telegram) {
        return telegram.sendMessage(chatId, this.getMessage(), this.getExtra());
    }

    async sendMailingToChat(chat) {
        let response = false;
        let botId = chat.bot;

        let bot = await this.getBot(botId);
        if (!bot) {
            await this.setChatFailed(chat);
            return false;
        }

        let telegram = this.getTelegram(bot.token);

        try {
            let method = this.sendPlainTextMessage;
            if (this.mailing.photos && this.mailing.photos.length > 0) {
                if (this.mailing.photos.length > 1 && !this.mailing.photoAsLink) {
                    method = this.sendMediaGroupMessage;
                }
                else if (this.mailing.photoAsLink) {
                    method = this.sendLinkedPhotoMessage
                }
                else {
                    method = this.sendSinglePhotoMessage;
                }
            }

            response = await method.call(this, chat.chatId, telegram);
            if (this.id) {
                if (!response) {
                    await this.setChatFailed(chat, false);
                }
                else {
                    await this.setChatFinished(chat, response.message_id);
                }
            }
        }
        catch (sendError) {
            if (sendError && sendError.code) {
                if (!this.id) {
                    throw sendError;
                }

                if (sendError.code === 403) {
                    await this.setChatBlock(chat);
                    return false;
                }

                if (sendError.code === 429) {
                    let waitTimeMs = sendError.parameters && sendError.parameters.retry_after
                        ? (sendError.parameters.retry_after || 1) * 1000
                        : 1000;

                    await wait(waitTimeMs);
                    return this.sendMailingToChat(chat);
                }

                await this.setChatFailed(chat, sendError);
                return false;
            }
        }

        return response;
    }

    async saveMailingState() {
        if (!this.id) {
            return false;
        }

        const db = await getDb(MAILING_DB_NAME);
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

    async initProgress() {
        if (!this.mailing.total) {
            this.mailing.dateStarted = moment().unix();
            this.mailing.status = MAILING_STATUS_PROCESSING;

            let mailingDb = await getDb(MAILING_DB_NAME);
            let queueCount = await mailingDb.collection('mailingQueue').countDocuments({mailing: this.id});
            this.mailing.total = queueCount;

            return this.saveMailingState();
        }
    }

    async updateProgress() {
        let mailingDb = await getDb(MAILING_DB_NAME);

        let finishedCount = await mailingDb.collection('mailingQueue').countDocuments({mailing: this.id, status: {'$in': STATUSES_SUCCESS}});
        let failsCount = await mailingDb.collection('mailingQueue').countDocuments({mailing: this.id, STATUS_FAILED});
        let blocksCount = await mailingDb.collection('mailingQueue').countDocuments({mailing: this.id, status: STATUS_BLOCKED});
        let finishedTotal = finishedCount + failsCount + blocksCount;

        this.mailing.success = finishedCount;
        this.mailing.errors = failsCount;
        this.mailing.blocks = blocksCount;
        this.mailing.processed = finishedTotal;
        this.mailing.progress = this.mailing.total ? finishedTotal / this.mailing.total : 0;
    }

    stopSending() {
        this.stop = true;
        return new Promise(resolve => {
            this.stopResolve = resolve;
        });
    }

    async startSending() {
        if (!this.id) {
            return false;
        }

        await this.initQueue();
        await this.initProgress();

        let firstChunk = true;
        while (!this.isFinished()) {
            if (firstChunk) {
                await this.sendNextChunk(1);
                firstChunk = false;
            }
            else {
                await this.sendNextChunk();
            }
            await this.updateProgress();
            await this.saveMailingState();
        }

        if (this.stop) {
            this.mailing.datePaused = moment().unix();
            this.mailing.status = MAILING_STATUS_PAUSED;
            await this.saveMailingState();
            if (this.stopResolve) {
                this.stopResolve();
            }
        }
        else {
            this.mailing.dateFinished = moment().unix();
            this.mailing.status = MAILING_STATUS_FINISHED;
            await this.saveMailingState();
            process.exit();
        }
    }

    isFinished() {
        return (this.mailing.processed === this.mailing.total) || this.stop;
    }
}

module.exports = {Sender, MAILING_DB_NAME, MAILING_STATUS_NEW, MAILING_STATUS_PROCESSING, MAILING_STATUS_PAUSED, TEST_BOT_ID, MAILER_BOT_ID, STATUS_NEW};