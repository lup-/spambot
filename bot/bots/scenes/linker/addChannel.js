const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {getSingleChatInfo, saveUserChatInfo, checkAdminAccess, checkAddAdminRights, addUserbotToChat} = require('../../actions/linkProcessing');


module.exports = function () {
    const scene = new BaseScene('addChannel');

    scene.enter(async ctx => {
        return ctx.replyWithDisposableHTML(`<b>Добавление канала</b>

1. Добавьте бота в администраторы, чтобы он мог генерировать ссылки
и потом
2. Пришлите ссылку на группу или канал

Для доступа к статистике ссылок нужно дать боту права на добавление администраторов, так как для
получения данных о статистике используется дополнительный бот.
`);
    });

    scene.on('message', async (ctx, next) => {
        let post = ctx && ctx.update && ctx.update.message
            ? ctx.update.message
            : null;

        let link = post.text;
        let chat = await getSingleChatInfo(link, ctx);
        let user = ctx.from;

        let isAdmin = await checkAdminAccess(chat, ctx);
        let hasAddAdminRights = await checkAddAdminRights(chat, ctx);

        if (chat && user) {
            if (isAdmin) {
                let options = {useUserbot: false}

                if (hasAddAdminRights) {
                    let userbotAdded = await addUserbotToChat(chat, ctx);

                    if (userbotAdded) {
                        await ctx.reply(`В чат был добавлен новый бот-администратор: ${ctx.userbot ? '@'+ctx.userbot.username : '-'}.
                            Этому боту даны минимальные права, чтобы он мог управлять ссылками и приглашать пользователей.`);
                        options.useUserbot = true;
                    }
                    else {
                        await ctx.reply(`При добавлении дополнительного бота в канал возникла ошибка. Статистика по ссылкам будет отключена.`);
                    }
                }

                await saveUserChatInfo(chat, user, options);
                ctx.scene.state.chat = chat;

                return ctx.scene.enter('linksMenu', {chat});
            }
            else {
                return ctx.replyWithDisposableHTML('На этот чат у бота нет админских прав. Пожалуйста, сделайте бота админом и пришлите ссылку снова');
            }
        }
        else {
            return ctx.replyWithDisposableHTML('Группа или канал не найдены, попробуйте скинуть другую ссылку');
        }

        ctx.markMessageToDelete(ctx, ctx.update.message);

        return ctx.scene.reenter();
    });


    return scene;
}