const { Telegraf } = require('telegraf');
const {initManagers} = require('../managers');
const axios = require('axios');
const qs = require('qs');
const {catchErrors} = require('./helpers/common');

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
function analyticsText(text) {
    text = text.trim();
    let totalChars = text.length;
    let wordsOnly = text.replace(/[^a-zа-я0-9]/ig, ' ').replace(/ +/g, ' ').trim()
    let notSpaces = wordsOnly.replace(/ +/g, '').trim().length;
    let totalWords = text.split(' ').length;
    let sentencesCount = text.replace(/[^\.]+/g, '').length;
    let paragraphsCount = text.replace(/\n+/g, '\n').replace(/[^\n]+/g, '').length + 1;
    return `<b>Анализ текста</b>

Символов (с пробелами): ${totalChars}
Символов (без пробелов): ${notSpaces}
Слов: ${totalWords}
Предложений: ${sentencesCount}
Абзацев: ${paragraphsCount}`;
}

initManagers(['chat']).then(async ({chat}) => {
    app.catch(catchErrors);

    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());

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

            if (hasErrors) {
                await ctx.replyWithHTML( highlightErrors(text, results.matches) );
                await ctx.replyWithHTML( errorsList(text, results.matches) );
                await ctx.replyWithHTML( correctedText(text, results.matches) );
                await ctx.replyWithHTML( analyticsText( text ) );
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
});