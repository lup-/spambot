const Telegram = require('telegraf/telegram');
const {getDb} = require('./Database');
const shortid = require('shortid');
const moment = require('moment');

let botInstance = null;

function BotManager() {
    return {
        async init(telegramToken, settings = {}) {
            this.telegram = new Telegram(telegramToken);
            this.self = await this.telegram.getMe();
            this.settings = settings;

            return this;
        },
        getName() {
            return this.self
                ? this.self.first_name || this.self.username || false
                : false;
        },
        async listBots(userId) {
            let filter = {
                userId,
                deleted: {$in: [null, false]},
            };

            const db = await getDb();
            const bots = db.collection('bots');
            let filteredBots = await bots.find(filter).toArray();

            return filteredBots;
        },
        async listMailings(userId) {
            let filter = {
                userId,
                deleted: {$in: [null, false]},
                dateFinished: {$in: [null, false]},
                dateStarted: {$gte: moment().unix()}
            }

            const db = await getDb();
            const mailings = db.collection('mailings');
            let filteredMailings = await mailings.find(filter).toArray();

            return filteredMailings;
        },
        async getBot(botId, userId) {
            const db = await getDb();
            const bots = db.collection('bots');

            let bot = await bots.findOne({id: botId, userId});
            return bot;
        },
        async getMailing(mailingId, userId) {
            const db = await getDb();
            const mailings = db.collection('mailings');

            let mailing = await mailings.findOne({id: mailingId, userId});
            return mailing;
        },
        async saveBot(botFields, userId) {
            const db = await getDb();
            const chats = db.collection('bots');
            const id = botFields.id;

            botFields.userId = userId;
            if (!botFields.dateAdded) {
                botFields.dateAdded = moment().unix();
            }

            let updateResult = await chats.findOneAndReplace({id}, botFields, {upsert: true, returnOriginal: false});
            return updateResult.value || false;
        },
        async saveMailing(mailingFields) {
            const db = await getDb();
            const mailings = db.collection('mailingFields');

            if (!mailingFields.id) {
                mailingFields.id = shortid.generate();
            }

            const id = mailingFields.id;
            let updateResult = await mailings.findOneAndReplace({id}, mailingFields, {upsert: true, returnOriginal: false});
            return updateResult.value || false;
        },
        async deleteBot(botId) {
            const db = await getDb();
            const bots = db.collection('bots');
            let botFields = await bots.findOne({id});

            botFields = Object.assign(botFields, {
                deleted: true,
                dateDeleted: moment().unix(),
            });

            let updateResult = await botFields.findOneAndReplace({id: botId}, botFields, {returnOriginal: false});
            let bot = updateResult.value || false;

            return bot;
        },
    }
}

function getInstance() {
    if (botInstance) {
        return botInstance;
    }

    botInstance = new BotManager();
    return botInstance;
}

module.exports = getInstance;