const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {markMessageToDelete} = require('../../../modules/deleteMessageMiddleware');

module.exports = function (params) {
    const scene = new BaseScene('payment');
    const {payment} = params;

    scene.enter(async ctx => {
        let item = ctx.scene.state.item;
        let hasPrice = item && item.price && item.price > 0;

        if (!hasPrice) {
            return ctx.scene.enter('discover');
        }

        let newPayment = await payment.addPaymentAndSaveToDb(ctx, item);
        let text = `После нажатия на кнопку вы будете направлены на страницу для совершения оплаты.

Пожалуйста, используйте кнопку эту оплаты только один раз и дождитесь сообщения о статусе оплаты`
        let buttons = [{text: `Оплатить ${item.price} руб`, url: newPayment.paymentUrl}, {text: 'Назад', code: `cancel_${newPayment.id}`}];
        let paymentMessage = await ctx.replyWithHTML(text, menu(buttons));
        markMessageToDelete(ctx, paymentMessage);
        return paymentMessage;
    });

    scene.action(/cancel_(.*)/ , async ctx => {
        let paymentId = ctx.match[1];
        try {
            await payment.cancelPayment(paymentId, true);
        }
        catch (e) {
            console.log(e);
        }

        return ctx.scene.enter('discover');
    });

    return scene;
}