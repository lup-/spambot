const { Telegraf } = require('telegraf');
const Telegram = require('telegraf/telegram');
const Stage = require('telegraf/stage');

const {getDb} = require('../modules/Database');
const {initManagers} = require('../managers');
const session = require('telegraf/session');
const store = new Map();

const getProfileWizard = require('./scenes/dating/profile');
const getRateProfiles = require('./scenes/dating/rateProfiles');
const getMainMenu = require('./scenes/dating/main');
const getSettings = require('./scenes/dating/settings');

const SafeReplyMiddleware = require('../modules/SafeReplyMiddleware');
const SaveActivityMiddleware = require('../modules/SaveActivityMiddleware');

const {catchErrors} = require('./helpers/common');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);
let telegram = new Telegram(BOT_TOKEN);

Promise.all([
    initManagers(['dating', 'chat', 'bus', 'profile']),
    getDb()
])
    .then(([{dating, chat, bus, profile}, db]) => {
        const profileWizard = getProfileWizard(dating);
        const rateProfiles = getRateProfiles(dating, false, telegram);
        const rateFans = getRateProfiles(dating, true, telegram);
        const mainMenu = getMainMenu(dating);
        const settings = getSettings(dating);

        const stage = new Stage();
        stage.register(profileWizard);
        stage.register(rateProfiles);
        stage.register(rateFans);
        stage.register(settings);
        stage.register(mainMenu);

        let safeReply = new SafeReplyMiddleware();
        safeReply.setBlockedHandler(async (ctx, next, e) => {
            let chatId = e && e.on && e.on.payload && e.on.payload.chat_id;

            if (chatId) {
                let targetProfile = await dating.loadProfileByUserId(chatId);
                await dating.blockUser(targetProfile);
            }
        });
        safeReply.setDefaultFallback(catchErrors);

        app.use(safeReply.getMiddleware());
        app.use(session({store}));
        app.use(profile.initSessionProfileMiddleware());
        app.use(chat.saveRefMiddleware());
        app.use(chat.saveUserMiddleware());
        app.use(SaveActivityMiddleware);
        app.use(stage.middleware());

        app.start(async (ctx) => {
            return ctx.session.profile
                ? ctx.scene.enter('mainMenu')
                : ctx.scene.enter('profileWizard');
        });

        app.command('clear', (ctx) => {
            ctx.session = null;
            store.clear();
        });

        app.catch(catchErrors);

        app.action('rateFans', ctx => ctx.scene.enter('rateFans'));
        app.action(/.*/, ctx => ctx.scene.enter('mainMenu'));
        app.on('message', ctx => ctx.scene.enter('mainMenu'));

        app.launch();
        bus.listenCommands();
    });