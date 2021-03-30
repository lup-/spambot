const { Telegraf } = require('telegraf');
const setupBot = require('./helpers/setup');
const {init} = require('../managers');
const plumcoreParams = require('./actions/plumcore');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);
let bus = init('bus');
let payment = plumcoreParams.payment;

app = setupBot(app)
        .addHandleBlocks()
        .addSession()
        .addSafeReply()
        .addIdsToSession()
        .addRefSave()
        .addUserSave()
        .addProfile()
        .addSaveActivity()
        .addScenes('catalog', plumcoreParams)
        .addDefaultRoute(ctx => ctx.scene.enter('intro'))
        .get();

payment.launchPaymentWatch(plumcoreParams.onSuccessfulPayment);
app.launch();
bus.listenCommands();