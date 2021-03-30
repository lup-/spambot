const { Telegraf } = require('telegraf');
const setupBot = require('./helpers/setup');
const {init} = require('../managers');
const {parseNewArticles} = require('./parsers/finance');
const fincatParams = require('./actions/fincat');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);
let bus = init('bus');
let periodic = init('periodic');

app = setupBot(app)
        .addHandleBlocks()
        .addSession()
        .addSafeReply()
        .addIdsToSession()
        .addRefSave()
        .addUserSave()
        .addProfile()
        .addSaveActivity()
        .addScenes('catalog', fincatParams)
        .addDefaultRoute(ctx => ctx.scene.enter('intro'))
        .get();

periodic.setRepeatingTask(async () => {
    await parseNewArticles();
}, 86400);

app.launch();
bus.listenCommands();