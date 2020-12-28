const { Telegraf } = require('telegraf');
const setupBot = require('../bots/helpers/setup');
const {init} = require('../managers');
const Mailer = require('./MailerClass');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);
let bus = init('bus');
let mailer = new Mailer();

app = setupBot(app)
    .addSession()
    .addIdsToSession()
    .addRefSave()
    .addUserSave()
    .get();

bus.registerCommand('stopMailing', async mailingId => {
    let exitCode = await mailer.stopMailing(mailingId);
    bus.publishReply(exitCode);
});
app.start(ctx => ctx.reply('О.К. Ты знаешь, что делать'));

app.launch();
bus.listenCommands();
mailer.launch();