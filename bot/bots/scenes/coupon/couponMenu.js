const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');

module.exports = function () {
    const scene = new BaseScene('couponMenu');

    scene.enter(async ctx => {
        ctx.session.nav = false;
        return ctx.replyWithHTML(
            __('Что интересует?', ['main', 'menu', 'start']),
            menu([
                {code: 'type_coupons', text: 'Купоны'},
                {code: 'type_products', text: 'Товары'},
                {code: 'type_cashback', text: 'Кэшбэк'},
                {code: 'settings', text: 'Категории'},
            ], 1)
        )
    });

    scene.action(/type_(.*)/, async ctx => {
        let type = ctx.match[1];
        return ctx.scene.enter('tryLuck', {type});
    });

    scene.action('settings', ctx => ctx.scene.enter('settings'));

    return scene;
}