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

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);
let telegram = new Telegram(BOT_TOKEN);

Promise.all([
    initManagers(['dating', 'chat']),
    getDb()
])
    .then(([{dating, chat}, db]) => {
        const profileWizard = getProfileWizard(dating);
        const rateProfiles = getRateProfiles(dating, false, telegram);
        const rateFans = getRateProfiles(dating, true, telegram);
        const mainMenu = getMainMenu(dating);

        const stage = new Stage();
        stage.register(profileWizard);
        stage.register(rateProfiles);
        stage.register(rateFans);
        stage.register(mainMenu);

        app.use(session({store}));
        app.use(stage.middleware())

        app.start(async (ctx) => {
            const chatInfo = ctx.update.message.chat;
            const fromInfo = ctx.update.message.from;
            const userId = fromInfo.id;
            await chat.saveChat(chatInfo);

            ctx.session.userId = userId;
            ctx.session.chatId = chatInfo.id;

            if (!ctx.session.profile) {
                ctx.session.profile = await dating.loadProfileByUserId(userId);
            }

            return ctx.session.profile
                ? ctx.scene.enter('mainMenu')
                : ctx.scene.enter('profileWizard');
        });

        app.command('clear', (ctx) => {
            ctx.session = null;
            store.clear();
        });

        app.action('rateFans', ctx => ctx.scene.enter('rateFans'));

        app.launch();
    });