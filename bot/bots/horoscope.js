const { Telegraf } = require('telegraf');
const {initManagers} = require('../managers');
const {catchErrors} = require('./helpers/common');

const session = require('telegraf/session');
const store = new Map();

const Stage = require('telegraf/stage');
const signsMenu = require('./scenes/horoscope/signsMenu');
const typesMenu = require('./scenes/horoscope/typesMenu');
const viewHoroscope = require('./scenes/horoscope/viewHoroscope');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);

initManagers(['horoscope', 'chat']).then(async ({horoscope, chat}) => {
    const stage = new Stage();
    stage.register(signsMenu(horoscope));
    stage.register(typesMenu(horoscope));
    stage.register(viewHoroscope(horoscope));

    app.catch(catchErrors);

    app.use(session({store}));
    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());
    app.use(stage.middleware());

    app.start(async ctx => {
        if (ctx.session.sign && ctx.session.type ) {
            return ctx.scene.enter('viewHoroscope');
        }
        else if (ctx.session.sign) {
            return ctx.scene.enter('typesMenu');
        }
        else {
            return ctx.scene.enter('signsMenu');
        }
    });

    app.action(/.*/, ctx => ctx.scene.enter('signsMenu'));
    app.on('message', ctx => ctx.scene.enter('signsMenu'));

    app.launch();

});