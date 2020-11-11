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
        if (!currentProfile) {
            await ctx.reply('Что-то пошло не по плану');
            return ctx.scene.enter('mainMenu');
        }

        let profileToRate = userFansList
            ? await datingManager.myNextLike(currentProfile)
            : await datingManager.randomProfile(currentProfile);

        if (!profileToRate) {
            await ctx.reply('Похоже, что тут пусто');
            return ctx.scene.enter('mainMenu');
        }

        let profileText = datingManager.getProfileText(profileToRate)

        let extra = rateMenu(ctx, profileToRate);
        extra.caption = profileText;
        return ctx.replyWithPhoto(profileToRate.photo.file_id, extra);
    });

    scene.action(/like_(.*)/, async ctx => {
        let targetId = ctx.match[1];
        let currentProfile = ctx.session.profile;
        ctx.session.profile = await datingManager.like(targetId, currentProfile);
        let isDoubleLike = await datingManager.isDoubleLike(targetId, currentProfile);
        let targetProfile = await datingManager.loadProfileById(targetId);

        if (isDoubleLike) {
            let chatId = targetProfile.chatId || targetProfile.userId;
            let remoteProfileText = datingManager.getProfileText(currentProfile);
            let remoteMessage = `Взаимная симпания!\n\n${remoteProfileText}\n\n<a href="tg://user?id=${currentProfile.userId}">✉ Написать</a>`;
            await telegram.sendPhoto(chatId, currentProfile.photo.file_id, {caption: remoteMessage, parse_mode: 'html'});

            let userLink = `[✉ Написать](tg://user?id=${targetProfile.userId})`;
            await ctx.replyWithMarkdown('Взаимная симпатия! ❤\n\n'+userLink);
            return ctx.reply('Для продолжения работы нажмите /start');
        }
        else {
            let chatId = targetProfile.chatId || targetProfile.userId;
            await telegram.sendMessage(chatId, 'Ваша анкета кому-то понравилась', menu([
                {code: 'rateFans', text: 'Оценить лайкнувших'}
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