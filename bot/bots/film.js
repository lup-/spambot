const { Telegraf } = require('telegraf');
const Stage = require('telegraf/stage');

const session = require('telegraf/session');
const store = new Map();

const {initManagers} = require('../managers');
const {catchErrors} = require('./helpers/common');
const SafeReplyMiddleware = require('../modules/SafeReplyMiddleware');

const getSearchMenu = require('./scenes/film/searchMenu');
const getSettings = require('./scenes/film/settings');
const getDiscover = require('./scenes/film/discover');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);

initManagers(['chat', 'film']).then(async ({chat, film}) => {
    const stage = new Stage();
    stage.register(getSearchMenu(film));
    stage.register(getSettings(film));
    stage.register(getDiscover(film));

    let safeReply = new SafeReplyMiddleware();
    safeReply.setDefaultFallback(catchErrors);

    app.use(safeReply.getMiddleware());
    app.use(session({store}));
    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());
    app.use(film.initSessionProfileMiddleware());
    app.use(stage.middleware());

    app.catch(catchErrors);
    app.start(async (ctx) => {
        try {
            return ctx.scene.enter('searchMenu');
        }
        catch (e) {}
    });
    app.action(/.*/, ctx => ctx.scene.enter('searchMenu'));
    app.on('message', ctx => ctx.scene.enter('searchMenu'));

    app.launch();
});