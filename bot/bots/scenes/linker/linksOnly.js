const BaseScene = require('telegraf/scenes/base');
const {getSingleChatInfo, generateNewLink, saveChatInfo, addLinkToChat, getChannels} = require('../../actions/linkProcessing');
const {getDb} = require('../../../modules/Database');
const {menu} = require('../../helpers/wizard');
const {clone} = require('../../helpers/common');

module.exports = function () {
    const scene = new BaseScene('linksOnly');

    scene.enter(async ctx => {
        let chat = ctx.scene.state.chat;
        let linksCount = ctx.scene.state.linksCount || 0;
        let usersLimit = ctx.scene.state.usersLimit || 0;
        let timeLimitInHours = ctx.scene.state.timeLimitInHours || 0;

        if (chat && linksCount > 0) {
            let infoText = `<b>Генерировать ссылки для проекта</b>:  ${chat.title || 'не задано'}

<b>Название группы ссылок</b>:  ${ctx.scene.state.title || 'не задано'}
            
<b>Сколько ссылок нужно сделать</b>: ${linksCount}

<b>Максимум вступлений по новым ссылкам</b>: ${usersLimit > 0 ? usersLimit : 'нет'}

<b>Ограничения жизни новых ссылок в часах</b>: ${timeLimitInHours > 0 ? timeLimitInHours : 'нет'}
`;

            return ctx.replyWithDisposableHTML(infoText, menu([
                {code: 'replaceTitle', text: 'Поменять название группы'},
                {code: 'linksCount', text: 'Поменять количество ссылок'},
                {code: 'usersLimit', text: 'Лимит пользователей'},
                {code: 'timeLimitInHours', text: 'Лимит жизни ссылок'},
                {code: 'makeLinks', text: '🎲 Сгенерировать 🎲'},
                {code: 'back', text: '⬅ В меню ссылок'},
            ], 1));
        }

        ctx.scene.state.waiting = 'linksCount';
        return ctx.replyWithDisposableHTML(`Отправьте количество ссылок, которые нужно сегенрировать`);
    });

    scene.action('replaceChat', ctx => {
        ctx.scene.state.chat = null;
        ctx.scene.state.title = null;
        ctx.scene.state.waiting = 'chat';
        return ctx.scene.reenter();
    });

    scene.action('replaceTitle', ctx => {
        ctx.scene.state.waiting = 'title';
        return ctx.replyWithDisposableHTML('Пришлите новое название ссылок');
    });

    scene.action('linksCount', ctx => {
        ctx.scene.state.linksCount = null;
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
        let chat = ctx.scene.state.chat;
        let linksCount = ctx.scene.state.linksCount || 0;
        let usersLimit = ctx.scene.state.usersLimit || 0;
        let timeLimitInHours = ctx.scene.state.timeLimitInHours || 0;
        let title = ctx.scene.state.title;

        let results = {success: 0, errors: 0};
        let db = await getDb();

        await ctx.replyWithDisposableHTML('Обработка начата...');

        let errors = {};
        let generatedList = [];
        for (let index = 0; index < linksCount; index++) {
            let link = null;

            try {
                link = await generateNewLink(chat, usersLimit, timeLimitInHours, ctx.telegram);
                await addLinkToChat(chat, link);
            }
            catch (e) {
                errors[chat.id] = e;
                results.errors++;
                continue;
            }

            let chatNoExtraFields = clone(chat);
            let userId = ctx.from.id;
            delete chatNoExtraFields.invite_links;

            let linkRecord = {
                type: 'link',
                userId,
                title,
                usersLimit,
                timeLimitInHours,
                chat: chatNoExtraFields,
                newLink: link,
            }

            try {
                await db.collection('generated').insertOne(linkRecord);
                generatedList.push({title, link});

                results.success++;
            }
            catch (e) {
                results.errors++;
            }
        }

        await ctx.replyWithDisposableHTML(`Обработка закончена\n\nУспешно: ${results.success}\nОшибок: ${results.errors}`);

        if (results.errors > 0) {
            let uniqueErrors = Object.values(errors).map(e => e.message).filter( (msg, index, all) => all.indexOf(msg) === index );
            return await ctx.replyWithDisposableHTML(`Обнаруженные ошибки:\n\n${uniqueErrors.join('\n')}`, menu([
                {code: 'back', text: 'В меню'},
                {code: 'retry', text: 'Попробовать снова'}
            ], 1));
        }

        if (results.success > 0) {
            let linksList = generatedList.map(generated => generated.link).join('\n');
            let extra = menu([
                {code: 'back', text: 'В меню проекта'},
                {code: 'reset', text: 'Сгенерировать еще'}
            ], 1);
            extra.disable_web_page_preview = true;

            return await ctx.reply(`Новые ссылки для проекта ${chat.title}:\n\n${linksList}`, extra);
        }
    });

    scene.action('back', ctx => ctx.scene.enter('linksMenu', {chat: ctx.scene.state.chat}));
    scene.action('retry', ctx => ctx.scene.reenter());
    scene.action('reset', ctx => {
        ctx.scene.state.channels = null;
        ctx.scene.state.linksCount = null;
        ctx.scene.state.usersLimit = null;
        ctx.scene.state.timeLimitInHours = null;
        ctx.scene.state.title = null;
        ctx.scene.state.waiting = null;
        ctx.scene.reenter();
    });

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
                return ctx.replyWithDisposableHTML('Чат не найден, попробуйте скинуть другую приватную ссылку', menu([{code: 'back', text: '⬅ Назад'}]));
            }
        }

        if (ctx.scene.state.waiting === 'linksCount') {
            try {
                ctx.scene.state.linksCount = parseInt(post.text);
            }
            catch (e) {
                ctx.scene.state.linksCount = 0;
            }
        }

        if (ctx.scene.state.waiting === 'title') {
            ctx.scene.state.title = post.text;
        }

        if (ctx.scene.state.waiting === 'usersLimit') {
            try {
                ctx.scene.state.usersLimit = parseInt(post.text);
            }
            catch (e) {
                ctx.scene.state.usersLimit = 0;
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