const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');

function cityMenu(settings) {
    return menu([
        {code: 'city_yes', text: settings.city ? '☑ Да' : 'Да'},
        {code: 'city_no', text: settings.city ? 'Нет' : '☑ Нет'},
    ]);
}

function ageMenu(settings) {
    return menu([
        {code: 'age_gt', text: settings.age === 'gt' ? '☑ Старше меня' : 'Старше меня'},
        {code: 'age_lt', text: settings.age === 'lt' ? '☑ Младше меня' : 'Младше меня'},
        {code: 'age_approx', text: settings.age === 'approx' ? '☑ Моего возраста' : 'Моего возраста'},
        {code: 'age_disable', text: !settings.age ? '☑ Не важен' : 'Не важен'},
    ], true);
}


module.exports = function (datingManager) {
    const scene = new BaseScene('settings');

    scene.enter(async ctx => {
        let currentProfile = ctx.session.profile;
        let settings = datingManager.settings(currentProfile);

        await ctx.reply('Задайте настройки поиска');
        await ctx.reply('Учитывать город?', cityMenu(settings));
        await ctx.reply('Возраст?', ageMenu(settings));
        return ctx.reply('После настройки нажмите', menu([{code: 'ready', text: 'Готово'}]));
    });

    scene.action(/city_(.*)/, async ctx => {
        let newValue = ctx.match[1] === 'yes';
        let currentProfile = ctx.session.profile;
        let settings = datingManager.settings(currentProfile);
        settings.city = newValue;
        ctx.session.profile.settings = settings;
        ctx.editMessageText('Учитывать город?', cityMenu(settings))
    });

    scene.action(/age_(.*)/, async ctx => {
        let newValue = ctx.match[1] === 'disable' ? false : ctx.match[1];
        let currentProfile = ctx.session.profile;
        let settings = datingManager.settings(currentProfile);
        settings.age = newValue;
        ctx.session.profile.settings = settings;
        ctx.editMessageText('Возраст?', ageMenu(settings))
    });

    scene.action('ready', async ctx => {
        if (ctx.session.profile) {
            await datingManager.saveProfile(ctx.session.profile);
        }
        return ctx.scene.enter('mainMenu');
    });

    return scene;
}
