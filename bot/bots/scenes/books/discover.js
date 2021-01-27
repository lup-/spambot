const path = require('path');
const fs = require('fs');
const BaseScene = require('telegraf/scenes/base');
const {menu, hMenu} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');

const FILES_LOCAL_PATH = process.env.FILES_LOCAL_PATH || __dirname;
const FILES_REMOTE_PATH = process.env.FILES_REMOTE_PATH || '/files';
const CHUNK_SIZE = 5;
const MAX_RETRIES = 5;

function chunkMenu({hasPrev, hasNext, chunk}, hasSubmenu) {
    let downloadButtons = [];
    for (let index = 0; index < 5; index++) {
        let item = chunk[index] || false;
        let button = item
            ? { code: 'download_'+item.id, text: index+1 }
            : { code: '_skip', text: '➖' }
        downloadButtons.push(button);
    }

    let controlButtons = [];
    controlButtons.push(hasPrev
        ? {code: 'go_prev', text: '◀' }
        : {code: '_skip', text: '➖' }
    );

    controlButtons.push(hasNext
        ? {code: 'go_next', text: '▶' }
        : {code: '_skip', text: '➖' }
    );

    let backButton = hasSubmenu
        ? {code: 'menu', text: '↩'}
        : {code: '_skip', text: '➖' };

    let buttons = hasPrev || hasNext
        ? [
            downloadButtons,
            controlButtons,
            [backButton]
        ]
        : [
            downloadButtons,
            [backButton]
        ];

    return hMenu(buttons);
}
function noItemsMenu() {
    return menu([{code: 'back', text: '↩'}]);
}

function getChunkAtIndex(index, ctx) {
    let items = ctx.scene.state.items || [];
    let from = index * CHUNK_SIZE;
    let to = (index + 1) * CHUNK_SIZE;

    let totalItems = Math.ceil(items.length/CHUNK_SIZE);
    let chunk = items.slice(from, to);
    let hasNext = index < totalItems-1;
    let hasPrev = index > 0;

    return chunk && chunk.length > 0 && totalItems > 0 ? {chunk, hasPrev, hasNext, index, totalItems} : false;
}
function getItemById(id, ctx) {
    let items = ctx.scene.state.items || [];
    return items.find(item => item.id.toString() === id.toString());
}
function getEmptyText() {
    return `Ой, загрузка не прошла`;
}

