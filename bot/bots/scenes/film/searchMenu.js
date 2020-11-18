const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');

module.exports = function (filmManager) {
    const scene = new BaseScene('searchMenu');

    scene.enter(async ctx => {
        return ctx.reply('Что ищем?', menu([
            {code: 'type_tv', text: 'Сериальчик'},
            {code: 'type_movie', text: 'Киношку'},
        ]))
    });

    scene.action(/type_(.*)/, async ctx => {
        let searchType = ctx.match[1];
        ctx.session.searchType = searchType;
        return ctx.scene.enter('discover');
    });

    return scene;
}