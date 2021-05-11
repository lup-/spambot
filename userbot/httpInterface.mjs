import Koa from 'koa'
import Router from '@koa/router'
import bodyParser from 'koa-bodyparser'
import {toObject} from "airgram";

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

        const router = new Router();
        router.post('/code', catchErrors(this, this.code) );
        router.get( '/me', catchErrors(this, this.me) );
        router.post('/invite', catchErrors(this, this.invite))

        this.httpIO = new Koa();
        this.httpIO.use(bodyParser()).use(router.routes()).use(router.allowedMethods());
    }

    triggerCallbacks(updateType, ctx) {
        console.log(updateType);
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
        const me = toObject(await this.airgram.api.getMe());
        ctx.body = {me};
    }

    async invite(ctx) {
        let {link} = ctx.request.body;
        try {
            let info = toObject(await this.airgram.api.checkChatInviteLink({inviteLink: link}));
            let loadedInfo = await this.once([
                'updateSupergroupF',
                'updateSupergroup',
                'updateBasicGroup',
                'updateNewChat'
            ], ctx => {
                return ctx.update;
            }, 500);

            ctx.body = {info, loadedInfo}
        }
        catch (e) {
            ctx.body = {error: e.toString()}
        }
    }

    launch() {
        return this.httpIO.listen(3000, '0.0.0.0');
    }
}
