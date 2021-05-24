const BaseScene = require('telegraf/scenes/base');
const {getChatsInfo, generateNewLink, replaceMessageLinks, saveChatInfo, addLinkToChat, getChannels} = require('../../actions/linkProcessing');
const {getDb} = require('../../../modules/Database');
const {menu} = require('../../helpers/wizard');
const {wait} = require('../../helpers/common');

function getUniqueChats(chats) {
    return Object.keys(chats)
        .map(link => chats[link])
        .filter(chat => chat && chat.id)
        .filter((chat, index, all) => all.findIndex(item => item.id === chat.id) === index);
}

module.exports = function () {
    const scene = new BaseScene('post');

    scene.enter(async ctx => {
        let post = ctx.scene.state.post;
        let channels = ctx.scene.state.channels;
        let usersLimit = ctx.scene.state.usersLimit || 0;
        let chats = getUniqueChats(ctx.scene.state.chats || {});
        let chatTitles = chats && chats.length > 0
            ? chats.map(chat => chat.title)
            : [];
        let missing = ctx.scene.state.missing;

        let messageText = post ? post.text || post.caption : false;

        if (messageText && channels && channels.length > 0) {
            let wordEnd = messageText.indexOf(' ', 50);
            let postBrief = messageText.slice(0, wordEnd);
            let infoText = `<b>Название</b>:  ${ctx.scene.state.title || 'не задано'}
            
<b>Каналов для публикации</b>: ${channels.length}

<b>Максимум вступлений по новым ссылкам</b>: ${usersLimit > 0 ? usersLimit : 'нет'}

<b>Текст</b>: ${postBrief}...

<b>Чаты из поста</b>: ${chatTitles && chatTitles.length > 0 ? chatTitles.join('; ') : 'не обнаружено'}

<b>Нераспознанные ссылки</b>: ${missing && missing.length > 0 ? missing.join('; ') : 'не обнаружено'}`;

            return ctx.replyWithDisposableHTML(infoText, menu([
                {code: 'makeLinks', text: '🚀 Создать посты'},
                {code: 'replaceTitle', text: 'Поменять название'},
                {code: 'replacePost', text: 'Поменять пост'},
                {code: 'replaceChannels', text: 'Поменять каналы'},
                {code: 'usersLimit', text: 'Лимит пользователей'},
                {code: 'back', text: '⬅ В меню'},
            ], 1));
        }
        else if (post) {
            ctx.scene.state.waiting = 'channels';
            return ctx.replyWithDisposableHTML('Пришлите список названий каналов разделенных новой строкой или ;');
        }

        ctx.scene.state.waiting = 'post';
        return ctx.replyWithDisposableHTML('Напишите или перешлите пост');
    });

    scene.action('replacePost', ctx => {
        ctx.scene.state.chats = null;
        ctx.scene.state.missing = null;
        ctx.scene.state.post = null;
        ctx.scene.state.title = null;
        ctx.scene.state.waiting = 'post';
        return ctx.scene.reenter();
    });

    scene.action('replaceTitle', ctx => {
        ctx.scene.state.waiting = 'title';
        return ctx.replyWithDisposableHTML('Пришлите новое название поста');
    });

    scene.action('replaceChannels', ctx => {
        ctx.scene.state.channels = null;
        return ctx.scene.reenter();
    });

    scene.action('addChannels', ctx => {
        ctx.scene.state.waiting = 'channels';
        return ctx.replyWithDisposableHTML('Пришлите список дополнительных каналов');
    });

    scene.action('usersLimit', ctx => {
        ctx.scene.state.waiting = 'usersLimit';
        return ctx.replyWithDisposableHTML('Пришлите максимальное количество вступлений по новым ссылкам');
    });

    scene.action('makeLinks', async ctx => {
        let channels = ctx.scene.state.channels;
        let foundChatsAndLinks = ctx.scene.state.chats || {};
        let chats = getUniqueChats(foundChatsAndLinks);
        let usersLimit = ctx.scene.state.usersLimit || 0;
        let post = ctx.scene.state.post;
        let title = ctx.scene.state.title;

        let results = {success: 0, errors: 0};
        let db = await getDb();

        await ctx.replyWithDisposableHTML('Обработка начата...');

        for (let channel of channels) {
            let postLinks = {};
            let errors = {};

            for (let chat of chats) {
                try {
                    let link = await generateNewLink(chat, usersLimit, ctx.telegram);
                    await addLinkToChat(chat, link);
                    postLinks[chat.id] = link;
                }
                catch (e) {
                    errors[chat.id] = e;
                }
            }

            let linkMappings = Object.keys(foundChatsAndLinks)
                .reduce((mappings, oldLink) => {
                    let chat = foundChatsAndLinks[oldLink];
                    let newLink = postLinks[chat.id] || null;
                    mappings[oldLink] = newLink ? newLink : oldLink;
                    return mappings;
                }, {});

            let hasNoErrors = Object.keys(errors).length === 0;

            if (hasNoErrors) {
                let newPost = replaceMessageLinks(post, linkMappings);
                let linkMappingsForDb = Object.keys(linkMappings).map(old => ({oldLink: old, newLink: linkMappings[old]}));
                let postLinksForDb = Object.keys(postLinks).map(chatId => ({chatId, link: postLinks[chatId]}));
                let generatedLinks = Object.keys(postLinks).map(chatId => postLinks[chatId]);
                let chatsNoExtraFields = chats.map(chat => {
                    delete chat.invite_links;
                    return chat;
                });
                let userId = ctx.from.id;

                let linkRecord = {
                    type: 'post',
                    userId,
                    title,
                    channel,
                    chats: chatsNoExtraFields,
                    generatedLinks,
                    srcPost: post,
                    post: newPost,
                    postLinks: postLinksForDb,
                    linkMappings: linkMappingsForDb,
                }
                
                try {
                    await db.collection('generated').insertOne(linkRecord);
                    results.success++;
                }
                catch (e) {
                    results.errors++;
                }
            }
            else {
                results.errors++;
            }
        }

        await ctx.replyWithDisposableHTML(`Обработка закончена\n\nУспешно: ${results.success}\nОшибок: ${results.errors}`);
        return ctx.scene.enter('menu');
    });

    scene.action('back', ctx => ctx.scene.enter('menu'));

    scene.on('message', async (ctx, next) => {
        let post = ctx && ctx.update && ctx.update.message
            ? ctx.update.message
            : null;

        if (post && post.text && post.text === '/start') {
            return ctx.scene.enter('menu');
        }

        if (ctx.scene.state.waiting === 'post') {
            ctx.scene.state.post = post;

            if (post) {
                ctx.replyWithDisposableHTML('Обработка...');
                let {found: chats, missing} = await getChatsInfo(post, ctx);
                let links = Object.keys(chats);
                ctx.scene.state.chats = chats;
                ctx.scene.state.missing = missing;

                if (chats && links && links.length > 0) {
                    await saveChatInfo(chats);

                    let chat = chats[links[0]];
                    if (chat) {
                        ctx.scene.state.title = chat.title;
                    }
                }
            }
        }

        if (ctx.scene.state.waiting === 'channels') {
            let oldChannels = ctx.scene.state.channels || [];
            let newChannels = getChannels(post);

            ctx.scene.state.channels = oldChannels.concat(newChannels);
        }

        let messageText = post.text || post.caption;

        if (ctx.scene.state.waiting === 'title') {
            ctx.scene.state.title = messageText;
        }

        if (ctx.scene.state.waiting === 'usersLimit') {
            try {
                ctx.scene.state.usersLimit = parseInt(messageText);
            }
            catch (e) {
                ctx.scene.state.usersLimit = 0
            }
        }

        if (ctx.scene.state.waiting) {
            ctx.markMessageToDelete(ctx, ctx.update.message);
        }

        ctx.scene.state.waiting = false;
        return ctx.scene.reenter();
    });

    return scene;
}