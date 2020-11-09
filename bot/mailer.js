const BOT_TOKEN = process.env.BOT_TOKEN;

const {getDb} = require('./modules/Database');
const {initManagers} = require('./managers');

(async () => {
    const {bot, mailing} = await initManagers(['bot', 'mailing']);
    const db = await getDb();

    let mailingsInProgress = [];

    while (true) {
        try {
            let exceptIds = mailingsInProgress.map(mailing => mailing.id);
            let newMailings = await mailing.listActiveMailings(exceptIds);

            if (newMailings && newMailings.length > 0) {
                for (let newMailing of newMailings) {



                }
            }
        } catch (e) {
            console.log(e);
        }
    }
})();