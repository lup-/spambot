const { Telegraf } = require('telegraf');
const {initManagers} = require('../managers');
const {catchErrors} = require('./helpers/common');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);

initManagers(['chat']).then(async ({chat}) => {
    app.catch(catchErrors);

    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());

    app.start(async (ctx) => {
        try {
            return ctx.reply('Привет');
        }
        catch (e) {}
    });

    app.on('message', async ctx => {
        try {
                return ctx.reply('Воу, полехче');
        }
        catch (e) {
            console.log(e);
        }
    });

    app.launch();
});