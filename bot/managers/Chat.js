const {getDb} = require('../modules/Database');
const moment = require('moment');

let chatInstance = null;

function ChatManager() {
    return {
        init() {
            return this;
        },
        async saveChat(chatFields, botName = false) {
            const db = await getDb(botName);
            const chats = db.collection('chats');
            const id = chatFields.id;

            if (!chatFields.date_registered) {
                chatFields.date_registered = moment().unix();
            }

            let updateResult = await chats.findOneAndReplace({id}, chatFields, {upsert: true, returnOriginal: false});
            return updateResult.value || false;
        },
        isStartCommand(ctx) {
            return ctx.update && ctx.update.message && ctx.update.message.text && ctx.update.message.text.toLowerCase().indexOf('/start') === 0;
        },
        initIdsMiddleware() {
            return async (ctx, next) => {
                let hasSession = ctx && ctx.session;
                let hasIds = hasSession && ctx.session.userId && ctx.session.chatId;
                let hasChat = ctx && ctx.chat;
                let hasUser = ctx && ctx.from;

                if (!hasSession || hasIds) {
                    return next();
                }

                if (hasChat) {
                    ctx.session.chatId = ctx.chat.id;
                }

                if (hasUser) {
                    ctx.session.userId = ctx.from.id;
                }

                return next();
            }
        },
        blockNonPrivate() {
            return async (ctx, next) => {
                let skipThisUpdate = ctx.chat.type !== 'private';
                if (skipThisUpdate) {
                    return;
                }

                return next();
            }
        },
        saveRefMiddleware() {
            return async (ctx, next) => {
                if (!this.isStartCommand(ctx)) {
                    return next();
                }

                let ref =ctx.update.message.text.indexOf(' ') !== -1
                    ? ctx.update.message.text.replace('/start ', '')
                    : false;
                let message = ctx.update.message;
                let userId = message && message.from
                    ? message.from.id
                    : false;

                let hasRef = userId && ref;
                let subref = false;

                if (!hasRef) {
                    return next();
                }

                let hasSubrefs = ref.indexOf('=') !== -1;
                if (hasSubrefs) {
                    let parts = ref.split('=');
                    ref = parts.shift();
                    subref = parts.join('=');
                }

                const db = await getDb();
                const refs = db.collection('refs');

                let refId = `${userId}:${ref}`;

                let refFields = {
                    refId,
                    userId,
                    ref,
                    date: moment().unix(),
                }

                if (subref) {
                    refFields.subref = subref;
                }

                try {
                    await refs.findOneAndReplace({refId}, refFields, {upsert: true, returnOriginal: false});
                }
                finally {
                }

                return next();
            }
        },
        saveUserMiddleware: function () {
            return async (ctx, next) => {

                if (!this.isStartCommand(ctx)) {
                    return next();
                }

                let message = ctx.update.message;
                let {from, chat} = message;
                let id = from.id || chat.id || false;

                if (!id) {
                    return next();
                }

                const db = await getDb();
                const users = db.collection('users');

                try {
                    let user = await users.findOne({id});
                    if (user) {
                        user.user = from;
                        user.chat = chat;
                        user.updated = moment().unix();
                    } else {
                        user = {id, user: from, chat, registered: moment().unix(), updated: moment().unix()};
                    }

                    await users.findOneAndReplace({id}, user, {upsert: true, returnOriginal: false});
                } finally {
                }

                return next();
            }
        }
    }
}

function getInstance() {
    if (chatInstance) {
        return chatInstance;
    }

    chatInstance = new ChatManager();
    return chatInstance;
}

module.exports = getInstance;