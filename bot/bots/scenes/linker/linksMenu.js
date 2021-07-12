const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {getUserLinks, getUserLinkGroups, removeLinkGroup} = require('../../actions/linkProcessing');

module.exports = function () {
    const scene = new BaseScene('linksMenu');

    scene.enter(async ctx => {
        let chat = ctx.scene.state.chat;

        let linksMenu = menu([
                {code: 'addLinks', text: 'Добавить ссылки'},
                {code: 'listLinks', text: 'Список ссылок'},
                {code: 'back', text: '⬅ В меню выбора каналов'},
            ], 1);

        return ctx.replyWithDisposableHTML(`<b>Работа со ссылками</b>\n\nПроект: ${chat.title}`, linksMenu);
    });

    scene.action('addLinks', ctx => ctx.scene.enter('menu', {chat: ctx.scene.state.chat}));
    scene.action('listLinks', async ctx => {
        let targetChat = ctx.scene.state.chat;
        let user = ctx.from;
        let chatLinks = await getUserLinks(user, targetChat.id);

        let grouppedLinks = chatLinks.reduce( (groups, link) => {
            let groupTitle = link.title || 'Без группы';

            if (typeof (groups[groupTitle]) === 'undefined') {
                groups[groupTitle] = [];
            }

            groups[groupTitle].push({groupTitle, link: link.newLink});

            return groups;
        }, {});

        let groupTitles = Object.keys(grouppedLinks);
        let linksText = groupTitles.map(groupTitle => `<code>${groupTitle}</code>: ${grouppedLinks[groupTitle].length} ссылок`);
        let linkListPost = `<b>Список ссылок</b>\n\n${linksText.join('\n')}\n\nУкажите группу, с которой будете работать`;

        let buttons = groupTitles.map(text => ({text, code: `group_${text}`}));
        buttons.push({code: 'cancel', text: '⬅ Назад'},)

        let linksMenu = menu(buttons, 1);

        return ctx.replyWithHTML(linkListPost, linksMenu);
    });
    scene.action('cancel', ctx => {
        return ctx.scene.reenter();
    });
    scene.action(/group_(.*)/, async ctx => {
        let groupName = ctx.match[1] ? ctx.match[1] : false;
        return ctx.scene.enter('linkGroupMenu', {chat: ctx.scene.state.chat, group: groupName});
    });

    return scene;
}