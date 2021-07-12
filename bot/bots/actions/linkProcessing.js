const axios = require('axios');
const moment = require('moment');
const {getDb} = require('../../modules/Database');
const {clone} = require('../helpers/common');
const {wait} = require('../../modules/Helpers');

const USERBOT_URL = process.env.USERBOT_URL;
const API_FLOOD_THRESHOLD_MSEC = 300;

function callApi(route, params) {
    return axios.post(USERBOT_URL + '/' + route, params);
}

function getChatId(chat) {
    return chat.username ? '@'+chat.username : chat.id;
}

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
            if (chat.invite_links) {
                for (let additionalLink of chat.invite_links) {
                    inviteChats[additionalLink] = chat;
                }
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
            let {data} = await callApi('chatByUsername', {username});
            if (data && data.info) {
                let chat = data.info;
                foundChats[url] = chat;
                continue;
            }
        }

        let {data} = await callApi('chatByInvite', {link: url});
        if (data && data.info) {
            let chat = data.info;
            foundChats[url] = chat;
            continue;
        }

        notFoundLinks.push(url);
    }

    return {found: foundChats, missing: notFoundLinks}
}

async function getChatMember(chat, ctx) {
    let me = await ctx.tg.getMe();
    let botId = me.id;
    let chatId = getChatId(chat);
    return ctx.tg.getChatMember(chatId, botId);
}

async function checkAdminAccess(chat, ctx) {
    try {
        const member = await getChatMember(chat, ctx);
        let isAdmin = member && (member.status === 'creator' || member.status === 'administrator');
        return isAdmin;
    }
    catch (e) {
        return false;
    }
}

async function checkAddAdminRights(chat, ctx) {
    try {
        const member = await getChatMember(chat, ctx);
        let hasAddAdminRights = member.can_promote_members;
        return hasAddAdminRights;
    }
    catch (e) {
        return false;
    }
}

async function getSingleChatInfo(url, ctx) {
    let chats = await getDbChatsByUrls([url]);
    if (chats && chats.length > 0) {
        return chats[0];
    }

    await sendMessageToUserbotSoTdlibCanCatchObjectsFromIt(url, ctx);

    let isInviteLink = url.indexOf('/joinchat/') !== -1;

    if (isInviteLink) {
        let {data} = await callApi('chatByInvite', {link: url});
        if (data && data.info) {
            return data.info;
        }
    }
    else {
        let username = url.replace('https://t.me/', '');
        let {data} = await callApi('chatByUsername', {username});
        if (data && data.info) {
            return data.info;
        }
    }

    return null;
}

async function getSingleChatInfoById(chatId, ctx) {
    let db = await getDb();
    chatId = parseInt(chatId);
    let chat = await db.collection('chats').findOne({id: chatId});

    if (!chat) {
        let {data} = await callApi('chatByChatId', {id: chatId});

        if (data && data.info) {
            chat = data.info;
        }
    }

    if (chat) {
        let userId = ctx.from.id;
        let options = await db.collection('chatOptions').findOne({chatId, userId});
        chat.options = options || {};
        return chat;
    }

    return false;
}

async function userbotGenerateNewLink(chat, usersLimit, timeLimitInHours) {
    try {
        let chatId = getChatId(chat);
        let {data} = await callApi('generateLink', {chatId, usersLimit, timeLimitInHours});
        if (data && data.invite && data.invite.link) {
            return data.invite.link;
        }

        return false;
    }
    catch (e) {
        return false;
    }
}

