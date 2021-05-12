const BaseScene = require('telegraf/scenes/base');
const {getDb} = require('../../../modules/Database');
const {menu} = require('../../helpers/wizard');
const {clone} = require('../../helpers/common');
const axios = require('axios');

const TYPE_TEXT = 'Что делать?';
const COUNT_TEXT = 'Сколько нужно сообщений с разными ссылками?';
const USERS_TEXT = 'Какое ограничение по пользователям?';
const USERBOT_URL = process.env.USERBOT_URL;

function getMessagesCountButtons(ctx) {
    let messagesCount = [2, 5, 10, 20, 50];
    let selectedCount = ctx.scene.state.selectedMessages || messagesCount[0];

    let messagesButtons = messagesCount.map(count => {
        let text = count.toString();
        if (selectedCount === count) {
            text = `☑ ${text}`;
        }

        return {code: `count_${count}`, text};
    });

    return menu(messagesButtons);
}
function getUsersCountButtons(ctx) {
    let usersCount = [0, 10, 100, 500, 1000];
    let selectedCount = ctx.scene.state.selectedUsers || usersCount[0];

    let usersButtons = usersCount.map(count => {
        let text = count === 0 ? '∞' : count.toString();
        if (selectedCount === count) {
            text = `☑ ${text}`;
        }

        return {code: `users_${count}`, text};
    });

    return menu(usersButtons);
}

function getTypeButtons(ctx) {
    let types = [{code: 'posts', text: 'Посты'}, {code: 'links', text: 'Ссылки'}];
    let selectedType = ctx.scene.state.selectedType || 'posts';
    let buttons = types.map(type => {
        return {
            code: `type_${type.code}`,
            text: type.code === selectedType ? `☑ ${type.text}` : type.text
        }
    });

    return menu(buttons);
}

