const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');

function horoscopeMenu(isSubscribed) {
    let subscribeButton = isSubscribed
        ? {code: 'unsubscribe', text: 'Отписаться'}
        : {code: 'subscribe', text: 'Подписаться'}

    return menu([
        {code: 'newSign', text: 'Другой знак'},
        {code: 'newType', text: 'Другой тип'},
        subscribeButton,
    ], 1);
}

function getHoroscopeText(horoscope, sign, type) {
    return `<b>${sign.title}, ${type.title}, ${horoscope.date}</b>

${horoscope.text}`;
}

module.exports = function (horoscopeManager) {
    const scene = new BaseScene('viewHoroscope');

    scene.enter(async ctx => {
        let hasData = ctx && ctx.session && ctx.session.sign && ctx.session.type;
        if (!hasData) {
            return ctx.scene.enter('signsMenu');
        }

        let isSubscribed = await horoscopeManager.hasSubscription(ctx.session.chatId, ctx.session.type, ctx.session.sign);
        let horoscope = await horoscopeManager.getTodayHoroscope(ctx.session.type, ctx.session.sign);
        await horoscopeManager.saveStat(
            ctx.session.chatId,
            ctx.session.type,
            ctx.session.sign,
            horoscope.date,
            ctx.session.birthday || null
        );

        let type = await horoscopeManager.getType(ctx.session.type);
        let sign = await horoscopeManager.getSignByCode(ctx.session.sign);
        let horoscopeText = getHoroscopeText(horoscope, sign, type);

        return ctx.replyWithHTML( horoscopeText, horoscopeMenu(isSubscribed) );
    });

    scene.action('newSign', ctx => ctx.scene.enter('signsMenu'));
    scene.action('newType', ctx => ctx.scene.enter('typesMenu'))

    scene.action('subscribe', async ctx => {
        await horoscopeManager.subscribe(ctx.session.chatId, ctx.session.type, ctx.session.sign);
        return ctx.reply('Вы подписались на ежедевную рассылку этого гороскопа', menu([{code: 'newSign', text: 'Посмотреть другой'}]));
    });

    scene.action('unsubscribe', async ctx => {
        await horoscopeManager.unsubscribe(ctx.session.chatId, ctx.session.type, ctx.session.sign);
        return ctx.reply('Вы отписались от ежедневной рассылки этого гороскопа', menu([{code: 'newSign', text: 'Посмотреть другой'}]));
    });

    return scene;
}