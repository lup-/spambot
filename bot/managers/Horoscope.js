const moment = require('moment');
const axios = require('axios');
const convert = require('xml-js');
const {getDb} = require('../modules/Database');
const {trimHTML} = require('../modules/Helpers');
const {parseUrl} = require('../bots/helpers/parser');

module.exports = function () {
    let DAILY_URL_BASE = "https://ignio.com/r/export/utf/xml/daily/";
    let COMMON_DAILY_URL = "https://horo.mail.ru/prediction/today/";

    return {
        listTypes() {
            return [
                {code: 'general', ignioCode: 'com', title: 'Общий'},
                {code: 'erotic', ignioCode: 'ero', title: 'Эротический'},
                {code: 'anti', ignioCode: 'anti', title: 'Антигороскоп'},
                {code: 'business', ignioCode: 'bus', title: 'Бизнес'},
                {code: 'health', ignioCode: 'hea', title: 'Здоровье'},
                {code: 'cooking', ignioCode: 'cook', title: 'Кулинарный'},
                {code: 'love', ignioCode: 'lov', title: 'Любовный'},
                {code: 'mobile', ignioCode: 'mob', title: 'Мобильный'},
            ]
        },
        listSigns() {
            return [
                {code: 'aries', title: 'Овен', from: '21.03', to: '20.04'},
                {code: 'taurus', title: 'Телец', from: '21.04', to: '20.05'},
                {code: 'gemini', title: 'Близнецы', from: '21.05', to: '21.06'},
                {code: 'cancer', title: 'Рак', from: '22.06', to: '22.07'},
                {code: 'leo', title: 'Лев', from: '23.07', to: '23.08'},
                {code: 'virgo', title: 'Дева', from: '24.08', to: '23.09'},
                {code: 'libra', title: 'Весы', from: '24.09', to: '23.10'},
                {code: 'scorpio', title: 'Скорпион', from: '24.10', to: '22.11'},
                {code: 'sagittarius', title: 'Стрелец', from: '23.11', to: '21.12'},
                {code: 'capricorn', title: 'Козерог', from: '22.12', to: '20.01'},
                {code: 'aquarius', title: 'Водолей', from: '21.01', to: '20.02'},
                {code: 'pisces', title: 'Рыбы', from: '21.02', to: '20.03'},
            ]
        },
        getSignByDate(ddmmyyyyDate) {
            let birhday = moment(ddmmyyyyDate, 'DD.MM.YYYY');
            
            return this.listSigns().find(sign => {
                let fromWithYear = sign.from + '.' + birhday.year();
                let toWithYear = sign.to + '.' + birhday.year();

                let from = moment(fromWithYear, 'DD.MM.YYYY').startOf('d');
                let to = moment(toWithYear, 'DD.MM.YYYY').endOf('d');

                if (sign.code === 'capricorn') {
                    let endOfYear = moment(birhday.year(), 'YYYY').endOf('y');
                    let startOfYear = moment(birhday.year(), 'YYYY').startOf('y');

                    return birhday.isBetween(from, endOfYear, null, '[]') || birhday.isBetween(startOfYear, to, null, '[]');
                }
                else {

                    return birhday.isBetween(from, to, null, '[]');
                }
            });
        },
        getSignByCode(searchCode) {
            return this.listSigns().find(item => item.code === searchCode);
        },
        getType(searchCode) {
            return this.listTypes().find(item => item.code === searchCode);
        },
        async fetchDaily(typeCode) {
            let horoscopes = [];
            let type = this.getType(typeCode);
            if (!type) {
                return false;
            }

            try {
                let {data} = await axios(DAILY_URL_BASE+type.ignioCode+'.xml');
                let horoscope = convert.xml2js(data, {compact: true});
                let dates = horoscope.horo.date._attributes;

                for (const sign in horoscope.horo) {
                    if (sign === 'date') {
                        continue;
                    }

                    for (const dateCode in horoscope.horo[sign]) {
                        let date = dates[dateCode];
                        let textNode = horoscope.horo[sign][dateCode];
                        let signHoro = {
                            sign,
                            date,
                            period: 'daily',
                            type: typeCode,
                            dateStamp: moment(date, 'DD.MM.YYYY').unix(),
                            text: textNode._text.trim(),
                        }

                        horoscopes.push(signHoro);
                    }
                }

            }
            catch (e) {
                return false;
            }
            return horoscopes;
        },
        async fetchCommonDaily() {
            const db = await getDb();
            const horoscopes = db.collection('horoscopes');

            let today = moment().startOf('d');

            let parsed = await parseUrl(COMMON_DAILY_URL, {
                text: '.p-prediction .article__item_html',
                moonText: '.p-item_moon .text',
                moonGood: '.p-forecast .p-forecast__item:first-child .p-forecast__item__text',
                moonBad: '.p-forecast .p-forecast__item:last-child .p-forecast__item__text',
            });

            let commonHoro = {
                date: today.format('DD.MM.YYYY'),
                sign: 'any',
                period: 'daily',
                type: 'general',
                dateStamp: today.unix(),
                text: trimHTML(parsed.text),
                moonText: trimHTML(parsed.moonText),
                moonGood: trimHTML(parsed.moonGood),
                moonBad: trimHTML(parsed.moonBad),
            }

            return horoscopes.insertOne(commonHoro);
        },
        async loadDailyForEveryone() {
            let filter = {
                sign: 'any',
                period: 'daily',
                date: moment().format('DD.MM.YYYY'),
            }

            const db = await getDb();
            const horoscopes = db.collection('horoscopes');
            let horoscope = await horoscopes.findOne(filter);

            if (!horoscope) {
                horoscope = await this.fetchCommonDaily();
            }

            return horoscope || false;
        },
        async loadDaily(typeCode, signCode, date) {
            let filter = {
                sign: signCode,
                period: 'daily',
                type: typeCode,
                date: moment(date).format('DD.MM.YYYY'),
            }

            const db = await getDb();
            const horoscopes = db.collection('horoscopes');
            let horoscope = await horoscopes.find(filter).toArray();

            return horoscope[0] || false;
        },
        async updateHoroscopesDb(typeCode) {
            let records = await this.fetchDaily(typeCode);
            if (!records) {
                return false;
            }

            const db = await getDb();
            const horoscopes = db.collection('horoscopes');

            let result = await horoscopes.insertMany(records);

            return result.ops || false;
        },
        async getTodayHoroscope(typeCode, signCode) {
            let today = moment();

            let horoscope = await this.loadDaily(typeCode, signCode, today);
            if (!horoscope) {
                await this.updateHoroscopesDb(typeCode);
                horoscope = await this.loadDaily(typeCode, signCode, today);
            }

            return horoscope;
        },
        async hasSubscription(chatId, typeCode, signCode) {
            const db = await getDb();
            const subscriptions = db.collection('subscriptions');
            let subscription = await subscriptions.findOne({chatId, typeCode, signCode});

            return Boolean(subscription && subscription._id);
        },
        async subscribe(chatId, typeCode, signCode) {
            const db = await getDb();
            const subscriptions = db.collection('subscriptions');
            let nextDate = moment().add(1, 'd').set('hour', 9).startOf('hour');

            return subscriptions.insertOne({chatId, typeCode, signCode, next: nextDate.unix(), last: null, type: 'daily'});
        },
        async unsubscribe(chatId, typeCode, signCode) {
            const db = await getDb();
            const subscriptions = db.collection('subscriptions');
            return subscriptions.deleteOne({chatId, typeCode, signCode});
        },
        async saveStat(chatId, typeCode, signCodes, date, birthday = null) {
            const db = await getDb();
            const requests = db.collection('requests');
            return requests.insertOne({chatId, typeCode, signCodes, date, birthday});
        }
    }
}