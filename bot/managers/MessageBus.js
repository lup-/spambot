const {reloadAds, reloadMessages} = require('../modules/Messages');
const redis = require("redis");

module.exports = function () {
    let subscriber = null;

    return {
        botName() {
            return process.env.BOT_NAME;
        },

        restartBot() {
            return process.exit(1);
        },

        async processCommand(message) {
            console.log('Получена комманда '+message.command);

            switch (message.command) {
                case 'restart':
                    return this.restartBot();
                case 'reloadAds':
                    return reloadAds();
                case 'reloadMessages':
                    return reloadMessages();
            }
        },

        listenCommands() {
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
        }
    }
}