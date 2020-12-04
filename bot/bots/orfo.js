const { Telegraf } = require('telegraf');
const {initManagers} = require('../managers');
const axios = require('axios');
const qs = require('qs');
const {catchErrors} = require('./helpers/common');
const {getDb} = require('../modules/Database');
const checkSubscriptionMiddleware = require('../modules/CheckSubscriptionMiddleware');
const {__} = require('../modules/Messages');

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_URL = process.env.LANGTOOL_API_URL;
const CHECK_URL = API_URL+'v2/check';
let app = new Telegraf(BOT_TOKEN);

async function check(language, text) {
    let response = await axios.post(CHECK_URL, qs.stringify({language, text}));
    return response.data;
}
function highlightErrors(text, errors) {
    let leftOffset = 0;
    let highlightedText = '';

    for (let errorIndex in errors) {
        let errorNum = parseInt(errorIndex) + 1;
        const error = errors[errorIndex];

        let beforeErrorText = text.substr(leftOffset, error.offset-leftOffset);
        let errorText = text.substr(error.offset, error.length);
        leftOffset = error.offset + error.length;
        highlightedText += `${beforeErrorText}<b>${errorText} (${errorNum})</b>`;
    }

    if (leftOffset < text.length) {
        let lastPart = text.substr(leftOffset, text.length-leftOffset);
        highlightedText += lastPart;
    }

    return highlightedText;
}
function errorsList(text, errors) {
    let errorsList = '';
    for (let errorIndex in errors) {
        let errorNum = parseInt(errorIndex) + 1;
        let error = errors[errorIndex];

        let errorText = text.substr(error.offset, error.length);
        errorsList += `${errorNum}. <b>${errorText}</b>: ${error.shortMessage || error.message}\n`;
    }

    return errorsList;
}
function correctedText(text, errors) {
    let leftOffset = 0;
    let correctedText = '';

    for (const errorIndex in errors) {
        const error = errors[errorIndex];

        let beforeErrorText = text.substr(leftOffset, error.offset-leftOffset);
        let errorText = text.substr(error.offset, error.length);
        let replacementText = error.replacements && error.replacements.length > 0
            ? error.replacements[0].value
            : false;
        leftOffset = error.offset + error.length;

        correctedText += replacementText
            ? beforeErrorText+replacementText
            : beforeErrorText+'<b>'+errorText+'</b>';

    }

    if (leftOffset < text.length) {
        let lastPart = text.substr(leftOffset, text.length-leftOffset);
        correctedText += lastPart;
    }

    return 'Исправленный текст:\n\n'+correctedText;
}
function getAnalytics(text) {
    text = text.trim();
    let wordsOnly = text.replace(/[^a-zа-я0-9]/ig, ' ').replace(/ +/g, ' ').trim()
    return {
        totalChars: text.length,
        notSpaces: wordsOnly.replace(/ +/g, '').trim().length,
        totalWords: text.split(' ').length,
        sentencesCount: text.replace(/[^\.]+/g, '').length,
        paragraphsCount: text.replace(/\n+/g, '\n').replace(/[^\n]+/g, '').length + 1,
    };
}
function analyticsText(text) {
    text = text.trim();
    let analytics = getAnalytics(text);
    return `<b>Анализ текста</b>

Символов (с пробелами): ${analytics.totalChars}
Символов (без пробелов): ${analytics.notSpaces}
Слов: ${analytics.totalWords}
Предложений: ${analytics.sentencesCount}
Абзацев: ${analytics.paragraphsCount}`;
}

async function saveUserStat(userId, text) {
    let db = await getDb();
    let stats = db.collection('stats');
    let analytics = getAnalytics(text);
    analytics.userId = userId;

    return stats.insertOne(analytics);
}

initManagers(['chat', 'bus']).then(async ({chat, bus}) => {
    app.catch(catchErrors);

    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());
    app.use(checkSubscriptionMiddleware);

    app.start(async (ctx) => {
        try {
            return ctx.reply('Пришлите любой текст');
        }
        catch (e) {}
    });

    app.on('message', async (ctx, next) => {
        let message = ctx.update.message;
        let language = message.from.language_code;
        let text = message.text;

        try {
            let results = await check(language, text);
            let hasErrors = results.matches && results.matches.length > 0;

            await saveUserStat(ctx.from.id, text);
            if (hasErrors) {
                await ctx.replyWithHTML( highlightErrors(text, results.matches) );
                await ctx.replyWithHTML( errorsList(text, results.matches) );
                await ctx.replyWithHTML( correctedText(text, results.matches) );
                await ctx.replyWithHTML(
                    __(analyticsText( text ), ['content', 'stats'])
                );
                return ctx.reply('Проверка окончена. Пришлите новый текст');
            }
            else {
                await ctx.reply('Ошибок не найдено');
                return ctx.replyWithHTML( analyticsText( text ) );
            }

        }
        catch (e) {
            console.log(e);
        }
    });

    app.launch();
    bus.listenCommands();
});