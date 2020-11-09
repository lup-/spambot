const Telegram = require('telegraf/telegram');
const {getDb} = require('../modules/Database');
const moment = require('moment');

module.exports = function () {
    return {
        async init(telegramToken) {
            this.telegram = new Telegram(telegramToken);
            this.self = await this.telegram.getMe();

            return this;
        },
        getSelfInfo() {
            return this.self || false;
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
        async getBot(botId) {
            const db = await getDb();
            const bots = db.collection('bots');

            let bot = await bots.findOne({id: botId});
            return bot;
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

getInstance;