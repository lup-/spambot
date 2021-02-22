const { Telegraf } = require('telegraf');
const Stage = require('telegraf/stage');

const session = require('telegraf/session');
const store = new Map();
const {initManagers} = require('../managers');
const {catchErrors} = require('./helpers/common');

const SafeReplyMiddleware = require('../modules/SafeReplyMiddleware');
const SaveActivityMiddleware = require('../modules/SaveActivityMiddleware');

const getMenu = require('./scenes/business/menu');
const getDiscover = require('./scenes/business/discover');
const getCategories = require('./scenes/business/categories');

const {menu} = require('./helpers/wizard');
const {__} = require('../modules/Messages');
const {parseNewFFArticles} = require('./parsers/founder');
const {parseNewBMArticles} = require('./parsers/business');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);

initManagers(['chat', 'bus', 'profile', 'business', 'periodic']).then(async ({chat, bus, profile, business, periodic}) => {
    app.catch(catchErrors);

    const stage = new Stage();
    stage.register(getMenu(business));
    stage.register(getDiscover(business, profile));
    stage.register(getCategories(business, profile));

    let safeReply = new SafeReplyMiddleware();
    safeReply.setDefaultFallback(catchErrors);

    app.use(safeReply.getMiddleware());
    app.use(session({store}));
    app.use(chat.initIdsMiddleware());
    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());
    app.use(profile.initSessionProfileMiddleware());
    app.use(SaveActivityMiddleware);
    app.use(stage.middleware());

    app.start(async (ctx) => {
        let messageShown = ctx && ctx.session && ctx.session.introShown;
        if (messageShown) {
            return ctx.scene.enter('menu');
        }

        try {
            ctx.session.introShown = true;
            return ctx.replyWithHTML(
                __(`Этот бот поможет найти идею для нового бизнеса. Заходите, выбирайте, развивайте.`, ['content', 'intro']),
                menu([{code: 'accept', text: 'Понятно'}])
            );
        }
        catch (e) {
            console.log(e);
        }
    });
    app.action('accept', ctx => ctx.scene.enter('menu'));

    app.action(/.*/, ctx => ctx.scene.enter('menu'));
    app.on('message', ctx => ctx.scene.enter('menu'));

    periodic.setRepeatingTask(async () => {
        await parseNewFFArticles();
        await parseNewBMArticles();
    }, 86400);

    app.launch();
    bus.listenCommands();
});