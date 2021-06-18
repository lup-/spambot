const { Telegraf } = require('telegraf');
const setupBot = require('../bots/helpers/setup');
const {init} = require('../managers');
const Mailer = require('./MailerClass');
const {getDb} = require('../modules/Database');
const {menu} = require('../bots/helpers/wizard');
const shortid = require('shortid');
const moment = require('moment');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);
let bus = init('bus');
let mailer = new Mailer();

async function getRegisteredUser(ctx) {
    let telegramId = ctx.from.id;
    let db = await getDb('botofarmer');
    let user = await db.collection('users').findOne({
        $or: [
            {telegramId},
            {telegramId: telegramId.toString()}
        ],
        deleted: {$in: [null, false]}});

    if (user && (user.canCreateMailingFromBot || user.isAdmin)) {
        return user;
    }

    return false;
}

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

app.start(async ctx => {
    let user = await getRegisteredUser(ctx);
    if (user) {
        return ctx.reply('О.К. Ты знаешь, что делать');
    }
    else {
        return ctx.reply('Ты кто?', menu([{code: 'register', text: 'Зарегистрироваться'}]));
    }
});

app.on('message', async (ctx, next) => {
    let user = await getRegisteredUser(ctx);
    let isForward = ctx.updateSubTypes.indexOf('forward') !== -1;

    if (isForward) {
        let hasRights = mailer.checkRights(user);
        if (!hasRights) {
            return ctx.reply('Нет прав');
        }

        let savedMailing = await mailer.createMailing(ctx, user);
        if (savedMailing) {
            return ctx.reply('Черновик рассылки сохранен');
        }

        return ctx.reply('Ошибка сохранения черновика рассылки');
    }
    else {
        return next();
    }
});

app.action('register', async ctx => {
    let telegramId = ctx.from.id;
    let login = ctx.from.username || '';
    let name = [ctx.from.first_name, ctx.from.last_name].join(' ');

    let newUser = {
        id: shortid(),
        registered: moment().unix(),
        telegramId,
        login,
        name,
        canCreateMailingFromBot: false
    }

    let db = await getDb('botofarmer');
    await db.collection('users').insertOne(newUser);

    return ctx.reply('Запрос на регистрацию отправлен. Скажи кому нужно');
});

// process.once('SIGINT', () => app.stop());
// process.once('SIGTERM', () => app.stop());

(async () => {
    app.launch();
    bus.listenCommands();
    await mailer.launch();
    process.exit();
})();