async function generateNewLink(chat, usersLimit, timeLimitInHours, tg) {
    let generateByUserbot = chat && chat.options && chat.options.useUserbot;
    if (generateByUserbot) {
        return userbotGenerateNewLink(chat, usersLimit, timeLimitInHours);
    }

    let chatId = getChatId(chat);
    let requestData = {chat_id: chatId};
    if (usersLimit > 0) {
        requestData['member_limit'] = usersLimit;
    }

    if (timeLimitInHours > 0) {
        let nowTimestamp = moment().unix();
        let timeLimitInSeconds = timeLimitInHours * 60 * 60;
        requestData['expire_date'] = nowTimestamp + timeLimitInSeconds;
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

async function saveUserChatInfo(chat, user, options = {}) {
    let db = await getDb();
    let upsertChat = clone(chat);
    await db.collection('chats').updateOne({id: chat.id}, {$setOnInsert: upsertChat}, {upsert: true});
    await db.collection('users').updateOne({id: user.id}, {$addToSet: {chats: chat.id}});
    if (options && Object.keys(options).length > 0) {
        await db.collection('chatOptions').updateOne({chatId: chat.id, userId: user.id}, {$set: options}, {upsert: true});
    }
}

async function addLinkToChat(chat, link) {
    let db = await getDb();
    return db.collection('chats').updateOne({id: chat.id}, {$addToSet: {invite_links: link}});
}

async function getChatStat(chat, ctx) {
    let {data: joinInfo} = await callApi('joinChat', {chat});
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

    let {data: statInfo} = await callApi('chatStat', {chat});

    let {data: leaveInfo} = await callApi('leaveChat', {chat});

    return statInfo && statInfo.stat ? statInfo.stat : null;
}

async function getUserLinkedChats(user) {
    let db = await getDb();
    let chats = await db.collection('users').aggregate([
        { $match: {id: user.id} },
        { $unwind: "$chats" },
        { $lookup: {from: "chats", localField: "chats", foreignField: "id", as: "userChat"} },
        { $unwind: "$userChat" },
        { $replaceRoot: {newRoot: "$userChat"} },
        { $lookup: {
            from: "chatOptions",
            let: {chatId: "$id"},
            pipeline: [
                { $match: {userId: user.id, chatId: "$$chatId"} }
            ],
            as: "options"
        } },
        { $unwind: {path: "$options", preserveNullAndEmptyArrays: true} },
    ]).toArray();

    return chats;
}

async function getUserLinks(user, chatId = false, group = false) {
    let db = await getDb();
    let filter = {};

    if (chatId) {
        filter = {"chat.id": chatId};
    }
    else {
        let chats = await getUserLinkedChats(user);
        let chatIds = chats.map(chat => chat.id);

        filter = {"chat.id": {$in: chatIds}};
    }

    if (group) {
        filter.title = group.toLowerCase() === 'без группы' || group.toLowerCase() === 'без названия'
            ? {$in: [null, false]}
            : group;
    }

    let links = await db.collection('generated').find(filter).toArray();
    return links;
}

async function getUserLinkGroups(user, chatId = false, group = false) {
    let links = await getUserLinks(user, chatId);
    let groups = links.map(link => link.title || 'Без названия');
    let uniqueGroups = groups.filter((link, index, allLinks) => allLinks.indexOf(link) === index);

    return uniqueGroups;
}

async function addUserbotToChat(chat, ctx) {
    try {
        let {data: joinInfo} = await callApi('joinChat', {chat_id: chat.id});
        if (joinInfo.error) {
            return false;
        }
    }
    catch (e) {
        return false;
    }

    try {
        let chatId = getChatId(chat);
        let botPromoted = await ctx.tg.promoteChatMember(chatId, ctx.userbot.user.id, {
            can_post_messages: false,
            can_edit_messages: false,
            can_delete_messages: false,
            can_change_info: false,
            can_invite_users: true,
            can_manage_chat: true,
        });

        return botPromoted;
    }
    catch (e) {
        return false;
    }
}

function getChannels(message) {
    return message.text.replace(/;/g, '\n').split('\n').filter(channel => channel && channel.length > 0)
}

async function removeLinkGroup(user, chat, group = false, tg) {
    let db = await getDb();
    let chatId = chat.id;
    let tgChatId = getChatId(chat);
    let revokeByUserbot = chat && chat.options && chat.options.useUserbot;

    let links = await getUserLinks(user, chatId, group);
    let noErrors = true;
    for (let link of links) {
        try {
            let requestData = {chat_id: tgChatId, invite_link: link.newLink};

            await wait(API_FLOOD_THRESHOLD_MSEC);
            if (revokeByUserbot) {
                try {
                    await callApi('revokeLink', {chatId, link: link.newLink});
                }
                catch (e) {
                    await tg.callApi('revokeChatInviteLink', requestData);
                }
            }
            else {
                await tg.callApi('revokeChatInviteLink', requestData);
            }

            await db.collection('generated').removeOne({_id: link._id});
        }
        catch (e) {
            noErrors = false;
        }
    }

    return noErrors;
}

function getUrlFromLinkData(linkData) {
    if (linkData.newLink) {
        return linkData.newLink;
    }

    if (linkData.generatedLinks && linkData.generatedLinks[0]) {
        return linkData.generatedLinks[0];
    }

    return false;
}

async function getLinkGroupStat(user, chatId = false, group = false) {
    let linksData = await getUserLinks(user, chatId, group);
    let links = linksData.map(getUrlFromLinkData).filter(url => url && url.length > 0);

    let statCount = [];

    for (let link of links) {
        let hash = link.replace('https://t.me/joinchat/', '');
        let {data: stat} = await callApi('linksStat', {link});

        statCount.push({
            link,
            hash,
            count: stat && stat.info && stat.info.count ? stat.info.count : 0,
            botHasAccess: Boolean(stat && stat.info)
        });
    }

    return statCount;
}

module.exports = {
    getLinks,
    getChatsInfo,
    getSingleChatInfo,
    getSingleChatInfoById,
    generateNewLink,
    replaceMessageLinks,
    saveChatInfo,
    saveUserChatInfo,
    checkAdminAccess,
    checkAddAdminRights,
    addLinkToChat,
    addUserbotToChat,
    getChannels,
    getChatStat,
    getUserLinks,
    getUserLinkGroups,
    getUserLinkedChats,
    removeLinkGroup,
    getLinkGroupStat,
    getUrlFromLinkData
}
