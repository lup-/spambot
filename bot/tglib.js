const { Client, Structs } = require('tglib/node');
const TextStruct = Structs.TextStruct;
const {wait} = require('./modules/Helpers');
const fs = require('fs')

const logger = fs.createWriteStream('send.log', {flags: 'a'})

function authBot(tglib) {
    const defaultHandler = tglib.callbacks['td:getInput'];

    tglib.registerCallback('td:getInput', async (args) => {
        if (args.string === 'tglib.input.AuthorizationType') {
            return 'bot'
        }
        else if (args.string === 'tglib.input.AuthorizationValue') {
            return process.env.TOKEN;
        }
        return defaultHandler(args);
    })
}

(async () => {
    console.log(0);
    const tglib = new Client({
        apiId: process.env.API_ID,
        apiHash: process.env.API_HASH,
        verbosityLevel: 10,
        appDir: '/var/app/tgclient',
        binaryPath: '/usr/local/lib/libtdjson.so',
        wasmModule: null,
        filesDir: '/var/app/tgclient',
        databaseDir: '/var/app/tgclient',
    });
    authBot(tglib);
    await tglib.ready;

    try {
        let chat = await tglib.tg.getChat({chat_id: 483896081});
        console.log(chat);
        let msgPerSecond = 10;
        let msgPause = 1000 / msgPerSecond;

        for (let counter = 0; counter < 10; counter++) {
            let message = await tglib.tg.sendTextMessage({
                '$text': new TextStruct('`Hello` world!', 'textParseModeMarkdown'),
                'chat_id': 483896081,
                'disable_notification': true,
                'clear_draft': false,
            });

            await wait(msgPause);
            console.log(counter, message.id);
            logger.write(JSON.stringify(message));
        }
    }
    catch (e) {
        console.log(e);
    }
    logger.end();
    return;
})();
