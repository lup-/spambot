const { Telegraf } = require('telegraf');
const setupBot = require('./helpers/setup');
const {init} = require('../managers');
const RefStat = require('../managers/RefStat');
const {menu} = require('./helpers/wizard');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);
let bus = init('bus');
let profile = init('profile');
let refstat = new RefStat();

function hasPermissions(ctx) {
    return ctx.session && ctx.session.profile && ctx.session.profile.refs && ctx.session.profile.refs.length > 0;
}

function checkPermissions(ctx, bot, ref) {
    let refCode = `${bot.id}:${ref}`;
    return ctx.session && ctx.session.profile && ctx.session.profile.refs && ctx.session.profile.refs.indexOf(refCode) !== -1;
}

function statMenu(bot, ref) {
    let codeBase = `stat/${bot.id}/${ref}/`;
    return menu([
        {code: codeBase+'1d', text: 'Сегодня'},
        {code: codeBase+'7d', text: 'Неделя'},
        {code: codeBase+'30d', text: 'Месяц'},
    ]);
}

function getStatMessage(bot, stats) {
    let textRows = stats.map(stat => {
        return stat.tag.padEnd(18)+' '+stat.count.toString().padEnd(7)+' '+(stat.delta > 0 ?'+' : '')+stat.delta.toString();
    }).join('\n');

    return `<b>Статистика бота ${bot.tg.first_name}</b>
@${bot.tg.username}

<code>${textRows}</code>`;
}

app = setupBot(app)
    .addSession()
    .addSafeReply()
    .addIdsToSession()
    .addRefSave()
    .addUserSave()
    .addProfile()
    .addSaveActivity()
    .get();

app.start(async ctx => {
    let profileData = await profile.loadProfileByUserId(ctx.session.userId);
    ctx.session.profile = profileData || ctx.session.profile;

    if (hasPermissions(ctx)) {
        return ctx.reply('Пришлите реферальную ссылку и я покажу статистику');
    }
    else {
        profileData = ctx.session.profile || {};
        profileData.user = ctx.from;
        await profile.saveProfile(profileData);
        return ctx.reply('Запрос на доступ к статистике отправлен. Ждите');
    }
});

app.on('text', async ctx => {
    let [, botUsername, ref] = ctx.update.message.text.match(/https?:\/\/[^\/]+\/(.*?)\?start=(.*)/);
    let bot = await refstat.getBotByUsername(botUsername);
    if (!bot) {
        return ctx.reply('Нет доступа');
    }

    let hasPermission = checkPermissions(ctx, bot, ref);

    if (!hasPermission) {
        return ctx.reply('Нет доступа');
    }

    let stat = await refstat.getPeriodStat(bot, ref, '1d');
    return ctx.replyWithHTML(getStatMessage(bot, stat), statMenu(bot, ref));
});

app.action(/stat\/(.*?)\/(.*?)\/(.*)/, async ctx => {
    let [, botId, ref, periodType] = ctx.match;

    let bot = await refstat.getBotById(botId);
    if (!bot) {
        return ctx.reply('Нет доступа');
    }

    let hasPermission = checkPermissions(ctx, bot, ref);

    if (!hasPermission) {
        return ctx.reply('Нет доступа');
    }

    let extra = statMenu(bot, ref);
    extra.parse_mode = 'HTML';

    let stat = await refstat.getPeriodStat(bot, ref, periodType);
    return ctx.editMessageText(getStatMessage(bot, stat), extra);
});

app.launch();
bus.listenCommands();