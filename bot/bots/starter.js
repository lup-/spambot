const { Telegraf } = require('telegraf');
const Stage = require('telegraf/stage');

const session = require('telegraf/session');
const store = new Map();
const {initManagers} = require('../managers');
const {catchErrors} = require('./helpers/common');

const SafeReplyMiddleware = require('../modules/SafeReplyMiddleware');
const SaveActivityMiddleware = require('../modules/SaveActivityMiddleware');
const getCategoryMenu = require('./scenes/present/categoryMenu');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);

initManagers(['chat', 'bus', 'profile']).then(async ({chat, bus, profile}) => {
    app.catch(catchErrors);

    const stage = new Stage();
    stage.register(getCategoryMenu(chat));

    let safeReply = new SafeReplyMiddleware();
    safeReply.setDefaultFallback(catchErrors);

    app.use(safeReply.getMiddleware());
    app.use(session({store}));
    app.use(chat.initIdsMiddleware());
    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());
    app.use(profile.initSessionProfileMiddleware());
    app.use(stage.middleware());
    app.use(SaveActivityMiddleware);

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