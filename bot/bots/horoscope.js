const { Telegraf } = require('telegraf');
const setupBot = require('./helpers/setup');
const {getManagerSync: manager} = require('../managers');

const BOT_TOKEN = process.env.BOT_TOKEN;
const horoscope = manager('horoscope');
const bus = manager('bus');

let app = setupBot(new Telegraf(BOT_TOKEN))
    .addHandleBlocks()
    .blockNonPrivate()
    .addSession({}, 3600)
    .addSafeReply()
    .addIdsToSession()
    .addRefSave()
    .addUserSave()
    .addProfile()
    .addSaveActivity()
    .addSubscription()
    .addScenes('horoscope', horoscope)
    .addDefaultRoute(ctx => ctx.scene.enter('viewHoroscope'))
    .get();

app.launch();
bus.listenCommands();