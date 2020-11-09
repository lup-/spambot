const Telegram = require('telegraf/telegram');
const {getDb} = require('../modules/Database');
const Sender = require('./SenderClass');

const [,, mailingId] = process.argv;
const BOT_TOKEN = process.env.BOT_TOKEN;

(async () => {
    const db = await getDb();
    const telegram = new Telegram(BOT_TOKEN);

    const sender = new Sender(mailingId, db.collection('mailings'), telegram);
    await sender.init();

    await sender.startSending();
})();