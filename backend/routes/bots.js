const redis = require("redis");
const config = require('../config');

const publisher = redis.createClient({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
});

function publishCommand(command, botNames) {
    const COMMAND_CHANNEL = 'commands';

    for (const to of botNames) {
        let textMessage = JSON.stringify({to, command});
        publisher.publish(COMMAND_CHANNEL, textMessage);
    }
}

module.exports = {
    async list(ctx) {
        ctx.body = {bots: config.botList()}
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