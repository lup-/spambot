const { Telegraf } = require('telegraf');
const {initManagers} = require('../managers');
const {catchErrors} = require('./helpers/common');

const SaveActivityMiddleware = require('../modules/SaveActivityMiddleware');

const session = require('telegraf/session');
const store = new Map();

const Stage = require('telegraf/stage');
const mainStage = require('./scenes/pdd/main');
const examStage = require('./scenes/pdd/exam');
const topicsStage = require('./scenes/pdd/topics');
const questionStage = require('./scenes/pdd/question');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);

initManagers(['chat', 'pdd', 'bus']).then(async ({chat, pdd, bus}) => {
    app.catch(catchErrors);

    const stage = new Stage();
    stage.register(mainStage(pdd));
    stage.register(examStage(pdd));
    stage.register(topicsStage(pdd));
    stage.register(questionStage(pdd));

    app.use(session({store}));
    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());
    app.use(SaveActivityMiddleware);
    app.use(stage.middleware());

    app.start(async (ctx) => {
        try {
            return ctx.scene.enter('main');
        }
        catch (e) {}
    });

    app.action(/.*/, ctx => ctx.scene.enter('main'));
    app.on('message', ctx => ctx.scene.enter('main'));

    app.launch();
    bus.listenCommands();
});