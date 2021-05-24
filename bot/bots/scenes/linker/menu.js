const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');

module.exports = function () {
    const scene = new BaseScene('menu');

    scene.enter(async ctx => {
        return ctx.replyWithDisposableHTML('Что дальше?', menu([
            {code: 'post', text: 'Новый пост'},
            {code: 'linksOnly', text: 'Просто ссылки'},
            {code: 'stat', text: 'Статистика'},
        ], 1));
    });

    scene.action('post', ctx => ctx.scene.enter('post'));
    scene.action('linksOnly', ctx => ctx.scene.enter('linksOnly'));
    scene.action('stat', ctx => ctx.scene.enter('stat'));

    return scene;
}