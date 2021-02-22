const redis = require("redis");

const client = redis.createClient({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
});

function wait(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
}

function startListen(channel, callback) {
    let receiveMessage = (channel, textMessage) => {
        let message = JSON.parse(textMessage);
        return callback(message);
    }

    client.on("message", receiveMessage);
    client.subscribe(channel);

    return receiveMessage;
}

function stopListen(channel, listener) {
    client.off('message', listener);
    client.unsubscribe(channel);
}

function publishCommand(command, botNames, args = []) {
    const COMMAND_CHANNEL = 'commands';
    const publisher = redis.createClient({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
    });

    for (const to of botNames) {
        let textMessage = JSON.stringify({to, command, args});
        publisher.publish(COMMAND_CHANNEL, textMessage);
    }
}

function publishCommandWithReply(command, botNames, args = [], WAIT_TIMEOUT = 30 * 1000) {
    const REPLY_CHANNEL = 'reply';
    const WAIT_STEP = 100;

    return new Promise(async resolve => {
        let replies = [];
        let listener = startListen(REPLY_CHANNEL, message => replies.push(message));

        publishCommand(command, botNames, args);

        let noAnswerFromBots = [];
        for (let timePassed = 0; timePassed < WAIT_TIMEOUT; timePassed += WAIT_STEP) {
            await wait(WAIT_STEP);
            let answeredBotNames = replies.map(reply => reply.bot);
            noAnswerFromBots = botNames.filter( botName => answeredBotNames.indexOf(botName) === -1);
            if (noAnswerFromBots.length === 0) {
                break;
            }
        }

        if (noAnswerFromBots.length > 0) {
            let emptyAnswers = noAnswerFromBots.map(botName => ({bot: botName, data: null, timeout: true}));
            replies = replies.concat( emptyAnswers );
        }

        stopListen(REPLY_CHANNEL, listener);
        return resolve(replies);
    });
}

module.exports = {publishCommand, publishCommandWithReply};