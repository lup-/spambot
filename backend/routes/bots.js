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
    }
}