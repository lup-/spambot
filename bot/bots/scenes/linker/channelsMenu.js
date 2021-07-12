const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {getUserLinkedChats, getSingleChatInfoById} = require('../../actions/linkProcessing');

module.exports = function () {
    const scene = new BaseScene('channelsMenu');

    scene.enter(async ctx => {
        let channelsMenu = menu([
            {code: 'addChannel', text: 'Подключить канал'},
            {code: 'listChannels', text: 'Список подключенных каналов'},
            {code: 'generateLinks', text: 'Сгенерировать ссылки'},
        ], 1);

        return ctx.replyWithDisposableHTML(`<b>Работа с каналами</b>`, channelsMenu);
    });

    scene.action('addChannel', ctx => ctx.scene.enter('addChannel'));
    scene.action(['listChannels', 'generateLinks'], async ctx => {
        let action = ctx.update.callback_query.data;
        let user = ctx.from;
        let channels = await getUserLinkedChats(user);
        if (channels.length > 0) {
            let channelButtons = channels.map(channel => ({code: `goto_channel_${channel.id}_${action}`, text: channel.title}));
            channelButtons.push({code: 'back', text: '⬅ В главное меню'})
            let gotoChannelsMenu = menu(channelButtons, 1);
            return ctx.replyWithDisposableHTML(`<b>Выберите канал</b>`, gotoChannelsMenu);
        }
        else {
            await ctx.replyWithDisposableHTML(`Список каналов пуст`, menu([{code: 'back', text: '⬅ В главное меню'}], 1));
            return ctx.scene.reenter();
        }
    });
    scene.action('back', ctx => ctx.scene.reenter());
    scene.action(/goto_channel_(.*?)_(.*)/, async ctx => {
        let channelId = ctx.match[1] ? ctx.match[1] : false;
        let action = ctx.match[2] ? ctx.match[2] : false;

        let chat = await getSingleChatInfoById(channelId, ctx);

        if (chat) {
            return action === 'generateLinks'
                ? ctx.scene.enter('menu', {chat})
                : ctx.scene.enter('linksMenu', {chat});
        }

        await ctx.replyWithDisposableHTML(`Не удалось найти выбранный канал`);
        return ctx.scene.reenter();
    });

    return scene;
}