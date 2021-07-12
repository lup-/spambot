const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {getUserLinkGroups, getLinkGroupStat} = require('../../actions/linkProcessing');

async function showCountsForGroup(groupName, ctx) {
    let linkStats = await getLinkGroupStat(ctx.from, ctx.scene.state.chat.id, groupName);
    let statText = linkStats.map(stat => `${stat.hash}: ${stat.count}`).join('\n');

    return ctx.replyWithHTML(`<b>Статистика ссылок группы "${groupName}"</b>\n\n<code>${statText}</code>`);
}

module.exports = function () {
    const scene = new BaseScene('linksStat');

    scene.enter(async ctx => {
        let groupName = ctx.scene.state.group;
        let hasGroup = Boolean(groupName);

        if (hasGroup) {
            await showCountsForGroup(groupName, ctx);
            return ctx.scene.enter('linkGroupMenu', {chat: ctx.scene.state.chat, group: groupName});
        }
        else {
            let linkGroups = await getUserLinkGroups(ctx.from, ctx.scene.state.chat.id);
            let buttons = linkGroups.map(text => ({text, code: `group_${text}`}));
            buttons.push({code: 'back', text: '⬅ В меню работы со ссылками'},)
            let linkGroupsMenu = menu(buttons, 1);

            return ctx.replyWithDisposableHTML(`<b>Cтатистика ссылок</b>
                
Укажите группу ссылок для просмотра статистики вступлений`, linkGroupsMenu);
        }
    });

    scene.action(/group_(.*)/, async ctx => {
        let groupName = ctx.match[1] ? ctx.match[1] : false;
        await showCountsForGroup(groupName, ctx);
        return ctx.scene.reenter();
    });

    scene.action('back', ctx => ctx.scene.enter('linkGroupMenu', {chat: ctx.scene.state.chat, group: ctx.scene.state.group}));

    return scene;
}