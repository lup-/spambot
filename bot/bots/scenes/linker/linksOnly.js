const BaseScene = require('telegraf/scenes/base');
const {getSingleChatInfo, generateNewLink, saveChatInfo, addLinkToChat, getChannels} = require('../../actions/linkProcessing');
const {getDb} = require('../../../modules/Database');
const {menu} = require('../../helpers/wizard');
const {clone} = require('../../helpers/common');

module.exports = function () {
    const scene = new BaseScene('linksOnly');

    scene.enter(async ctx => {
        let chat = ctx.scene.state.chat;
        let channels = ctx.scene.state.channels;
        let usersLimit = ctx.scene.state.usersLimit || 0;

        if (chat && channels && channels.length > 0) {
            let infoText = `<b>Название ссылок</b>:  ${ctx.scene.state.title || 'не задано'}

<b>Генерировать ссылки для чата</b>:  ${chat.title || 'не задано'}
            
<b>Каналов для публикации</b>: ${channels.length}

<b>Максимум вступлений по новым ссылкам</b>: ${usersLimit > 0 ? usersLimit : 'нет'}`;

            return ctx.replyWithHTML(infoText, menu([
                {code: 'replaceTitle', text: 'Поменять название'},
                {code: 'replaceChat', text: 'Поменять чат'},
                {code: 'replaceChannels', text: 'Поменять каналы'},
                {code: 'addChannels', text: 'Добавить каналы'},
                {code: 'usersLimit', text: 'Лимит пользователей'},
                {code: 'makeLinks', text: 'Создать ссылки'},
                {code: 'back', text: 'В меню'},
            ], 1));
        }
        else if (chat) {
            ctx.scene.state.waiting = 'channels';
            return ctx.reply('Пришлите список названий каналов разделенных новой строкой или ;');
        }

        ctx.scene.state.waiting = 'chat';
        return ctx.reply('Напишите ссылку на чат, для которого нужно сгенерировать ссылки');
    });

    scene.action('replaceChat', ctx => {
        ctx.scene.state.chat = null;
        ctx.scene.state.title = null;
        ctx.scene.state.waiting = 'chat';
        return ctx.scene.reenter();
    });

    scene.action('replaceTitle', ctx => {
        ctx.scene.state.waiting = 'title';
        return ctx.reply('Пришлите новое название ссылок');
    });

    scene.action('replaceChannels', ctx => {
        ctx.scene.state.channels = null;
        return ctx.scene.reenter();
    });

    scene.action('addChannels', ctx => {
        ctx.scene.state.waiting = 'channels';
        return ctx.reply('Пришлите список дополнительных каналов');
    });

    scene.action('usersLimit', ctx => {
        ctx.scene.state.waiting = 'usersLimit';
        return ctx.reply('Пришлите максимальное количество вступлений по новым ссылкам');
    });

    scene.action('makeLinks', async ctx => {
        let channels = ctx.scene.state.channels;
        let chat = ctx.scene.state.chat;
        let usersLimit = ctx.scene.state.usersLimit || 0;
        let title = ctx.scene.state.title;

        let results = {success: 0, errors: 0};
        let db = await getDb();

        await ctx.reply('Обработка начата...');

        for (let channel of channels) {
            let link = null;
            let errors = {};

            try {
                link = await generateNewLink(chat, usersLimit, ctx.telegram);
                await addLinkToChat(chat, link);
            }
            catch (e) {
                errors[chat.id] = e;
                results.errors++;
                continue;
            }

            let chatNoExtraFields = clone(chat);
            delete chatNoExtraFields.invite_links;

            let linkRecord = {
                type: 'link',
                title,
                channel,
                chats: [chat],
                generatedLinks: [link],
            }

            try {
                await db.collection('generated').insertOne(linkRecord);
                results.success++;
            }
            catch (e) {
                results.errors++;
            }

        }

        await ctx.reply(`Обработка закончена\n\nУспешно: ${results.success}\nОшибок: ${results.errors}`);
        return ctx.scene.enter('menu');
    });

    scene.action('back', ctx => ctx.scene.enter('menu'));

    scene.on('message', async (ctx, next) => {
        let post = ctx && ctx.update && ctx.update.message
            ? ctx.update.message
            : null;

        if (ctx.scene.state.waiting === 'chat') {
            let link = post.text;
            let chat = await getSingleChatInfo(link, ctx)
            if (chat) {
                await saveChatInfo([chat]);

                ctx.scene.state.chat = chat;
                ctx.scene.state.title = chat.title;
            }
            else {
                return ctx.reply('Чат не найден');
            }
        }

        if (ctx.scene.state.waiting === 'channels') {
            let oldChannels = ctx.scene.state.channels || [];
            let newChannels = getChannels(post);

            ctx.scene.state.channels = oldChannels.concat(newChannels);
        }

        if (ctx.scene.state.waiting === 'title') {
            ctx.scene.state.title = post.text;
        }

        if (ctx.scene.state.waiting === 'usersLimit') {
            try {
                ctx.scene.state.usersLimit = parseInt(post.text);
            }
            catch (e) {
                ctx.scene.state.usersLimit = 0
            }
        }

        ctx.scene.state.waiting = false;
        return ctx.scene.reenter();
    });

    return scene;
}