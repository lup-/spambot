const { Telegraf } = require('telegraf');
const {initManagers} = require('../managers');
const languagetool = require("languagetool-api");

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);

function check(language, text) {
    return new Promise((resolve, reject) => {
        languagetool.check({language, text}, (err, res) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(res);
            }
        });
    });
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

    return highlightedText;
}
function errorsList(text, errors) {
    let errorsList = '';
    for (let errorIndex in errors) {
        let errorNum = parseInt(errorIndex) + 1;
        let error = errors[errorIndex];

        let errorText = text.substr(error.offset, error.length);
        errorsList += `${errorNum}. <b>${errorText}</b>: ${error.shortMessage}\n`;
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
    return 'Исправленный текст:\n\n'+correctedText;
}

initManagers(['chat']).then(async ({chat}) => {
    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());

    app.start(async (ctx) => {
        return ctx.reply('Пришлите любой текст');
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
                return ctx.reply('Проверка окончена. Пришлите новый текст');
            }
            else {
                return ctx.reply('Ошибок не найдено');
            }

        }
        catch (e) {
            console.log(e);
            ctx.reply(e.toString());
        }

        return next();
    });

    app.catch((err, ctx) => {
        console.log(err);
        return ctx.reply('Похоже, что-то пошло не по плану.\nПопробуйте начать занвово /start.');
    });

    app.launch();
});