const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');
const {init} = require('../../../managers');
const booksManager = init('books');

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

                await removeKeyboard(ctx);

                return ctx.safeReply(
                    ctx => ctx.editMessageText('Куда дальше?', menu(buttons)),
                    ctx => ctx.reply('Куда дальше?', menu(buttons)),
                    ctx
                );
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