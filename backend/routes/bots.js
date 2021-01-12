const {getDb} = require('../../bot/modules/Database');
const config = require('../config');
const {publishCommand} = require('../modules/commands');

module.exports = {
    async list(ctx) {
        ctx.body = {bots: await config.botList()}
    },
    async restart(ctx) {
        let botNames = ctx.request.body.botNames || [];
        publishCommand('restart', botNames);
        ctx.body = {success: true};
    },
    async reloadAds(ctx) {
        let botNames = ctx.request.body.botNames || [];
        publishCommand('reloadAds', botNames);
        ctx.body = {success: true};
    },
    async reloadMessages(ctx) {
        let botNames = ctx.request.body.botNames || [];
        publishCommand('reloadMessages', botNames);
        ctx.body = {success: true};
    },
    async getSettings(ctx) {
        const db = await getDb();

        let botName = ctx.request.body.botName;

        if (!botName) {
            ctx.body = {settings: false};
            return;
        }

        let settings = await db.collection('botSettings').findOne({botName});

        ctx.body = {settings};
    },
    async saveSettings(ctx) {
        const db = await getDb();

        let settings = ctx.request.body.settings;
        let botName = settings.botName;

        if (!botName) {
            ctx.body = {settings: false};
            return;
        }

        if (settings._id) {
            delete settings._id;
        }

        let updateResult = await db.collection('botSettings').findOneAndReplace({botName}, settings, {upsert: true, returnOriginal: false});
        let savedSetting = updateResult.value || false;

        ctx.body = {settings: savedSetting};
    },

}