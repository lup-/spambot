const { Telegraf } = require('telegraf');
const setupBot = require('./helpers/setup');
const {init} = require('../managers');
const plumcoreParams = require('./actions/plumcore');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);
let bus = init('bus');
let payment = plumcoreParams.payment;
let sessionStore = new Map();

app = setupBot(app)
        .addHandleBlocks()
        .addState()
        .addSession({}, false, sessionStore)
        .addSafeReply()
        .addIdsToSession()
        .addRefSave()
        .addUserSave()
        .addProfile()
        .addSaveActivity()
        .addAutoDeleteMessages()
        .addScenes('catalog', plumcoreParams)
        .addScenes('plumcore', plumcoreParams)
        .addRoute('action', 'retry', ctx => {
            let item = ctx.session.lastItem;
            if (item) {
                return ctx.scene.enter('payment', {item});
            }
            else {
                return ctx.scene.enter('discover');
            }
        })
        .addDefaultRoute(ctx => ctx.scene.enter('intro'))
        .get();

payment.setSessionStore(sessionStore);
payment.launchPaymentWatch(plumcoreParams.onSuccessfulPayment);
payment.launchPaymentReminder();

app.launch();
bus.listenCommands();