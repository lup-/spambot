const BaseScene = require('telegraf/scenes/base');
const {getChatsInfo, generateNewLink, replaceMessageLinks, saveChatInfo, addLinkToChat, getChannels} = require('../../actions/linkProcessing');
const {getDb} = require('../../../modules/Database');
const {menu} = require('../../helpers/wizard');
const {clone} = require('../../helpers/common');

function getUniqueChats(chats) {
    return Object.keys(chats)
        .map(link => chats[link])
        .filter(chat => chat && chat.id)
        .filter((chat, index, all) => all.findIndex(item => item.id === chat.id) === index);
}

function getLinksToTargetChat(linksChatsMap, targetChat) {
    let links = Object.keys(linksChatsMap);
    return links.filter(link => linksChatsMap[link].id === targetChat.id);
}

module.exports = function () {
    const scene = new BaseScene('post');

    scene.enter(async ctx => {
        let chat = ctx.scene.state.chat;
        let post = ctx.scene.state.post;
        let channels = ctx.scene.state.channels;
        let usersLimit = ctx.scene.state.usersLimit || 0;
        let timeLimitInHours = ctx.scene.state.timeLimitInHours || 0;
        let messageText = post ? post.text || post.caption : false;

        if (messageText && channels && channels.length > 0) {
            let wordEnd = messageText.indexOf(' ', 50);
            let postBrief = messageText.slice(0, wordEnd);
            let infoText = `<b>Генерировать посты для проекта</b>:  ${chat.title || 'не задано'}

<b>Название группы постов</b>:  ${ctx.scene.state.title || 'не задано'}
            
<b>Каналов для публикации</b>: ${channels.length}

<b>Максимум вступлений по новым ссылкам</b>: ${usersLimit > 0 ? usersLimit : 'нет'}

<b>Ограничения жизни новых ссылок в часах</b>: ${timeLimitInHours > 0 ? timeLimitInHours : 'нет'}

<b>Текст</b>: ${postBrief}...
`;

            return ctx.replyWithDisposableHTML(infoText, menu([
                {code: 'replaceTitle', text: 'Поменять название группы'},
                {code: 'replacePost', text: 'Поменять пост'},
                {code: 'replaceChannels', text: 'Поменять каналы'},
                {code: 'usersLimit', text: 'Лимит пользователей'},
                {code: 'timeLimitInHours', text: 'Лимит жизни ссылок'},
                {code: 'makeLinks', text: '🎲 Сгенерировать посты 🎲'},
                {code: 'back', text: '⬅ В меню ссылок'},
            ], 1));
        }
        else if (post) {
            ctx.scene.state.waiting = 'channels';
            return ctx.replyWithDisposableHTML(`Отправьте мне список названий каналов для группы объявлений.
            Например: <code>Канал1; Канал2; Канал3;</code> или разделенные новой строкой.
            
            Это нужно для того, чтобы отправлять их прямо из чата с собеседником.`);
        }

        ctx.scene.state.waiting = 'post';
        return ctx.replyWithDisposableHTML('Напишите или перешлите пост-шаблон');
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
        return ctx.replyWithDisposableHTML('Пришлите новое название группы');
    });

    scene.action('replaceChannels', ctx => {
        ctx.scene.state.channels = null;
        return ctx.scene.reenter();
    });

    scene.action('usersLimit', ctx => {
        ctx.scene.state.waiting = 'usersLimit';
        return ctx.replyWithDisposableHTML('Пришлите максимальное количество вступлений по новым ссылкам');
    });

    scene.action('timeLimitInHours', ctx => {
        ctx.scene.state.waiting = 'timeLimitInHours';
        return ctx.replyWithDisposableHTML('Пришлите максимальное количество вступлений по новым ссылкам');
    });

    scene.action('makeLinks', async ctx => {
        let srcChat = ctx.scene.state.chat;
        let channels = ctx.scene.state.channels;
        let foundChatsAndLinks = ctx.scene.state.chats || {};
        let linksToChat = ctx.scene.state.linksToChat || [];
        let usersLimit = ctx.scene.state.usersLimit || 0;
        let timeLimitInHours = ctx.scene.state.timeLimitInHours || 0;
        let post = ctx.scene.state.post;
        let title = ctx.scene.state.title;

        let results = {success: 0, errors: 0};
        let db = await getDb();

        await ctx.replyWithDisposableHTML('Обработка начата...');

        for (let channel of channels) {
            let postLinks = {};
            let errors = {};

            let newLink = null;
            try {
                newLink = await generateNewLink(srcChat, usersLimit, timeLimitInHours, ctx.telegram);
                await addLinkToChat(srcChat, newLink);
            }
            catch (e) {
                errors[channel] = e;
            }

            let linkMappings = linksToChat.reduce((mappings, oldLink) => {
                    mappings[oldLink] = newLink;
                    return mappings;
                }, {});

            let hasNoErrors = Object.keys(errors).length === 0 && newLink;

            if (hasNoErrors) {
                let newPost = replaceMessageLinks(post, linkMappings);
                let linkMappingsForDb = Object.keys(linkMappings).map(old => ({oldLink: old, newLink: linkMappings[old]}));
                let chatNoExtraFields = clone(srcChat);
                delete chatNoExtraFields.invite_links;

                let userId = ctx.from.id;

                let linkRecord = {
                    type: 'post',
                    userId,
                    title,
                    channel,
                    usersLimit,
                    timeLimitInHours,
                    chat: chatNoExtraFields,
                    newLink,
                    srcPost: post,
                    post: newPost,
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

        let extra = menu([
            {code: 'back', text: 'В меню проекта'},
            {code: 'reset', text: 'Сгенерировать еще'}
        ], 1);

        return ctx.replyWithDisposableHTML(`<b>Обработка закончена</b>\n\nУспешно: ${results.success}\nОшибок: ${results.errors}`, extra);
    });

    scene.action('back', ctx => ctx.scene.enter('menu', {chat: ctx.scene.state.chat}));
    scene.action('backLinks', ctx => ctx.scene.enter('linksMenu', {chat: ctx.scene.state.chat}));

    scene.on('message', async (ctx, next) => {
        let targetChat = ctx.scene.state.chat;
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
                let linksToChat = getLinksToTargetChat(chats, targetChat);

                if (linksToChat.length === 0) {
                    return ctx.replyWithDisposableHTML(
                        'В этом посте не найдены ссылки на выбранный чат. Попробуйте другой пост или вернитесь в меню проекта',
                        menu([{code: 'backLinks', text: '⬅ В меню проекта'}])
                    );
                }

                ctx.scene.state.linksToChat = linksToChat;
                ctx.scene.state.chats = chats;
                ctx.scene.state.missing = missing;

                let links = Object.keys(chats);
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

        if (ctx.scene.state.waiting === 'timeLimitInHours') {
            try {
                ctx.scene.state.timeLimitInHours = parseInt(post.text);
            }
            catch (e) {
                ctx.scene.state.timeLimitInHours = 0;
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