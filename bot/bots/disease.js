const { Telegraf } = require('telegraf');
const session = require('telegraf/session');
const store = new Map();

const {initManagers} = require('../managers');
const {catchErrors} = require('./helpers/common');
const {menu} = require('./helpers/wizard');
const {getDb} = require('../modules/Database');
const {__} = require('../modules/Messages');
const {trimHTML} = require('../modules/Helpers');

const SaveActivityMiddleware = require('../modules/SaveActivityMiddleware');
const toggleBlockedMiddleware = require('../modules/toggleBlockedMiddleware');
const BOT_TOKEN = process.env.BOT_TOKEN;

let app = new Telegraf(BOT_TOKEN);

function cleanText(text) {
    return trimHTML(text).replace(/\n{3,}/gm, '\n\n');
}

function getArticleText(article, onlyFirst = false) {
    let MAX_MESSAGE_SIZE = 4096;

    let chunks = [];
    let textItems = article.articleItems.map(item => `<b>${item.title}</b>\n${cleanText(item.text)}\n`);
    let currentText = `<b>${article.name}</b>\n`;

    do {
        let nextItem = textItems.shift();
        let nextIsOversize = (currentText + nextItem).length > MAX_MESSAGE_SIZE;

        if (nextIsOversize) {
            chunks.push(currentText);
            currentText = '';
        }

        currentText += '\n' + nextItem;
    } while (textItems.length > 0)

    if (currentText.length > 0) {
        chunks.push(__(currentText, ['content', 'info']));
    }

    let continueDots = chunks.length > 1 ? '...' : '';

    return onlyFirst
        ? __(chunks[0] + continueDots, ['content', 'info'])
        : chunks;
}

function getMessages(article) {
    return article.articleItems.map((item, index, items) => {
        let text = `<b>${cleanText(item.title)}</b>\n\n${cleanText(item.text)}\n`;

        if (index === 0) {
            text = `<b>${article.name}</b>\n\n${text}`;
        }

        text = __(text, ['content', 'info']);

        return {
            title: cleanText(item.title),
            text
        }
    });
}

initManagers(['chat', 'bus']).then(async ({chat, bus}) => {
    app.use(toggleBlockedMiddleware);
    app.use(session({store}));
    app.use(chat.initIdsMiddleware());
    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());
    app.use(SaveActivityMiddleware);

    app.start(async (ctx) => {
        let messageShown = ctx && ctx.session && ctx.session.introShown;
        if (messageShown) {
            return ctx.replyWithHTML(
                __('Напишите название болезни или обследования. Я поищу его в нашей энциклопедии', ['main', 'start'])
            );
        }

        try {
            ctx.session.introShown = true;
            return ctx.replyWithHTML(__(`Этот бот поможет вам разобраться с: диагнозами, болезнями, процедурами и в целом странными врачебными названиями.

Если у ваших болей и дискомфорта не определена болезнь, попробуйте диагностировать её сначала тут: @yourhealthy_bot

Помните, что вся информация несёт строго ознакомительный характер и не является руководством к действию.

Только врач может дать точную информацию по поводу вашей проблемы.

Приятного пользования!`, ['content', 'intro', 'start', 'disclaimer']), menu([{code: 'accept', text: 'Понятно'}]));
        }
        catch (e) {
            console.log(e);
        }
    });

    app.action('accept', ctx => {
        return ctx.editMessageText(
            __('Напишите название болезни или обследования. Я поищу его в нашей энциклопедии', ['main', 'start']),
            {parse_mode: "HTML"}
        );
    });

    app.on('message', async ctx => {
        let message = ctx.update && ctx.update.message ? ctx.update.message : false;
        let query = message ? message.text : false;

        if (!query) {
            return ctx.replyWithHTML('Напишите название болезни или обследования. Я поищу его в нашей энциклопедии');
        }

        let db = await getDb();
        let diseases = db.collection('diseases');
        await diseases.createIndex({name: "text"}, {default_language: "russian"});
        let foundDisease = await diseases.findOne( { $text: { $search: query } } );

        let queries = db.collection('query');
        await queries.insertOne({chatId: ctx.session.chatId, userId: ctx.session.userId, query, foundDisease});

        if (foundDisease) {
            let messages = getMessages(foundDisease);
            ctx.session.messages = messages;

            if (messages.length > 1) {
                let button = menu([{code: 'page_1', text: messages[1].title}]);
                await ctx.replyWithHTML(messages[0].text, button);
            }
            else {
                await ctx.replyWithHTML(messages[0].text);
            }

            return;
        }
        else {
            return ctx.reply('Ничего не найдено. Попробуйте другой запрос');
        }

    });

    app.action(/page_(\d+)/i, async ctx => {
        let pageIndex = parseInt( ctx.match[1] );
        let messages = ctx.session.messages;
        if (!messages) {
            return ctx.replyWithHTML('Напишите название болезни или обследования. Я поищу его в нашей энциклопедии');
        }

        let message = messages[pageIndex];
        let hasNext = pageIndex < messages.length-1;
        let button = hasNext
            ? menu([{code: 'page_'+(pageIndex+1), text: messages[pageIndex+1].title}])
            : {};
        button.parse_mode = 'HTML';

        await ctx.editMessageText(message.text, button);

        if (!hasNext) {
            return ctx.replyWithHTML('Это всё что я знаю об этом. Если вас ещё что-нибудь интересует, пожалуйста напишите название болезни, обследования или процедуры');
        }
    });

    app.on('inline_query', async ({ inlineQuery, answerInlineQuery }) => {
        try {
            if (inlineQuery.query.length < 3) {
                return await answerInlineQuery([]);
            }

            let db = await getDb();
            let diseases = db.collection('diseases');
            await diseases.createIndex({name: "text"}, {default_language: "russian"});
            let foundDiseases = await diseases.find( { $text: { $search: inlineQuery.query } } ).toArray();

            const results = foundDiseases.map((result, index) => {
                return {
                    type: 'article',
                    id: result._id.toString(),
                    title: result.name,
                    input_message_content: {
                        message_text: getArticleText(result, true),
                        disable_web_page_preview: true,
                        parse_mode: 'HTML'
                    },
                }
            });

            return await answerInlineQuery(results);
        }
        catch (e) {
            console.log(e);
        }
    });

    app.catch(catchErrors);

    app.launch();
    bus.listenCommands();
});