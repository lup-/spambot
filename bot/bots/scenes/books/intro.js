const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');

function books(ctx) {
    return ctx.scene.enter('bookSearch');
}

function audioBooks(ctx) {
    return ctx.scene.enter('audioSearch');
}

async function removeKeyboard(ctx) {
    try {
        let message = await ctx.reply('Куда дальше?', {reply_markup: {remove_keyboard: true}});
        await ctx.deleteMessage(message.message_id);
    }
    catch (e) {}
}

module.exports = function (params) {
    const scene = new BaseScene('intro');
    const {disclaimer, onlyBooks} = params;

    scene.enter(async ctx => {
        let messageShown = ctx.session.introShown || false;

        if (messageShown) {
            if (!onlyBooks) {
                let buttons = [];

                buttons.push({code: 'book', text: 'Найти книгу'});
                buttons.push({code: 'audiobook', text: 'Найти аудиокнигу'});

                ctx.perfStart('removeKeyboard');
                await removeKeyboard(ctx);
                ctx.perfStop('removeKeyboard');

                ctx.perfStart('introReply');
                await ctx.safeReply(
                    ctx => ctx.editMessageText('Куда дальше?', menu(buttons)),
                    ctx => ctx.reply('Куда дальше?', menu(buttons)),
                    ctx
                );
                ctx.perfStop('introReply');
                return await ctx.perfCommit();
            }
            else {
                return books(ctx);
            }
        }

        try {
            ctx.session.introShown = true;
            let extra = menu([{code: 'accept', text: 'Понятно'}]);
            return ctx.reply(__(disclaimer.text, disclaimer.tags), extra);
        }
        catch (e) {
        }
    });

    scene.action('accept', ctx => ctx.scene.reenter());
    scene.action('book', books);
    scene.action('audiobook', audioBooks);

    return scene;
}