const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');

function rateMenu(ctx, profile) {
    return menu([
        {code: 'like_'+profile.id, text: '❤'},
        {code: 'skip_'+profile.id, text: '⏩'},
        {code: 'back', text: '↩ Меню'},
    ]);
}

module.exports = function (datingManager, userFansList = false, telegram) {
    const sceneName = userFansList
        ? 'rateFans'
        : 'rateProfiles';

    const scene = new BaseScene(sceneName);

    scene.enter(async ctx => {
        let currentProfile = ctx.session.profile;
        let profileToRate = userFansList
            ? await datingManager.myNextLike(currentProfile)
            : await datingManager.randomProfile(currentProfile);

        let profileText = datingManager.getProfileText(profileToRate)

        let extra = rateMenu(ctx, profileToRate);
        extra.caption = profileText;
        return ctx.replyWithPhoto(profileToRate.photo.file_id, extra);
    });

    scene.action(/like_(.*)/, async ctx => {
        let targetId = ctx.match[1];
        ctx.session.profile = await datingManager.like(targetId, ctx.session.profile);
        let isDoubleLike = await datingManager.isDoubleLike(targetId, ctx.session.profile);
        let targetProfile = await datingManager.loadProfileById(targetId);

        if (isDoubleLike) {
            let userLink = `[написать](tg://user?id=${targetProfile.userId})`;
            await ctx.replyWithMarkdown('Симпатия взаимная, можно '+userLink);
        }
        else {
            let chatId = targetProfile.chatId || targetProfile.userId;
            await telegram.sendMessage(chatId, 'Ваша анкета кому-то понравилась', menu([
                {code: 'rateFans', text: 'Посмотреть'}
            ]));
        }

        return ctx.scene.reenter();
    });

    scene.action(/skip_(.*)/, async ctx => {
        let targetId = ctx.match[1];
        ctx.session.profile = await datingManager.skip(targetId, ctx.session.profile);
        return ctx.scene.reenter();
    });

    scene.action('back', ctx => ctx.scene.enter('mainMenu'))

    scene.use(ctx => ctx.scene.reenter());
    return scene;
}