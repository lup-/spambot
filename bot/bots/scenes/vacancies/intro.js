const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');

function routeToNextStep(ctx, sceneId = 'discover') {
    try {
        let hasPassedSettings = ctx.session && ctx.session.profile && ctx.session.profile.category;
        if (hasPassedSettings) {
            return ctx.scene.enter(sceneId);
        }
        else {
            return ctx.scene.enter('settings');
        }
    }
    catch (e) {}
}

module.exports = function ({disclaimer, periodic, vacancies, saveSettings}) {
    const scene = new BaseScene('intro');

    scene.enter(async ctx => {
        let messageShown = ctx.session.introShown || false;

        let subscribeButton = ctx.session.profile.subscribed
            ? {code: 'unsubscribe', text: 'Отказаться от рассылки'}
            : {code: 'subscribe', text: 'Подписаться на вакансии'};

        let hasResume = false;
        let userId = ctx.session.userId || false;
        if (userId) {
            hasResume = await vacancies.hasResume(userId);
        }

        let resumeButton = hasResume
            ? {code: 'resume', text: 'Изменить резюме'}
            : {code: 'resume', text: 'Создать резюме'};

        if (messageShown) {
            let buttons = [
                {code: 'list', text: 'Список вакансий'},
                {code: 'settings', text: 'Настройки поиска'},
                resumeButton,
                //subscribeButton,
            ];

            return ctx.reply('Куда дальше?', menu(buttons, 1));
        }

        try {
            ctx.session.introShown = true;
            return ctx.reply(__(disclaimer.text, disclaimer.tags), menu([{code: 'accept', text: 'Понятно'}]));
        }
        catch (e) {
        }
    });

    scene.action('accept', ctx => ctx.scene.reenter());
    scene.action('settings', ctx => ctx.scene.enter('settings'));
    scene.action('list', ctx => routeToNextStep(ctx));
    scene.action('resume', ctx => routeToNextStep(ctx, 'resume'));
    scene.action('mailing', ctx => routeToNextStep(ctx, 'mailing'));

    scene.action('subscribe', async ctx => {
        ctx.session.profile.subscribed = true;
        await saveSettings(ctx.session.profile, ctx);
        await periodic.subscribe(ctx.session.profile, vacancies.getNextRemindDate());

        if (!ctx.session.subscribeShown) {
            let text = `В этой вкладке вы будете получать актуальные вакансии по вашим критериям поиска.
Обновление происходит каждый день в 11 МСК. Не забывайте заглядывать и проверять.
Это системное сообщение, оно выводится один раз`;
            await ctx.safeReply(
                ctx => ctx.editMessageText(text),
                ctx => ctx.reply(text),
                ctx
            );

            ctx.session.subscribeShown = true;
            await ctx.reply(__('Вы подписались на новые вакансии.', ['subscribe', 'info', 'success']));
        }
        else {
            await ctx.safeReply(
                ctx => ctx.editMessageText(__('Вы подписались на новые вакансии.', ['subscribe', 'info', 'success'])),
                ctx => ctx.reply(__('Вы подписались на новые вакансии.', ['subscribe', 'info', 'success'])),
                ctx
            );
        }

        return ctx.scene.reenter();
    });

    scene.action('unsubscribe', async ctx => {
        ctx.session.profile.subscribed = false;
        await saveSettings(ctx.session.profile, ctx);
        await periodic.unsubscribe(ctx.session.profile);

        await ctx.safeReply(
            ctx => ctx.editMessageText(__('Вы отписались от рассылки. Новые вакансии больше не будут приходить.', ['unsubscribe', 'info'])),
            ctx => ctx.reply(__('Вы отписались от рассылки. Новые вакансии больше не будут приходить.', ['unsubscribe', 'info'])),
            ctx
        );

        return ctx.scene.reenter();
    });

    return scene;
}