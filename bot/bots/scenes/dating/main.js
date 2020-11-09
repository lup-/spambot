const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');

function mainMenu(ctx) {
    let seekButton = ctx.session.profile.stopped
        ? {code: 'start', text: '🚀 Начать поиск'}
        : {code: 'stop', text: '🚫 Останосить поиск'};

    return menu([
        {code: 'rateProfiles', text: '❤ Оценить других'},
        {code: 'profileWizard', text: '✏ Поменять мою анкету'},
        seekButton,
    ], true);
}

module.exports = function (datingManager) {
    const scene = new BaseScene('mainMenu');

    scene.enter(ctx => {
        return ctx.reply('Что дальше?', mainMenu(ctx));
    });

    scene.action('rateProfiles', ctx => ctx.scene.enter('rateProfiles'));
    scene.action('profileWizard', ctx => ctx.scene.enter('profileWizard'));
    scene.action('stop', async ctx => {
        ctx.session.profile = await datingManager.stopSeeking(ctx.session.profile);
        await ctx.reply('Ваша анкета скрыта из поиска');
        return ctx.scene.reenter();
    });
    scene.action('start', async ctx => {
        ctx.session.profile = await datingManager.startSeeking(ctx.session.profile);
        await ctx.reply('Ваша анкета снова в поиске');
        return ctx.scene.reenter();
    });

    scene.use(ctx => ctx.reply('Выбери что-то из меню', mainMenu(ctx)));

    return scene;
}

