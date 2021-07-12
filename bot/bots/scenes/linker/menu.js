const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');

module.exports = function () {
    const scene = new BaseScene('menu');

    scene.enter(async ctx => {
        let chat = ctx.scene.state.chat;
        return ctx.replyWithDisposableHTML(`<b>Новые ссылки</b>\n\nПроект: ${chat.title}`, menu([
            {code: 'post', text: 'Сгенерировать посты по шаблону'},
            {code: 'linksOnly', text: 'Выдать пачку ссылок'},
            {code: 'back', text: '⬅ В меню проекта'},
        ], 1));
    });

    scene.action('post', ctx => ctx.scene.enter('post', {chat: ctx.scene.state.chat}));
    scene.action('linksOnly', ctx => ctx.scene.enter('linksOnly', {chat: ctx.scene.state.chat}));
    scene.action('back', ctx => ctx.scene.enter('linksMenu', {chat: ctx.scene.state.chat}));

    return scene;
}