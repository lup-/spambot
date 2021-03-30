const { Telegraf } = require('telegraf');
const Stage = require('telegraf/stage');

const session = require('telegraf/session');
const store = new Map();

const {initManagers} = require('../managers');
const {catchErrors} = require('./helpers/common');
const {menu} = require('./helpers/wizard');
const {__} = require('../modules/Messages');
const SafeReplyMiddleware = require('../modules/SafeReplyMiddleware');
const SaveActivityMiddleware = require('../modules/SaveActivityMiddleware');
const toggleBlockedMiddleware = require('../modules/toggleBlockedMiddleware');

const getIntro = require('./scenes/podcasts/intro');
const getDiscover = require('./scenes/podcasts/discover');
const getVolumes = require('./scenes/podcasts/volumes');
const getSettings = require('./scenes/podcasts/settings');
const getSettingsRouter = require('./scenes/podcasts/selectSettings');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN, {
        telegram: {
//            apiRoot: `https://${process.env.TGAPI_HOST}:${process.env.TGAPI_PORT}`,
        }
    });

initManagers(['chat', 'profile', 'podcasts', 'bus']).then(async ({chat, profile, podcasts, bus}) => {
    app.catch(catchErrors);

    const stage = new Stage();
    stage.register(getIntro());
    stage.register(getDiscover(podcasts, profile));
    stage.register(getVolumes(podcasts));
    stage.register(getSettings(podcasts, profile));
    stage.register(getSettingsRouter());

    let safeReply = new SafeReplyMiddleware();
    safeReply.setDefaultFallback(catchErrors);

    app.use(toggleBlockedMiddleware);
    app.use(safeReply.getMiddleware());
    app.use(session({store}));
    app.use(chat.initIdsMiddleware());
    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());
    app.use(profile.initSessionProfileMiddleware());
    app.use(SaveActivityMiddleware);
    app.use(stage.middleware());

    app.start(async ctx => ctx.scene.enter('intro'));

    app.action(/.*/, ctx => ctx.scene.enter('discover', {type: 'search'}));
    app.on('message', ctx => ctx.scene.enter('discover', {type: 'search'}));

    app.launch();
    bus.listenCommands();
});