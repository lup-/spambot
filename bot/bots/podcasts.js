const { Telegraf } = require('telegraf');
const Stage = require('telegraf/stage');

const session = require('telegraf/session');
const store = new Map();

const {initManagers} = require('../managers');
const {catchErrors} = require('./helpers/common');
const SafeReplyMiddleware = require('../modules/SafeReplyMiddleware');

const getDiscover = require('./scenes/podcasts/discover');
const getVolumes = require('./scenes/podcasts/volumes');
const getSettings = require('./scenes/podcasts/settings');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);

initManagers(['chat', 'profile', 'podcasts', 'bus']).then(async ({chat, profile, podcasts, bus}) => {
    app.catch(catchErrors);

    const stage = new Stage();
    stage.register(getDiscover(podcasts));
    stage.register(getVolumes(podcasts));
    stage.register(getSettings(podcasts, profile))

    let safeReply = new SafeReplyMiddleware();
    safeReply.setDefaultFallback(catchErrors);

    app.use(safeReply.getMiddleware());
    app.use(session({store}));
    app.use(chat.initIdsMiddleware());
    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());
    app.use(profile.initSessionProfileMiddleware());
    app.use(stage.middleware());

    app.start(async (ctx) => {
        try {
            return ctx.scene.enter('discover');
        }
        catch (e) {}
    });
    app.action(/.*/, ctx => ctx.scene.enter('discover'));
    app.on('message', ctx => ctx.scene.enter('discover'));

    app.launch();
    bus.listenCommands();
});