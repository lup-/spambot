const { Telegraf } = require('telegraf');
const setupBot = require('./helpers/setup');
const {init} = require('../managers');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN, {
    telegram: {apiRoot: process.env.TGAPI_ROOT}
});
let bus = init('bus');
let books = init('books');

let introParams = {
    disclaimer: {text: `Привет 😊
    
Я найду для тебя любую книгу в библиотеке Флибусты, а так же аудиокниги из большой базы.

Используй кнопки ниже, для выбора режима поиска.`, tags: ['content', 'books', 'intro']},
    onlyBooks: false
}
let booksSearchParams = {
    sceneCode: 'bookSearch',
    getBookList: books.getBookList.bind(books),
    discoverSceneCode: 'bookDiscover'
}
let bookDiscoverParams = {
    sceneCode: 'bookDiscover',
    getFile: books.getBook.bind(books),
    backCode: 'intro',
    backBookCode: 'bookSearch',
    backAudioCode: 'audioSearch',
    isAudio: false,
    books,
    getChunkDescription(items) {
        return items.map((item, index) => `<b>[${index+1}] ${item.title}</b>
${item.mainAuthor} ${item.genres[0] ? '(' + item.genres[0] + ')' : ''}`).join('\n\n');
    }
}

let audioSearchParams = {
    sceneCode: 'audioSearch',
    getBookList: books.getAudioBookList.bind(books),
    discoverSceneCode: 'audioDiscover'
}
let audioDiscoverParams = {
    sceneCode: 'audioDiscover',
    getFile: books.getAudioBook.bind(books),
    backCode: 'intro',
    backBookCode: 'bookSearch',
    backAudioCode: 'audioSearch',
    isAudio: true,
    books,
    getChunkDescription(items) {
        return items.map((item, index) => `<b>[${index+1}] ${item.title}${item.isFragment ? ' (фрагмент)' : ''}</b>
${item.mainAuthor} ${item.genre ? '(' + item.genre + ')' : ''}
Читает: ${item.performer}`).join('\n\n');
    }
}

app = setupBot(app)
    .blockNonPrivate()
    .addPerformance()
    .addSession({delaySubscribeCheck: true}, 3600)
    .addSafeReply()
    .addIdsToSession()
    .addRefSave()
    .addUserSave()
    .addProfile()
    .addSaveActivity()
    .addSubscription()
    .addScene('books', 'intro', introParams)
    .addScene('books', 'search', booksSearchParams)
    .addScene('books', 'discover', bookDiscoverParams)
    .addScene('books', 'search', audioSearchParams)
    .addScene('books', 'discover', audioDiscoverParams)
    .addDefaultRoute(ctx => ctx.scene.enter('intro'))
    .get();

app.launch();
bus.listenCommands();