async function replyWithChunk(ctx, showNewMessage, params) {
    let {getChunkDescription} = params;

    let currentIndex = ctx.scene.state.index || 0;

    let results = await getChunkAtIndex(currentIndex, ctx);
    let hasResults = results && results.chunk && results.chunk.length > 0;
    if (!hasResults) {
        ctx.scene.state.index = 0;
        if (currentIndex === 0) {
            let emptyExtra = noItemsMenu();
            let text = getEmptyText(ctx);
            emptyExtra.caption = text;
            return ctx.replyWithHTML(text, noItemsMenu());
        }
        else {
            return ctx.scene.reenter();
        }
    }

    ctx.scene.state.hasNext = results.hasNext;
    ctx.scene.state.totalItems = results.totalItems;

    let hasSubmenu = true;

    let itemText = getChunkDescription(results.chunk);
    let messageMenu = chunkMenu(results, hasSubmenu);

    let editExtra = chunkMenu(results, hasSubmenu);
    editExtra.parse_mode = 'html';

    ctx.perfStart('replyWithChunk');
    await ctx.safeReply(
        ctx => {
            return showNewMessage
                ? ctx.replyWithHTML(itemText, messageMenu)
                : ctx.editMessageText(itemText, editExtra);
        },
        ctx => ctx.replyWithHTML(itemText, messageMenu),
        ctx
    );
    ctx.perfStop('replyWithChunk');
    await ctx.perfCommit();
}
function saveStream(fileName, stream) {
    return new Promise(resolve => {
        let localPath = path.join(FILES_LOCAL_PATH, fileName);
        let remotePath = 'file://'+path.join(FILES_REMOTE_PATH, fileName);

        let writeStream = fs.createWriteStream(localPath);
        stream.pipe(writeStream);
        writeStream.on('finish', () => resolve({localPath, remotePath}));
    });
}
async function sendDownload(ctx, fileLink, book, params, retry = 1, message = false, format = false) {
    const {getFile, isAudio, books} = params;

    let extra = menu([{code: 'back_book', text: 'Найти книгу'}, {code: 'back_audio', text: 'Найти аудиокнигу'}]);
    extra.caption = isAudio
        ? __(`<b>${book.title}</b>\n\nПриятного прослушивания!`, ['content', 'audio'], 'audio')
        : __(`<b>${book.title}</b>\n\nПриятного чтения!`, ['content', 'text']);
    extra.parse_mode = 'html';

    let platform = books.getPlatform(isAudio);
    let bookId = book.id;
    if (!format) {
        if (isAudio) {
            format = 'mp3';
        }

        if (fileLink) {
            format = fileLink.replace(/^.*\//, '');
        }
    }

    ctx.perfStart('getFile');
    let savedFile = await books.getFile(platform, bookId, format);
    ctx.perfStop('getFile');

    if (savedFile) {
        ctx.perfStart('dbReply');
        let dbMessage = isAudio
            ? ctx.replyWithAudio(savedFile.file.file_id, extra)
            : ctx.replyWithDocument(savedFile.file.file_id, extra);
        ctx.perfStop();
        return dbMessage;
    }

    let file;
    let error = false;
    let localFile = false;

    try {
        if (retry === 1) {
            message = await ctx.reply('Идет загрузка...');
        }
        else {
            console.log(`Загрузка, попытка ${retry}`);
        }
        let fileStream = await getFile(book, fileLink, format);
        let fileName = bookId + '.' + format;

        ctx.perfStart('saveStream');
        let {localPath, remotePath} = await saveStream(fileName, fileStream);
        localFile = localPath;
        ctx.perfStop('saveStream');

        ctx.perfStart('sendDownloaded');
        if (isAudio) {
            let fileMessage = await ctx.replyWithAudio(remotePath, extra)
            file = fileMessage.audio;
        }
        else {
            let fileMessage = await ctx.replyWithDocument(remotePath, extra);
            file = fileMessage.document;
        }
        ctx.perfStop('sendDownloaded');
    }
    catch (e) {
        error = e;
        file = false;
    }

    if (localFile) {
        try {
            fs.unlinkSync(localFile);
        }
        catch (e) {}
    }

    if (file) {
        ctx.perfStart('cacheDownload');
        await books.saveFile(platform, bookId, format, file);
        ctx.perfStop('cacheDownload');
    }

    if (message && message.message_id) {
        await ctx.deleteMessage(message.message_id);
    }

    if (error) {
        if (retry < MAX_RETRIES) {
            return sendDownload(ctx, fileLink, book, params, ++retry, message);
        }
        else {
            console.log(error);
            return ctx.reply('Не удалось скачать эту книгу. Попробуйте позже или посмотрите другие.', menu([{
                code: 'book',
                text: 'Посмотреть другие'
            }]));
        }
    }
    else {
        ctx.perfStart('cacheDownload');
        await books.saveDownload(platform, bookId, format, ctx.session.userId);
        ctx.perfStop('cacheDownload');
    }

    await ctx.perfCommit();
}

module.exports = function (params) {
    const {sceneCode, backCode, backBookCode, backAudioCode} = params;
    const scene = new BaseScene(sceneCode);

    scene.enter(async ctx => {
        let fromNav = typeof (ctx.scene.state.nav) === 'boolean' ? ctx.scene.state.nav : false;
        let showNewMessage = !fromNav;
        ctx.scene.state.index = ctx.scene.state.index || 0;

        return replyWithChunk(ctx, showNewMessage, params);
    });

    scene.action('go_prev', ctx => {
        let index = ctx.scene.state.index || 0;
        if (index > 0) {
            index--;
        }

        ctx.scene.state.index = index;
        ctx.scene.state.nav = true;
        return ctx.scene.reenter();
    });

    scene.action('go_next', ctx => {
        let hasNext = ctx.scene.state.hasNext;

        let index = ctx.scene.state.index || 0;
        if (hasNext) {
            index++;
        }

        ctx.scene.state.index = index;
        ctx.scene.state.nav = true;
        return ctx.scene.reenter();
    });

    scene.action(/^download_([^_]+)$/i, async ctx => {
        let itemId = ctx.match[1];
        let item = await getItemById(itemId, ctx);

        if (!item) {
            await ctx.reply('Не могу найти нужную книгу');
            return ctx.scene.enter(backCode);
        }

        let hasManyFormats = item.downloads && item.downloads.length > 0;

        if (hasManyFormats) {
            let formats = item.downloads.map(item => item.format);
            let buttons = formats.map(format => ({code: 'download_'+itemId+'_'+format, text: format === 'download' ? 'pdf' : format}));
            let extra = menu(buttons);
            extra.parse_mode = 'HTML';

            return ctx.safeReply(
                ctx => ctx.editMessageText('Укажите формат для загрузки', extra),
                ctx => ctx.reply('Укажите формат для загрузки', extra),
                ctx
            );
        }
        else {
            return sendDownload(ctx, item.link, item, params);
        }
    });

    scene.action(/^download_([^_]+)_([^_]+)$/i, async ctx => {
        let itemId = ctx.match[1];
        let format = ctx.match[2];
        let item = await getItemById(itemId, ctx);
        let {url} = item.downloads.find(item => item.format === format);

        return sendDownload(ctx, url, item, params, 1, false, format);
    });

    scene.action('back', ctx => {
        ctx.scene.state.index = 0;
        ctx.scene.state.nav = false;
        return ctx.scene.enter(backCode);
    });
    scene.action('back_book', ctx => {
        ctx.scene.state.index = 0;
        ctx.scene.state.nav = false;
        return ctx.scene.enter(backBookCode, {newMessage: true});
    });
    scene.action('back_audio', ctx => {
        ctx.scene.state.index = 0;
        ctx.scene.state.nav = false;
        return ctx.scene.enter(backAudioCode, {newMessage: true});
    });
    scene.action('book', ctx => ctx.scene.reenter());
    scene.action('_skip', () => {});

    return scene;
}