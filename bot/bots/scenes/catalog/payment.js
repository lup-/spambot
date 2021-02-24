const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');

module.exports = function (params) {
    const scene = new BaseScene('payment');
    const {payment} = params;

    scene.enter(async ctx => {
        let item = ctx.scene.state.item;
        let hasPrice = item && item.price && item.price > 0;

        if (!hasPrice) {
            return ctx.scene.enter('discover');
        }

        let paymentUrl = await payment.addPaymentAndGetPaymentUrl(ctx, item);
        let text = `После нажатия на кнопку вы будете направлены на страницу для совершения оплаты.

Пожалуйста, используйте кнопку эту оплаты только один раз`
        let buttons = [{text: `Оплатить ${item.price} руб`, url: paymentUrl}];
        return ctx.safeReply(
            ctx => ctx.editMessageText(text, menu(buttons)),
            ctx => ctx.reply(text, menu(buttons)),
            ctx
        );

    });

    return scene;
}