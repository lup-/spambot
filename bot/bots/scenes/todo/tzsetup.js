const BaseScene = require('telegraf/scenes/base');
const Markup = require('telegraf/markup');
const {menu, yesNoMenu} = require('../../helpers/wizard');
const moment = require('moment-timezone');
const geoTz = require('geo-tz');
const {postpone, complete} = require('../../helpers/postpone');
const {countries} = require('countries-list');

function timezoneMenu() {
    return menu([
        {code: 'time', text: 'Написать время'},
        {code: 'location', text: 'Определить по моим координатам'},
        {code: 'select', text: 'Выбрать зону времени вручную'},
    ], 1);
}

function countryMenu(lang) {
    lang = lang.toLowerCase();
    let langCountries = [];
    for (let countryId in countries) {
        let country = countries[countryId];

        if (country.languages.indexOf(lang) !== -1) {
            country.id = countryId;
            langCountries.push(country);
        }
    }

    if (lang === 'ru') {
        let ua = countries.UA;
        ua.id = "UA";

        langCountries.push(ua);
    }

    let buttons = langCountries.map(country => {
        return {code: `country_${country.id}`, text: country.emoji + ' ' + country.name}
    });

    return menu(buttons, 2);
}

function zonesMenu(country) {
    let zones = moment.tz.zonesForCountry(country);
    let buttons = zones.map(zone => {
        return {code: `zone_${zone}`, text: zone}
    });

    return menu(buttons, 2);
}

async function replyWithConfirm(ctx) {
    let zone = ctx.session.zone;
    let currentTime = moment().tz(zone).format('HH:mm');
    return ctx.reply(`Ваше текущее время ${currentTime}. Верно?`, yesNoMenu());
}

module.exports = function (periodic, profile) {
    const scene = new BaseScene('tzsetup');

    scene.enter(async (ctx) => {
        return ctx.reply('Для начала сверим часы -- мне нужно знать, который у вас час', timezoneMenu());
    });

    scene.action('select', async ctx => {
        let lang = ctx.from && ctx.from.language_code;
        return ctx.editMessageText('Укажите страну', countryMenu(lang));
    });

    scene.action(/country_(.*)/i, async ctx => {
        let [, country] = ctx.match;
        ctx.session.country = country;
        return ctx.editMessageText('Теперь укажите зону времени', zonesMenu(country));
    });

    scene.action(/zone_(.*)/, async ctx => {
        let [, zone] = ctx.match;
        ctx.session.zone = zone;
        ctx.session.profile.country = ctx.session.country;
        ctx.session.profile.zone = ctx.session.zone;
        return replyWithConfirm(ctx);
    });

    scene.action('time', async ctx => {
        return ctx.reply('Напишите ваше текущее время в формате 13:59');
    });

    scene.action('location', async ctx => {
        return ctx.reply(
            'Где вы находитесь?',
            Markup.keyboard([Markup.locationRequestButton('Отправить координаты')]).oneTime(true).extra()
        );
    });

    scene.on('location', async ctx => {
        let {latitude, longitude} = ctx.update.message.location;
        let zones = geoTz(latitude, longitude);
        if (zones && zones[0]) {
            ctx.session.profile.lat = latitude;
            ctx.session.profile.lng = longitude;
            ctx.session.zone = zones[0];
            return replyWithConfirm(ctx);
        }
        else {
            return ctx.scene.reenter();
        }
    });

    scene.on('message', async ctx => {
        let text = ctx && ctx.update && ctx.update.message && ctx.update.message.text || '';
        let isValidTime = /\d{1,2}:\d{2}/.test(text);

        if (!isValidTime) {
            return ctx.scene.reenter();
        }

        let [userHour] = text.split(':');
        userHour = parseInt(userHour);

        let zoneByOffset = moment.tz.names().find(zone => {
            let zoneHour = moment().tz(zone).get('h');
            return zoneHour === userHour;
        });

        if (zoneByOffset) {
            ctx.session.profile.ourTime = moment().format('HH:mm');
            ctx.session.profile.userTime = text;
            ctx.session.zone = zoneByOffset;
            return replyWithConfirm(ctx);
        }
    });

    scene.on('confirm', replyWithConfirm);

    scene.action('menu_yes', async ctx => {
        ctx.session.profile.zone = ctx.session.zone;
        await profile.saveProfile(ctx.session.profile);
        await ctx.reply(`Ок. Зона выбрана`);
        return ctx.scene.enter('todos');
    });

    scene.action('menu_no', async ctx => {
        return ctx.scene.reenter();
    });

    scene.action(/complete_(.*)/i, ctx => complete(ctx, periodic));
    scene.action(/postpone_(.*?)_(.*)/i, ctx => postpone(ctx, periodic));

    return scene;
}