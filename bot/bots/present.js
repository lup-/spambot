const { Telegraf } = require('telegraf');
const Stage = require('telegraf/stage');

const session = require('telegraf/session');
const store = new Map();

const {initManagers} = require('../managers');
const {catchErrors} = require('./helpers/common');

const getCategoryMenu = require('./scenes/present/categoryMenu');
const getDiscover = require('./scenes/present/discover');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);

initManagers(['chat', 'present']).then(async ({chat, present}) => {
    const stage = new Stage();
    stage.register(getCategoryMenu(present));
    stage.register(getDiscover(present));

    app.use(session({store}));
    app.use(chat.initIdsMiddleware());
    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());
    app.use(stage.middleware());

    app.catch(catchErrors);
    app.start(async (ctx) => {
        try {
            return ctx.scene.enter('categoryMenu');
        }
        catch (e) {}
    });
    app.action(/.*/, ctx => ctx.scene.enter('categoryMenu'));
    app.on('message', ctx => ctx.scene.enter('categoryMenu'));

    app.launch();
});