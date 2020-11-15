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
        const settings = getSettings(dating);

        const stage = new Stage();
        stage.register(profileWizard);
        stage.register(rateProfiles);
        stage.register(rateFans);
        stage.register(settings);
        stage.register(mainMenu);

        app.use(session({store}));
        app.use(dating.initSessionProfileMiddleware());
        app.use(chat.saveRefMiddleware());
        app.use(chat.saveUserMiddleware());
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

        app.catch(async (err, ctx) => {
            console.log(err);
            try {
                await ctx.reply('Похоже, что-то пошло не по плану.\nПопробуйте начать занвово /start.');
            }
            catch (e) {
            }

            return;
        });

        app.action('rateFans', ctx => ctx.scene.enter('rateFans'));
        app.action(/.*/, ctx => ctx.scene.enter('mainMenu'));
        app.on('message', ctx => ctx.scene.enter('mainMenu'));

        app.launch();
    });