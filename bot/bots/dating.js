const { Telegraf } = require('telegraf');
const Telegram = require('telegraf/telegram');

const setupBot = require('./helpers/setup');
const {getManagerSync: manager} = require('../managers');
const store = new Map();

const dating = manager('dating');
const bus = manager('bus');

async function blockedHandler(ctx, next, e) {
    let chatId = e && e.on && e.on.payload && e.on.payload.chat_id;

    if (chatId) {
        let targetProfile = await dating.loadProfileByUserId(chatId);
        await dating.blockUser(targetProfile);
    }
}
function routeToSceneOrProfile(ctx, sceneCode) {
    return ctx.session.profile && ctx.session.profile.id
        ? ctx.scene.enter(sceneCode)
        : ctx.scene.enter('profileWizard');
}

const BOT_TOKEN = process.env.BOT_TOKEN;
let telegram = new Telegram(BOT_TOKEN);

let app = setupBot(new Telegraf(BOT_TOKEN))
    .addHandleBlocks()
    .blockNonPrivate()
    .addSession({}, 3600)
    .addSafeReply(blockedHandler)
    .addIdsToSession()
    .addRefSave()
    .addUserSave()
    .addProfile()
    .addSaveActivity()
    .addSubscription()
    .addScene('dating', 'profile', dating)
    .addScene('dating', 'rateProfiles', {datingManager: dating, userFansList: false, telegram})
    .addScene('dating', 'rateProfiles', {datingManager: dating, userFansList: true, telegram})
    .addScene('dating', 'main', dating)
    .addScene('dating', 'settings', dating)
    .get();

    app.start(ctx => routeToSceneOrProfile(ctx, 'mainMenu'));
    app.command('clear', (ctx) => {
        ctx.session = null;
        store.clear();
    });
    app.action('rateFans', ctx => routeToSceneOrProfile(ctx, 'rateFans'));

app = setupBot(app)
    .addDefaultRoute(ctx => routeToSceneOrProfile(ctx, 'mainMenu'))
    .get();

app.launch();
bus.listenCommands();