module.exports = function () {
    const scene = new BaseScene('message');

    scene.enter(async ctx => {
        let message = ctx.scene.state.message;
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
        })

        let tgLinks = links.filter(linkEntity => linkEntity && linkEntity.url && linkEntity.url.indexOf('https://t.me/') === 0);

        let hasLinks = tgLinks && tgLinks.length > 0;
        if (!hasLinks) {
            ctx.reply('Ссылок https://t.me/ не обнаружено');
            return ctx.scene.leave();
        }

        let inviteLinks = tgLinks.filter(linkEntity => linkEntity.url.indexOf('/joinchat/') !== -1);
        let inviteChats = {};
        if (inviteLinks.length > 0) {
            let db = await getDb();
            let urls = inviteLinks.map(linkEntity => linkEntity.url);
            let chats = await db.collection('chats').find({invite_link: {$in: urls}}).toArray();
            for (let chat of chats) {
                inviteChats[chat.invite_link] = chat;
            }
        }

        let foundChatIds = {};
        let foundChatTitles = {};
        let notFoundLinks = [];
        for (let linkEntity of tgLinks) {
            let url = linkEntity.url;
            let isInviteLink = url.indexOf('/joinchat/') !== -1;

            let chatId = null;
            let chatTitle = null;
            if (isInviteLink) {
                let chat = inviteChats[url];
                if (chat) {
                    chatId = chat.id;
                    chatTitle = chat.title;
                }
            }
            else {
                chatId = '@'+url.replace('https://t.me/', '');
                chatTitle = chatId;
            }

            if (chatId) {
                foundChatIds[url] = chatId;
                foundChatTitles[url] = chatTitle;
            }
            else {
                try {
                    let {data} = await axios.post(USERBOT_URL + '/invite', {link: url});
                    let info = data.info;
                    if (info && info.chatId && info.chatId !== 0) {
                        chatId = info.chatId;
                        foundChatIds[url] = chatId;
                        foundChatTitles[url] = info.title || '-';
                    }
                }
                catch (e) {
                    console.log(e);
                }

                if (!chatId) {
                    notFoundLinks.push(url);
                }
            }
        }

        ctx.scene.state.foundChatIds = foundChatIds;
        ctx.scene.state.foundChatTitles = foundChatTitles;
        let foundChatsCount = Object.keys(foundChatIds).length;
        let replyMessage = `Обнаружено ссылок на известные чаты: ${foundChatsCount}`;
        if (notFoundLinks.length > 0) {
            replyMessage += `\n\n<b>Внимание!</b> Эти ссылки не удалось распознать и они будут пропущены:\n${notFoundLinks.join('\n')}`;
        }

        await ctx.replyWithHTML(replyMessage);
        if (foundChatsCount > 0) {
            ctx.scene.state.typeMessage = await ctx.reply(TYPE_TEXT, getTypeButtons(ctx));
            ctx.scene.state.countMessage = await ctx.reply(COUNT_TEXT, getMessagesCountButtons(ctx));
            ctx.scene.state.usersMessage = await ctx.reply(USERS_TEXT, getUsersCountButtons(ctx));
            ctx.scene.state.readyMessage = await ctx.reply('Когда все настройки сделаны, нажмите эту кнопку', menu([{
                code: 'generate',
                text: 'Поехали!'
            }]));
        }
        else {
            return ctx.reply('Подходящих ссылок не обнаружено, попробуйте другой пост');
        }
    });

    scene.action(/count_(.*)/, async ctx => {
        let newCount = parseInt(ctx.match[1]);
        if (ctx.scene.state.selectedMessages !== newCount) {
            ctx.scene.state.selectedMessages = newCount;
            await ctx.tg.editMessageText(
                ctx.chat.id,
                ctx.scene.state.countMessage.message_id,
                undefined,
                COUNT_TEXT,
                getMessagesCountButtons(ctx)
            );
        }
    });

    scene.action(/users_(.*)/, async ctx => {
        let newCount = parseInt(ctx.match[1]);
        if (ctx.scene.state.selectedUsers !== newCount) {
            ctx.scene.state.selectedUsers = newCount;
            await ctx.tg.editMessageText(
                ctx.chat.id,
                ctx.scene.state.usersMessage.message_id,
                undefined,
                USERS_TEXT,
                getUsersCountButtons(ctx)
            );
        }
    });

    scene.action(/type_(.*)/, async ctx => {
        let newType = ctx.match[1];
        if (ctx.scene.state.selectedType !== newType) {
            ctx.scene.state.selectedType = newType;
            await ctx.tg.editMessageText(
                ctx.chat.id,
                ctx.scene.state.typeMessage.message_id,
                undefined,
                TYPE_TEXT,
                getTypeButtons(ctx)
            );
        }
    });

    scene.action('generate', async ctx => {
        let newLinksCount = ctx.scene.state.selectedMessages || 2;
        let usersLimit = ctx.scene.state.selectedUsers || 0;
        let type = ctx.scene.state.selectedType || 'posts';
        let foundChatIds = ctx.scene.state.foundChatIds;
        let foundChatTitles = ctx.scene.state.foundChatTitles;
        let newChatLinks = {};

        for (let chatLink of Object.keys(foundChatIds)) {
            let chatId = foundChatIds[chatLink];
            let requestData = {chat_id: chatId};
            if (usersLimit > 0) {
                requestData['member_limit'] = usersLimit;
            }

            newChatLinks[chatLink] = [];

            for (let i=0; i<newLinksCount; i++) {
                try {
                    let newLinkInfo = await ctx.tg.callApi('createChatInviteLink', requestData);
                    newChatLinks[chatLink].push(newLinkInfo.invite_link);
                }
                catch (e) {
                    return ctx.reply(`Ошибка создания ссылки для чата ${chatLink}\n\n${e.toString()}`);
                }
            }
        }

        if (type === 'links') {
            let linksMessage = '';
            for (let chatLink of Object.keys(newChatLinks)) {
                let newLinks = newChatLinks[chatLink];
                let chatTitle = foundChatTitles[chatLink] || '-';
                if (linksMessage !== '') {
                    linksMessage += "\n\n";
                }
                linksMessage += `<b>Ссылки для чата ${chatTitle}:</b>\n${newLinks.join('\n')}`;
            }

            return ctx.replyWithHTML(linksMessage);
        }
        else {
            let oldMessage = ctx.scene.state.message;
            let messageText = oldMessage.text || oldMessage.caption;

            for (let i = 0; i < newLinksCount; i++) {
                let newMessage = clone(oldMessage);
                let entityType = newMessage.entities ? 'entities' : 'caption_entities';

                newMessage[entityType] = newMessage[entityType].map(entity => {
                    if (entity.type === 'url') {
                        entity.type = 'text_link';
                        entity.url = messageText.substring(entity.offset, entity.offset + entity.length);
                    }

                    if (entity.type === 'text_link') {
                        let isReplaceableLink = typeof (foundChatIds[entity.url]) !== 'undefined';
                        if (isReplaceableLink) {
                            entity.url = newChatLinks[entity.url][i];
                            return entity;
                        }
                    }

                    return entity;
                });
                newMessage.chat_id = ctx.chat.id;

                await ctx.tg.callApi('sendMessage', newMessage);
            }
        }
    });

    return scene;
}