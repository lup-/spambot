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
    let exitCodes = await mailer.stopMailing(mailingId);
    bus.publishReply(exitCodes);
});

app.start(ctx => ctx.reply('О.К. Ты знаешь, что делать'));
app.on('message', async ctx => {
    let savedMailing = mailer.createMailing(ctx);
    if (savedMailing) {
        return ctx.reply('Черновик рассылки сохранен');
    }

    return ctx.reply('Ошибка сохранения черновика рассылки');
});

// process.once('SIGINT', () => app.stop());
// process.once('SIGTERM', () => app.stop());

(async () => {
    app.launch();
    bus.listenCommands();
    await mailer.launch();
    process.exit();
})();
