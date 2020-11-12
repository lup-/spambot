const { Telegraf } = require('telegraf');
const {initManagers} = require('../managers');
const wiki = require('wikijs').default;
const moment = require('moment');

const apiUrl = "https://ru.wikipedia.org/w/api.php";
const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);
const headers = {'User-Agent': 'wikipedia-tlg-search-bot-requests @reflexum'};

async function loadPage(query) {
    try {
        const wikiPage = await wiki({apiUrl, headers}).page(query);
        let title = wikiPage.raw.title;
        let summary = await wikiPage.summary();
        let url = wikiPage.raw.canonicalurl;
        let message = `<b>${title}</b>\n<a href="${url}">посмотреть статью</a>\n\n${summary}`;

        return {title, summary, message};
    }
    catch (e) {
        return null;
    }
}

async function loadSearchResults(titles) {
    return Promise.all( titles.map(loadPage) );
}

initManagers(['chat']).then(async ({chat}) => {
    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());

    app.start(async (ctx) => {
        return ctx.reply('Пришлите любой запрос и я поищу его в Википедии');
    });

    app.on('inline_query', async ({ inlineQuery, answerInlineQuery }) => {
        try {
            
            const search = await wiki({apiUrl, headers}).search(inlineQuery.query);
            const searchResults = await loadSearchResults(search.results.slice(0, 5));
            console.log(searchResults.length);
            const timestamp = moment().unix();

            const results = searchResults.filter(result => result !== null).map((result, index) => {
                let id = timestamp.toString() + index;
                return {
                    type: 'article',
                    id,
                    title: result.title,
                    input_message_content: {
                        message_text: result.message,
                        disable_web_page_preview: true,
                        parse_mode: 'HTML'
                    },
                }
            });

            return await answerInlineQuery(results);
        }
        catch (e) {
            console.log('!', e);
        }

        return;
    });

    app.on('message', async (ctx) => {
        let message = ctx.update.message;
        let searchText = message.text;

        const search = await wiki({apiUrl, headers}).search(searchText);
        const page = await loadPage(search.results[0]);
        
        if (page) {
            return ctx.replyWithHTML( page.message );
        }
        else {
            return ctx.reply('Ошибка загрузки. Попробуйте еще раз');
        }

    });

    app.catch((err, ctx) => {
        console.log(err);
        return ctx.reply('Похоже, что-то пошло не по плану.\nПопробуйте начать занвово /start.');
    });

    app.launch();
});