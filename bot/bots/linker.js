const axios = require('axios');
const { Telegraf } = require('telegraf');
const setupBot = require('./helpers/setup');
const {getDb} = require('../modules/Database');
const BOT_TOKEN = process.env.BOT_TOKEN;
const USERBOT_URL = process.env.USERBOT_URL;

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
            let hasForwarderMesage = ctx && ctx.update && ctx.update.message && (ctx.update.message.forward_from_message_id || ctx.update.message.forward_from);
            let newChatMember = ctx && ctx.update && ctx.update.message && ctx.update.message.new_chat_member;
            let thisBotAddedToNewChat = newChatMember && ctx.update.message.new_chat_member.id == ctx.botInfo.id;
            let isPrivate = ctx.chat.type === 'private';
            let isText = ctx && ctx.update && ctx.update.message && (ctx.update.message.text || ctx.update.message.caption);

            if (thisBotAddedToNewChat) {
                await updateChatInfo(ctx);
            }

            if (isPrivate) {
                if (hasForwarderMesage || isText) {
                    return ctx.scene.enter('message', {message: ctx.update.message});
                }
                next();
            }
        }
        catch (e) {}
    })
    .addDefaultRoute(ctx => ctx.reply('Перешлите сообщение со ссылками. Бот должен иметь админский доступ к группам ссылок'))
    .blockNonPrivate()
    .get();

app.launch();