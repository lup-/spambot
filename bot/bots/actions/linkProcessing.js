const axios = require('axios');
const {getDb} = require('../../modules/Database');
const {clone} = require('../helpers/common');
const {wait} = require('../../modules/Helpers');
const USERBOT_URL = process.env.USERBOT_URL;

function getLinks(message) {
    let messageText = message.text || message.caption;
    let links = message.entities ? message.entities.filter(entity => entity.type === 'text_link' || entity.type === 'url') : [];

    if (message.caption_entities) {
        let caption_links = message.caption_entities.filter(entity => entity.type === 'text_link' || entity.type === 'url');
        links = links.concat(caption_links);
    }

    links = links.map(entity => {
        if (entity.type === 'url') {
            entity.url = messageText.substring(entity.offset, entity.offset + entity.length);
        }

        return entity;
    });

    let tgLinks = links.filter(linkEntity => linkEntity && linkEntity.url && linkEntity.url.indexOf('https://t.me/') === 0);

    return tgLinks;
}

async function getDbChatsByUrls(urls) {
    let db = await getDb();
    let chats = await db.collection('chats').find({
        $or: [
            {invite_link: {$in: urls}},
            {invite_links: {$in: urls}},
        ]
    }).toArray();
    return chats;
}

async function sendMessageToUserbotSoTdlibCanCatchObjectsFromIt(message, ctx) {
    let chatId = ctx.userbot.chat.id;
    return ctx.telegram.sendMessage(chatId, message);
}

async function getChatsInfo(message, ctx) {
    await sendMessageToUserbotSoTdlibCanCatchObjectsFromIt(message, ctx);

    let tgLinks = getLinks(message);
    let inviteLinks = tgLinks.filter(linkEntity => linkEntity.url.indexOf('/joinchat/') !== -1);

    let inviteChats = {};
    if (inviteLinks.length > 0) {
        let urls = inviteLinks.map(linkEntity => linkEntity.url);
        let chats = await getDbChatsByUrls(urls);
        for (let chat of chats) {
            inviteChats[chat.invite_link] = chat;
            for (let additionalLink of chat.invite_links) {
                inviteChats[additionalLink] = chat;
            }
        }
    }

    let foundChats = {};
    let notFoundLinks = [];

    for (let linkEntity of tgLinks) {
        let url = linkEntity.url;
        let isInviteLink = url.indexOf('/joinchat/') !== -1;

        if (isInviteLink) {
            let chat = inviteChats[url];
            if (chat) {
                foundChats[url] = chat;
                continue;
            }
        }
        else {
            let username = url.replace('https://t.me/', '');
            let {data} = await axios.post(USERBOT_URL + '/chatByUsername', {username});
            if (data && data.info) {
                let chat = data.info;
                foundChats[url] = chat;
                continue;
            }
        }

        let {data} = await axios.post(USERBOT_URL + '/chatByInvite', {link: url});
        if (data && data.info) {
            let chat = data.info;
            foundChats[url] = chat;
            continue;
        }

        notFoundLinks.push(url);
    }

    return {found: foundChats, missing: notFoundLinks}
}

async function getSingleChatInfo(url, ctx) {
    let chats = await getDbChatsByUrls([url]);
    if (chats && chats.length > 0) {
        return chats[0];
    }

    await sendMessageToUserbotSoTdlibCanCatchObjectsFromIt(url, ctx);

    let isInviteLink = url.indexOf('/joinchat/') !== -1;

    if (isInviteLink) {
        let {data} = await axios.post(USERBOT_URL + '/chatByInvite', {link: url});
        if (data && data.info) {
            return data.info;
        }
    }
    else {
        let username = url.replace('https://t.me/', '');
        let {data} = await axios.post(USERBOT_URL + '/chatByUsername', {username});
        if (data && data.info) {
            return data.info;
        }
    }

    return null;
}

async function generateNewLink(chat, usersLimit, tg) {
    const API_FLOOD_THRESHOLD_MSEC = 150;
    let requestData = {chat_id: chat.id};
    if (usersLimit > 0) {
        requestData['member_limit'] = usersLimit;
    }

    await wait(API_FLOOD_THRESHOLD_MSEC);
    let newLinkInfo = await tg.callApi('createChatInviteLink', requestData);
    return newLinkInfo.invite_link;
}

function replaceMessageLinks(message, linkMappings) {
    let newMessage = clone(message);
    let messageText = newMessage.text || newMessage.caption;
    let entityType = newMessage.entities ? 'entities' : 'caption_entities';

    newMessage[entityType] = newMessage[entityType].map(entity => {
        if (entity.type === 'url') {
            entity.type = 'text_link';
            entity.url = messageText.substring(entity.offset, entity.offset + entity.length);
        }

        if (entity.type === 'text_link') {
            entity.url = linkMappings[entity.url] || entity.url;
        }

        return entity;
    });

    return newMessage;
}

async function saveChatInfo(foundChats) {
    let db = await getDb();

    for (let invite_link in foundChats) {
        let chat = foundChats[invite_link];

        let upsertChat = clone(chat);
        upsertChat.invite_link = invite_link;
        delete upsertChat.invite_links;

        await db.collection('chats').updateOne({id: chat.id}, {$addToSet: {invite_links: invite_link}, $setOnInsert: upsertChat}, {upsert: true});
    }
}

async function addLinkToChat(chat, link) {
    let db = await getDb();
    return db.collection('chats').updateOne({id: chat.id}, {$addToSet: {invite_links: link}});
}

async function getChatStat(chat, ctx) {
    let {data: joinInfo} = await axios.post(USERBOT_URL + '/joinChat', {chat});
    if (joinInfo.error) {
        return null;
    }

    let userbotId = ctx.userbot.user.id;
    let promoteInfo = await ctx.telegram.promoteChatMember(chat.id, userbotId, {
        can_change_info: true,
        can_post_messages: true,
        can_edit_messages: true,
        can_delete_messages: true,
        can_invite_users: true,
        //can_restrict_members: true,
        //can_pin_messages: true,
        can_promote_members: true,
        can_manage_chat: true,
        can_manage_voice_chats: true,
    });

    let admins = await ctx.telegram.getChatAdministrators(chat.id);

    let {data: statInfo} = await axios.post(USERBOT_URL + '/chatStat', {chat});

    let {data: leaveInfo} = await axios.post(USERBOT_URL + '/leaveChat', {chat});

    return statInfo && statInfo.stat ? statInfo.stat : null;
}

function getChannels(message) {
    return message.text.replace(/;/g, '\n').split('\n').filter(channel => channel && channel.length > 0)
}

module.exports = {
    getLinks,
    getChatsInfo,
    getSingleChatInfo,
    generateNewLink,
    replaceMessageLinks,
    saveChatInfo,
    addLinkToChat,
    getChannels,
    getChatStat
}
