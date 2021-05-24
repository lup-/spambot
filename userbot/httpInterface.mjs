import Koa from 'koa'
import Router from '@koa/router'
import bodyParser from 'koa-bodyparser'
import {toObject} from "airgram";

const SECRET_HASH = process.env.SECRET_HASH;

function catchErrors(thisArg, route) {
    return (ctx) => {
        try {
            return route.call(thisArg, ctx);
        }
        catch (e) {
            ctx.body = {error: e}
        }
    };
}

export default class HttpInterface {
    constructor(airgram) {
        this.airgram = airgram;
        this.onCodeRecieve = false;
        this.callbacks = {};
        this.selfInfo = null;

        const router = new Router();
        router.post('/code', catchErrors(this, this.code) );
        router.get( '/me', catchErrors(this, this.me) );
        router.post('/initBot', catchErrors(this, this.initBot));
        router.post('/chatByInvite', catchErrors(this, this.chatByInvite));
        router.post('/chatByUsername', catchErrors(this, this.chatByUsername));
        router.post('/chatByChatId', catchErrors(this, this.chatByChatId));
        router.post('/chatStat', catchErrors(this, this.chatStat));
        router.post('/joinChat', catchErrors(this, this.joinChat));
        router.post('/leaveChat', catchErrors(this, this.leaveChat));

        this.httpIO = new Koa();
        this.httpIO.use(bodyParser()).use(router.routes()).use(router.allowedMethods());
    }

    async getMe() {
        try {
            return toObject(await this.airgram.api.getMe());
        }
        catch (e) {
            return null;
        }
    }

    triggerCallbacks(updateType, ctx) {
        if (this.callbacks[updateType]) {
            for (let callback of this.callbacks[updateType]) {
                callback.call(this, ctx);
            }
        }
    }

    once(updateTypes, callback, timeout) {
        return new Promise(resolve => {
            let called = false;
            let wrapper = async ctx => {
                let result = await callback(ctx);
                called = true;
                this.removeCallback(callback);
                resolve(result);
            }

            this.addCallback(updateTypes, wrapper);
            setTimeout(() => {
                if (!called) {
                    this.removeCallback(callback);
                    resolve(null);
                }
            }, timeout);
        });
    }

    addCallback(updateTypes, callback) {
        for (const updateType of updateTypes) {
            if (!this.callbacks[updateType]) {
                this.callbacks[updateType] = [];
            }

            this.callbacks[updateType].push(callback);
        }
    }

    removeCallback(callback) {
        for (let updateType of Object.keys(this.callbacks)) {
            let callbackIndex = this.callbacks[updateType].indexOf(callback);
            if (callbackIndex !== -1) {
                this.callbacks[updateType].splice(callbackIndex, 1);
            }
        }
    }

    setCodeRecieveHandler(callback) {
        this.onCodeRecieve = callback;
    }

    async code(ctx) {
        if (this.onCodeRecieve) {
            ctx.body = {ok: true};
            let {code} = ctx.request.body;
            return this.onCodeRecieve(code);
        }

        ctx.body = {ok: false};
    }

    async me(ctx) {
        ctx.body = {me: this.selfInfo};
    }

    async initBot(ctx) {
        let {bot} = ctx.request.body;
        try {
            let searchInfo = toObject(await this.airgram.api.searchPublicChat({username: bot.username}));
            let botUserId = searchInfo.type.userId;
            let chatId = searchInfo.id;
            let info = toObject(await this.airgram.api.sendBotStartMessage({botUserId, chatId, parameter: SECRET_HASH}));
            ctx.body = {info, searchInfo, bot, me: this.selfInfo};
        }
        catch (e) {
            ctx.body = {error: e.toString()}
        }
    }

    async chatByInvite(ctx) {
        let {link} = ctx.request.body;
        try {
            let info = toObject(await this.airgram.api.joinChatByInviteLink({inviteLink: link}));
            let chatId = info.id;
            await this.airgram.api.leaveChat({chatId});

            ctx.body = {info};
        }
        catch (e) {
            if (e.message === "USER_ALREADY_PARTICIPANT" && !ctx.retry) {
                try {
                    let info = toObject(await this.airgram.api.checkChatInviteLink({inviteLink: link}));
                    let chatId = info.chatId;
                    await this.airgram.api.leaveChat({chatId});
                    сtx.retry = true;
                    return this.chatByInvite(ctx);
                }
                catch (e) {
                    ctx.body = {error: e.toString()};
                }
            }

            ctx.body = {error: e.toString()};
        }
    }

    async chatByUsername(ctx) {
        let {username} = ctx.request.body;
        if (username[0] === '@') {
            username = username.replace('@', '');
        }

        try {
            let info = toObject(await this.airgram.api.searchPublicChat({username}));
            ctx.body = {info};
        }
        catch (e) {
            ctx.body = {error: e.toString()}
        }
    }

    async chatByChatId(ctx) {
        let {id} = ctx.request.body;

        try {
            let chatId = id;
            let userId = this.selfInfo.id;
            let info = toObject(await this.airgram.api.joinChat({chatId, userId}));
            await this.airgram.api.leaveChat({chatId, userId});
            ctx.body = {info};
        }
        catch (e) {
            ctx.body = {error: e.toString()}
        }
    }

    async joinChat(ctx) {
        let {chat} = ctx.request.body;
        try {
            let chatId = chat.id;
            let userId = this.selfInfo.id;
            let info = toObject(await this.airgram.api.joinChat({chatId, userId}));

            ctx.body = {info};
        }
        catch (e) {
            try {
                let info = toObject(await this.airgram.api.joinChatByInviteLink({inviteLink: chat.invite_link}));
                ctx.body = {info}
            }
            catch (linkE) {
                ctx.body = {error: e.toString(), linkError: linkE.toString()};
            }
        }

    }

    async leaveChat(ctx) {
        let {chat} = ctx.request.body;
        try {
            let chatId = chat.id;
            let userId = this.selfInfo.id;
            let info = toObject(await this.airgram.api.leaveChat({chatId, userId}));

            ctx.body = {info};
        }
        catch (e) {
            ctx.body = {error: e.toString()};
        }
    }

    async chatStat(ctx) {
        let {chat} = ctx.request.body;
        try {
            let chatInfo = toObject(await this.airgram.api.getChat({chatId: chat.id}));
            let groupInfo = null;
            if (chatInfo.type._ === 'chatTypeSupergroup') {
                groupInfo = toObject(await this.airgram.api.getSupergroupFullInfo({supergroupId: chatInfo.type.supergroupId}));
            }
            let stat = toObject(await this.airgram.api.getChatAdministrators({chatId: chat.id}));

            ctx.body = {stat, chat: chatInfo, group: groupInfo};
        }
        catch (e) {
            ctx.body = {error: e.toString()};
        }
    }

    async init() {
        this.selfInfo = await this.getMe();
    }

    launch() {
        return this.httpIO.listen(3000, '0.0.0.0');
    }
}
