const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');

module.exports = function ({payment}) {
    const scene = new BaseScene('unsubscribe');

    scene.enter(async ctx => {
        let text = `После подверждения отписки вы не сможете скачивать курсы.

Для возобновления подписки после отмены отправьте боту /start`
        let buttons = [{text: 'Да, я подтверждаю отписку', code: 'agree'}];

        return ctx.safeReply(
            ctx => ctx.editMessageText(text, menu(buttons)),
            ctx => ctx.reply(text, menu(buttons)),
            ctx
        );
    });

    scene.action('agree', async ctx => {
        await payment.removeSubscribe(ctx.session.profile);
        ctx.globalState.add('reloadProfile', ctx.session.profile.userId);
        let buttons = [{text: 'Подписаться снова', code: 'subscribe'}];
        return ctx.reply(`Вы отписались от сигналов`, menu(buttons));
    });

    scene.action('subscribe', ctx => ctx.scene.enter('subscribe'));

    return scene;
}