const { Telegraf } = require('telegraf');
const Stage = require('telegraf/stage');

const session = require('telegraf/session');
const store = new Map();
const {initManagers} = require('../managers');
const {catchErrors} = require('./helpers/common');

const SafeReplyMiddleware = require('../modules/SafeReplyMiddleware');
const SaveActivityMiddleware = require('../modules/SaveActivityMiddleware');

const getSettings = require('./scenes/finance/settings');
const {__} = require('../modules/Messages');
const {menu} = require('./helpers/wizard');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);

initManagers(['chat', 'bus', 'periodic', 'profile', 'finance']).then(async ({chat, bus, periodic, profile, finance}) => {
    app.catch(catchErrors);

    const stage = new Stage();
    stage.register(getSettings(finance, profile, periodic));

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
        try {
            return ctx.reply(__(`Выберите интересующую вас категорию для подписки. Каждая из них содержит темы, которые могут быть вам интересны.

Нажимая на кнопку ПОДПИСАТЬСЯ вы подписываетесь на все категории`, ['content', 'intro']), menu([{code: 'accept', text: 'Понятно'}]));
        }
        catch (e) {
            console.log(e);
        }
    });

    app.action('accept', ctx => ctx.scene.enter('settings'));

    app.action(/.*/, ctx => ctx.scene.enter('settings'));
    app.on('message', ctx => ctx.scene.enter('settings'));

    periodic.setTaskRunner(async task => {
        let profileData = await profile.loadProfileByUserId(task.userId);
        try {
            let selectedCategories = finance.getSavedCategories(profileData);
            let article = await finance.getRandomArticleByCategories(selectedCategories, profile);

            if (article) {
                let messageText = __(`<b>${article.title}</b>

${article.description}
    
<a href="${article.link}">Читать дальше...</a>`, ['content', 'article', 'finance']);

                let message = await app.telegram.sendMessage(task.chatId, messageText, {parse_mode: 'HTML'});
            }

            if (article) {
                if (!profileData.sentArticleIds) {
                    profileData.sentArticleIds = [];
                }

                profileData.sentArticleIds.push(article.id);
                await profile.saveProfile(profileData);
            }
            await periodic.setTaskRemindSuccess(task.taskId);
            await periodic.setTaskTime(task.taskId, finance.getNextRemindDate());
        }
        catch (e) {
            if (e && e.code === 403) {
                await finance.unsubscribe(profileData, periodic, profile);
            }
        }
    });

    app.launch();
    periodic.launch();
    bus.listenCommands();
});