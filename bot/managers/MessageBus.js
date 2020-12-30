const {reloadAds, reloadMessages} = require('../modules/Messages');
const redis = require("redis");

module.exports = function () {
    let subscriber = null;
    let commands = {};

    return {
        botName() {
            return process.env.BOT_NAME;
        },

        restartBot() {
            return process.exit(1);
        },

        async processCommand(message) {
            console.log('Получена комманда '+message.command);

            let actionFn = commands[message.command];

            if (actionFn) {
                let args = message.args || [];
                actionFn.apply(this, args);
            }
        },

        registerCommand(code, func) {
            commands[code] = func;
            return this;
        },

        registerBasicCommands() {
            this.registerCommand('restart', this.restartBot);
            this.registerCommand('reloadAds', reloadAds);
            this.registerCommand('reloadMessages', reloadMessages);
            return this;
        },

        listenCommands() {
            this.registerBasicCommands();
            const COMMANDS_CHANNEL = "commands";

            subscriber = redis.createClient({
                host: process.env.REDIS_HOST || '127.0.0.1',
                port: process.env.REDIS_PORT || 6379,
            });

            subscriber.on("message", (channel, textMessage) => {
                let message = JSON.parse(textMessage);

                let botTo = message.to;
                let forMe = botTo === this.botName() || Boolean(botTo) === false;
                if (forMe) {
                    return this.processCommand(message);
                }
            });

            subscriber.subscribe(COMMANDS_CHANNEL);
        },

        publishReply(data) {
            const REPLY_CHANNEL = 'reply';

            let publisher = redis.createClient({
                host: process.env.REDIS_HOST || '127.0.0.1',
                port: process.env.REDIS_PORT || 6379,
            });
            let textMessage = JSON.stringify({bot: this.botName(), data});
            return publisher.publish(REPLY_CHANNEL, textMessage);
        }
    }
}