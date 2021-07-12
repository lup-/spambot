const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {getUserLinks, getUserLinkGroups, removeLinkGroup, getUrlFromLinkData} = require('../../actions/linkProcessing');

module.exports = function () {
    const scene = new BaseScene('linkGroupMenu');

    scene.enter(async ctx => {
        let chat = ctx.scene.state.chat;
        let groupName = ctx.scene.state.group;
        let canShowStat = chat && chat.options && chat.options.useUserbot;

        let linksMenu = canShowStat
            ? menu([
                {code: 'listLinks', text: 'Список ссылок'},
                {code: 'linksStat', text: 'Статистика ссылок'},
                // {code: 'downloadStat', text: 'Выгрузить статистику'},
                {code: 'deleteLinkGroup', text: 'Удалить эту группу ссылок'},
                {code: 'deleteAllLinks', text: 'Безвозвратно очистить все ссылки'},
                {code: 'back', text: '⬅ В меню работы с каналом'},
            ], 1)
            : menu([
                {code: 'listLinks', text: 'Список ссылок'},
                {code: 'deleteLinkGroup', text: 'Удалить эту группу ссылок'},
                {code: 'deleteAllLinks', text: 'Безвозвратно очистить все ссылки'},
                {code: 'back', text: '⬅ В меню работы с каналом'},
            ], 1);

        return ctx.replyWithDisposableHTML(`<b>Работа со ссылками</b>\n\nПроект: ${chat.title}\nГруппа: ${groupName}`, linksMenu);
    });

    scene.action('listLinks', async ctx => {
        let targetChat = ctx.scene.state.chat;
        let groupName = ctx.scene.state.group;
        let user = ctx.from;
        let chatLinks = await getUserLinks(user, targetChat.id, groupName);

        let linksText = chatLinks.map(getUrlFromLinkData).filter(url => url && url.length > 0);
        let linkListPost = `<b>Список ссылок группы ${groupName}</b>\n\n${linksText.join('\n')}`;

        await ctx.replyWithHTML(linkListPost);
        return ctx.scene.reenter();
    });
    scene.action('linksStat', ctx => ctx.scene.enter('linksStat', {chat: ctx.scene.state.chat, group: ctx.scene.state.group}));
    scene.action('deleteLinkGroup', async ctx => {
        let groupName = ctx.scene.state.group;
        ctx.scene.state.waiting = 'deleteLinkGroup';
        let messageText = `<b>Удаление группы ссылок "${groupName}"</b>\n\nНапишите "Да" для удаления всех ссылок в группе "${groupName}" или нажмите кнопку "Отмена"`;
        return ctx.replyWithDisposableHTML(messageText, menu([{code: 'cancel', text: 'Отмена'}]));
    });
    scene.action('deleteAllLinks', async ctx => {
        ctx.scene.state.waiting = 'deleteAllLinks';
        let chat = ctx.scene.state.chat;
        let messageText = `<b>Удаление ВСЕХ ссылок для канала ${chat.title}</b>\n\nНапишите "Да" для удаления всех ссылок или нажмите кнопку "Отмена"`;
        return ctx.replyWithDisposableHTML(messageText, menu([{code: 'cancel', text: 'Отмена'}]));
    });
    scene.action('back', ctx => ctx.scene.enter('linksMenu', {chat: ctx.scene.state.chat}));
    scene.action('cancel', ctx => {
        ctx.scene.state.waiting = null;
        return ctx.scene.reenter();
    });

    scene.on('message', async (ctx, next) => {
        let chat = ctx.scene.state.chat;
        let post = ctx && ctx.update && ctx.update.message
            ? ctx.update.message
            : null;

        if (ctx.scene.state.waiting === 'deleteLinkGroup') {
            let agreeText = post.text.toLowerCase();
            if (agreeText === 'да') {
                let groupName = ctx.scene.state.group;
                let noErrors = await removeLinkGroup(ctx.from, chat, groupName, ctx.telegram);
                await ctx.replyWithHTML(noErrors
                    ? `Группа "${groupName}" удалена успешно`
                    : `Удаление группы "${groupName}" завершено с ошибками`);
                return ctx.scene.enter('linksMenu', {chat: ctx.scene.state.chat});
            }
        }

        if (ctx.scene.state.waiting === 'deleteAllLinks') {
            let agreeText = post.text.toLowerCase();
            if (agreeText === 'да') {
                let noErrors = await removeLinkGroup(ctx.from, chat, false, ctx.telegram);
                await ctx.replyWithHTML(noErrors
                    ? `Ссылки для канала "${chat.title}" удалены успешно`
                    : `Удаление ссылок для канала "${chat.title}" завершено с ошибками`);
                return ctx.scene.enter('linksMenu', {chat: ctx.scene.state.chat});
            }
        }

        return ctx.scene.reenter();
    });

    return scene;
}