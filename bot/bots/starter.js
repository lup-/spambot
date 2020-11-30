const { Telegraf } = require('telegraf');
const Stage = require('telegraf/stage');

const session = require('telegraf/session');
const store = new Map();
const {initManagers} = require('../managers');
const {catchErrors} = require('./helpers/common');

const getCategoryMenu = require('./scenes/present/categoryMenu');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);

initManagers(['chat', 'bus']).then(async ({chat, bus}) => {
    app.catch(catchErrors);

    const stage = new Stage();
    stage.register(getCategoryMenu(chat));

    app.use(chat.initIdsMiddleware());
    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());
    app.use(stage.middleware());

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

    app.action(/.*/, ctx => ctx.scene.enter('categoryMenu'));
    app.on('message', ctx => ctx.scene.enter('categoryMenu'));

    app.launch();
    bus.listenCommands();
});