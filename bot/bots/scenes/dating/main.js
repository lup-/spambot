const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');

function mainMenu(ctx) {
    let seekButton = ctx.session.profile && ctx.session.profile.stopped
        ? {code: 'start', text: '🚀 Начать поиск'}
        : {code: 'stop', text: '🚫 Остановить поиск'};

    return menu([
        {code: 'rateProfiles', text: '❤ Оценить других'},
        {code: 'rateFans', text: '❤❤ Посмотрель лайкнувших'},
        {code: 'profileWizard', text: '✏ Поменять мою анкету'},
        seekButton,
        {code: 'settings', text: '🎨 Настройки поиска'},
    ], true);
}

module.exports = function (datingManager) {
    const scene = new BaseScene('mainMenu');

    scene.enter(ctx => {
        return ctx.safeReply(ctx => ctx.reply(
            __('Что дальше?', ['main', 'menu', 'start']),
        mainMenu(ctx)), null, ctx);
    });

    scene.action('rateProfiles', ctx => ctx.session && ctx.session.profile
        ? ctx.scene.enter('rateProfiles')
        : ctx.scene.enter('mainMenu'));
    scene.action('profileWizard', ctx => ctx.session && ctx.session.profile
        ? ctx.scene.enter('profileWizard')
        : ctx.scene.enter('mainMenu'));
    scene.action('stop', async ctx => {
        let hasProfile = ctx.session && ctx.session.profile;
        if (!hasProfile) {
            return ctx.scene.enter('mainMenu');
        }

        ctx.session.profile = await datingManager.stopSeeking(ctx.session.profile);
        await ctx.reply('Ваша анкета скрыта из поиска');
        return ctx.scene.reenter();
    });
    scene.action('start', async ctx => {
        let hasProfile = ctx.session && ctx.session.profile;
        if (!hasProfile) {
            return ctx.scene.enter('mainMenu');
        }

        ctx.session.profile = await datingManager.startSeeking(ctx.session.profile);
        await ctx.reply('Ваша анкета снова в поиске');
        return ctx.scene.reenter();
    });
    scene.action('rateFans', ctx => ctx.session && ctx.session.profile
        ? ctx.scene.enter('rateFans')
        : ctx.scene.enter('mainMenu'));
    scene.action('settings', ctx => ctx.session && ctx.session.profile
        ? ctx.scene.enter('settings')
        : ctx.scene.enter('mainMenu'));
    scene.use(ctx => ctx.reply('Выбери что-то из меню', mainMenu(ctx)));

    return scene;
}

