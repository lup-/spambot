const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');

module.exports = function () {
    const scene = new BaseScene('selectSettings');

    scene.enter(async ctx => {
        return ctx.reply('Что хотите поменять?', menu([
            {code: 'category', text: 'Категории'},
            {code: 'sort', text: 'Сортировку'},
        ]));
    });

    scene.action('category', ctx => ctx.scene.enter('settings', {route: 'category'}));
    scene.action('sort', ctx => ctx.scene.enter('settings', {route: 'sort'}));

    return scene;
}
