const BaseScene = require('telegraf/scenes/base');

module.exports = function (params) {
    const {getBookList, sceneCode, discoverSceneCode} = params;

    const scene = new BaseScene(sceneCode);

    scene.enter(async ctx => {
        return ctx.reply('Напишите запрос и я поищу подходящие книги');
    });

    scene.on('text', async ctx => {
        let query = ctx.update.message && ctx.update.message.text
            ? ctx.update.message.text.replace(/[^a-zа-яё ]/ig, '').trim()
            : false;

        if (!query) {
            return ctx.scene.reenter();
        }

        let message = await ctx.reply('Ищу...');
        let items = await getBookList(query);
        await ctx.deleteMessage(message.message_id);

        if (items.length > 0) {
            return ctx.scene.enter(discoverSceneCode, {items, backCode: sceneCode});
        }
        else {
            return ctx.reply('Ничего не найдено, попробуйте другой запрос');
        }
    });

    return scene;
}