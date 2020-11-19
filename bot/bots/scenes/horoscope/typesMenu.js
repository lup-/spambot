const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');

function typesMenu(horoscopeManager) {
    return menu( horoscopeManager.listTypes().map(type => {
        return {code: 'type_'+type.code, text: type.title};
    }), 1 );
}

module.exports = function (horoscopeManager) {
    const scene = new BaseScene('typesMenu');

    scene.enter(async ctx => {
        ctx.session.type = false;
        return ctx.reply('Какой гороскоп показать?', typesMenu(horoscopeManager));
    });

    scene.action(/type_(.*)/, async ctx => {
        let typeCode = ctx.match[1];
        ctx.session.type = typeCode;
        return ctx.scene.enter('viewHoroscope');
    });

    return scene;
}