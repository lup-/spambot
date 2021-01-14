const BaseScene = require('telegraf/scenes/base');

module.exports = function (params) {
    const {getBookList, sceneCode, discoverSceneCode} = params;

    const scene = new BaseScene(sceneCode);

    scene.enter(async ctx => {
        ctx.session.delaySubscribeCheck = false;
        ctx.perfStart('searchIntro');
        await ctx.safeReply(
            ctx => ctx.editMessageText('Напишите запрос и я поищу подходящие книги'),
            ctx => ctx.reply('Напишите запрос и я поищу подходящие книги'),
            ctx
        );
        ctx.perfStop('searchIntro');
        await ctx.perfCommit();
    });

    scene.on('text', async ctx => {
        let query = ctx.update.message && ctx.update.message.text
            ? ctx.update.message.text.replace(/[^a-zа-яё0-9 ]/ig, '').trim()
            : false;

        if (!query) {
            return ctx.scene.reenter();
        }

        ctx.perfStart('searchMsg');
        let message = await ctx.reply('Ищу...');
        ctx.perfStop('searchMsg');

        ctx.perfStart('queryBookList');
        let items = await getBookList(query);
        ctx.perfStop('queryBookList');

        ctx.perfStart('deleteSearchMsg');
        await ctx.deleteMessage(message.message_id);
        ctx.perfStop('deleteSearchMsg');

        await ctx.perfCommit();

        if (items.length > 0) {
            return ctx.scene.enter(discoverSceneCode, {items, backCode: sceneCode});
        }
        else {
            return ctx.reply('Ничего не найдено, попробуйте другой запрос');
        }
    });

    return scene;
}