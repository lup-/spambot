const { Telegraf } = require('telegraf');
const {initManagers} = require('../managers');
const {catchErrors} = require('./helpers/common');

const session = require('telegraf/session');
const store = new Map();

const Stage = require('telegraf/stage');
const signsMenu = require('./scenes/horoscope/signsMenu');
const typesMenu = require('./scenes/horoscope/typesMenu');
const viewHoroscope = require('./scenes/horoscope/viewHoroscope');

const SaveActivityMiddleware = require('../modules/SaveActivityMiddleware');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);

initManagers(['horoscope', 'chat', 'bus']).then(async ({horoscope, chat, bus}) => {
    const stage = new Stage();
    stage.register(signsMenu(horoscope));
    stage.register(typesMenu(horoscope));
    stage.register(viewHoroscope(horoscope));

    app.catch(catchErrors);

    app.use(session({store}));
    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());
    app.use(SaveActivityMiddleware);
    app.use(stage.middleware());

    app.start(async ctx => {
        return ctx.scene.enter('viewHoroscope');
    });

    app.action(/.*/, ctx => ctx.scene.enter('viewHoroscope'));
    app.on('message', ctx => ctx.scene.enter('viewHoroscope'));

    app.launch();
    bus.listenCommands();
});
