const axios = require('axios');
const { Telegraf } = require('telegraf');
const setupBot = require('./helpers/setup');
const {getDb} = require('../modules/Database');
const BOT_TOKEN = process.env.BOT_TOKEN;
const USERBOT_URL = process.env.USERBOT_URL;
const SECRET_HASH = process.env.SECRET_HASH;

let userbot = null;

async function updateChatInfo(ctx) {
    let chatId = ctx.chat && ctx.chat.id;
    if (!ctx.chat) {
        chatId = ctx.update && ctx.update.my_chat_member && ctx.update.my_chat_member.chat && ctx.update.my_chat_member.chat.id;
    }

    if (!chatId) {
        return;
    }

    let chatInfo = await ctx.tg.getChat(chatId);
    let db = await getDb();
    await db.collection('chats').replaceOne({id: chatId}, chatInfo, {upsert: true});
}
async function initUserbot(tg) {
    let me = await tg.getMe();
    let {data} = await axios.post(USERBOT_URL + '/initBot', {bot: me});
    userbot = {bot: data.me};
    return data;
}

let app = setupBot(new Telegraf(BOT_TOKEN))
    .addHandleBlocks()
    .addState()
    .addSession({})
    .addSafeReply()
    .addIdsToSession()
    .addRefSave()
    .addUserSave()
    .addProfile()
    .addSaveActivity()
    .addAutoDeleteMessages()
    .addMiddleware(async (ctx, next) => {
        ctx.userbot = userbot;
        return next();
    })
    .addScenes('linker')
    .addMiddleware(async (ctx, next) => {
        try {
            let memberChanged = ctx && ctx.update && ctx.update.my_chat_member && ctx.update.my_chat_member.new_chat_member;
            let meChanged = memberChanged && ctx.update.my_chat_member.new_chat_member.user && ctx.update.my_chat_member.new_chat_member.user.id === ctx.botInfo.id;
            if (meChanged) {
                let gotRights = ctx.update.my_chat_member.new_chat_member.status === 'administrator';
                if (gotRights) {
                    await updateChatInfo(ctx);
                }
            }
        }
        catch (e) {}
        next();
    })
    .addRoute('command', 'start', async (ctx, next) => {
        let text = ctx && ctx.update && ctx.update.message && ctx.update.message.text;
        let param = text ? text.replace('/start ', '') : null;

        let isUserbotIntroducing = param && param === SECRET_HASH;
        if (isUserbotIntroducing) {
            userbot = { bot: userbot.bot || null, chat: ctx.chat, user: ctx.from };
            return ctx.reply('Блип-блоп');
        }

        let isPrivate = ctx.chat && ctx.chat.type === 'private';

        if (isPrivate) {
            return ctx.scene.enter('menu');
        }
        else {
            return next();
        }
    })
    .addRoute('command', 'code', async ctx => {
        let text = ctx && ctx.update && ctx.update.message && ctx.update.message.text || '';
        let code = text.replace('/code ', '');
        if (code) {
            await axios.post(USERBOT_URL+'/code', {code});
            return ctx.reply('Код отправлен');
        }
    })
    .addRoute('on', 'message', async (ctx, next) => {
        try {
            let newChatMember = ctx && ctx.update && ctx.update.message && ctx.update.message.new_chat_member;
            let thisBotAddedToNewChat = newChatMember && ctx.update.message.new_chat_member.id == ctx.botInfo.id;
            let isPrivate = ctx.chat.type === 'private';

            if (thisBotAddedToNewChat) {
                await updateChatInfo(ctx);
            }

            if (isPrivate) {
                next();
            }
        }
        catch (e) {}
    })
    .addRoute('on', 'inline_query', async (ctx) => {
        try {
            let queryParts = ctx.inlineQuery.query.split(';');
            let postName = queryParts[0] ? queryParts[0].trim() : false;
            let channelName = queryParts[1] ? queryParts[1].trim(): false;
            let userId = ctx.from.id;
            if (postName && !channelName) {
                channelName = postName;
            }

            let db = await getDb();
            let query = {
                userId,
                type: 'post',
                $or: [
                    {title: {$regex: `.*${postName}.*`, $options: 'i'}},
                    {channel: {$regex: `.*${channelName}.*`, $options: 'i'}}
                ]
            };

            let foundItems = await db.collection('generated').find(query).limit(10).toArray();

            let results = [];

            for (const item of foundItems) {
                let result = {
                    type: 'article',
                    id: item._id.toString(),
                    title: `${item.title} для ${item.channel}`,
                    description: item.type === 'post' ? 'пост': 'ссылка',
                    input_message_content: item.type === 'post'
                        ? {message_text: item.post.text, entities: item.post.entities}
                        : {message_text: item.generatedLinks[0] || "нет ссылки"},
                }

                results.push(result);
            }

            return ctx.answerInlineQuery(results);
        }
        catch (e) {
            console.log(e);
        }
    })
    .blockNonPrivate()
    .addDefaultRoute(ctx => ctx.scene.enter('menu'))
    .get();

(async () => {
    await initUserbot(app.telegram);
    await app.launch();
})();
