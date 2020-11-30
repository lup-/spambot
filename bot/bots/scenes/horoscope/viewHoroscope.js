const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');
const moment = require('moment');

function mainMenu(hasSettings) {
    return menu([
        {code: 'signs', text: hasSettings ? 'Настройка' : 'По знаку Зодиака'},
        {code: 'today', text: 'Что на сегодня?'},
    ], 1);
}

function getGeneralHoroscopeText(horoscope) {
    return `<b>Общий гороскоп на ${horoscope.date}</b>

${horoscope.text}

<b>Благоприятно</b>
${horoscope.moonGood}

<b>Неблагоприятно</b>
${horoscope.moonBad}`;
}

function getSignHoroscopeText(horoscope, sign, type) {
    return `<b>${sign.title}, ${type.title}, ${horoscope.date}</b>

${horoscope.text}`;
}

module.exports = function (horoscopeManager) {
    const scene = new BaseScene('viewHoroscope');

    scene.enter(async ctx => {
        let todayStamp = moment().startOf('day').unix();
        let generalIsShown = ctx && ctx.session && ctx.session.generalShown && ctx.session.generalShown === todayStamp;
        let showGeneral = !generalIsShown;

        let horoscope = await horoscopeManager.loadDailyForEveryone();
        let horoscopeText = horoscope ? getGeneralHoroscopeText(horoscope) : '';

        let hasData = ctx && ctx.session && ctx.session.signs && ctx.session.type;
        if (hasData) {
            let signHoroscopePromises = ctx.session.signs.map(signCode => horoscopeManager.getTodayHoroscope(ctx.session.type, signCode))
            let signHoroscopes = await Promise.all(signHoroscopePromises);

            let signHoroscopeTexts = signHoroscopes.map(horoscope => {
                let type = horoscopeManager.getType(horoscope.type);
                let sign = horoscopeManager.getSignByCode(horoscope.sign);
                return getSignHoroscopeText(horoscope, sign, type);
            });

            horoscopeText = showGeneral
                ? horoscopeText + '\n\n' + signHoroscopeTexts.join('\n\n')
                : signHoroscopeTexts.join('\n\n');

            horoscopeText = __(horoscopeText, ['content']);
        }

        await horoscopeManager.saveStat(
            ctx.session.chatId,
            ctx.session.type,
            ctx.session.signs,
            horoscope.date,
            ctx.session.birthday || null
        );

        ctx.session.generalShown = todayStamp;

        return ctx.replyWithHTML( horoscopeText, mainMenu(hasData) );
    });

    scene.action('signs', ctx => ctx.scene.enter('signsMenu'));
    scene.action('today', ctx => ctx.scene.reenter())

    return scene;
}