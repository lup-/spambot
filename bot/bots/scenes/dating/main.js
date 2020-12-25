const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');

function mainMenu(ctx) {
    let seekButton = ctx.session.profile && ctx.session.profile.stopped
        ? {code: 'start', text: '🚀 Начать поиск'}
        : {code: 'stop', text: '🚫 Остановить поиск'};

    return menu([
        {code: 'rateProfiles', text: '❤ Оценить других'},
        {code: 'rateFans', text: '❤❤ Посмотреть лайкнувших'},
        {code: 'profileWizard', text: '✏ Поменять мою анкету'},
        seekButton,
        {code: 'settings', text: '🎨 Настройки поиска'},
    ], true);
}

function hasFilledProfile(ctx) {
    return ctx.session && ctx.session.profile && ctx.session.profile.name;
}

module.exports = function (datingManager) {
    const scene = new BaseScene('mainMenu');

    scene.enter(ctx => {
        return ctx.safeReply(ctx => ctx.reply(
            __('Что дальше?', ['main', 'menu', 'start']),
        mainMenu(ctx)), null, ctx);
    });

    scene.action('rateProfiles', ctx => hasFilledProfile(ctx)
        ? ctx.scene.enter('rateProfiles')
        : ctx.scene.enter('profileWizard'));
    scene.action('profileWizard',  ctx => ctx.scene.enter('profileWizard'));
    scene.action('stop', async ctx => {
        let hasProfile = hasFilledProfile(ctx);
        if (!hasProfile) {
            return ctx.scene.enter('profileWizard');
        }

        ctx.session.profile = await datingManager.stopSeeking(ctx.session.profile);
        await ctx.reply('Ваша анкета скрыта из поиска');
        return ctx.scene.reenter();
    });
    scene.action('start', async ctx => {
        let hasProfile = ctx.session && ctx.session.profile;
        if (!hasProfile) {
            return ctx.scene.enter('profileWizard');
        }

        ctx.session.profile = await datingManager.startSeeking(ctx.session.profile);
        await ctx.reply('Ваша анкета снова в поиске');
        return ctx.scene.reenter();
    });
    scene.action('rateFans', ctx => hasFilledProfile(ctx)
        ? ctx.scene.enter('rateFans')
        : ctx.scene.enter('profileWizard'));
    scene.action('settings', ctx => hasFilledProfile(ctx)
        ? ctx.scene.enter('settings')
        : ctx.scene.enter('profileWizard'));
    scene.use(ctx => ctx.reply('Выбери что-то из меню', mainMenu(ctx)));

    return scene;
}

