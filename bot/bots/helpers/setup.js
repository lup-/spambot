const fs = require('fs');
const path = require('path');

const Stage = require('telegraf/stage');
const session = require('telegraf/session');

const store = new Map();
const {catchErrors, clone} = require('../helpers/common');

const SafeReplyMiddleware = require('../../modules/SafeReplyMiddleware');
const SaveActivityMiddleware = require('../../modules/SaveActivityMiddleware');
const checkSubscriptionMiddleware = require('../../modules/CheckSubscriptionMiddleware');
const toggleBlockedMiddleware = require('../../modules/toggleBlockedMiddleware');
const {menu} = require('../helpers/wizard');
const {__} = require('../../modules/Messages');

const {init} = require('../../managers');

class Injector {
    constructor(app) {
        this.app = app;
        this.stage = false;
    }

    addSession(initialState = {}, ttlSec = false) {
        let opts = {store};
        if (ttlSec && ttlSec > 0) {
            opts.ttl = ttlSec;
        }

        this.app.use(session(opts));

        let hasInitialState = initialState && Object.keys(initialState).length > 0;
        if (hasInitialState) {
            this.app.use((ctx, next) => {
                let hasEmptySession = ctx && ctx.session && typeof (ctx.session) === 'object' && Object.keys(ctx.session).length === 0;
                if (hasEmptySession) {
                    ctx.session = clone(initialState);
                }

                return next();
            });
        }
        return this;
    }

    addSafeReply(blockedHandler = null, errorsHandler = null) {
        errorsHandler = errorsHandler ? errorsHandler : catchErrors;

        let safeReply = new SafeReplyMiddleware();
        safeReply.setDefaultFallback(errorsHandler);

        if (blockedHandler) {
            safeReply.setBlockedHandler(blockedHandler);
        }

        this.app.use(safeReply.getMiddleware());
        this.app.catch(errorsHandler);
        return this;
    }

    addIdsToSession() {
        let chat = init('chat');
        this.app.use(chat.initIdsMiddleware());
        return this;
    }

    addRefSave() {
        let chat = init('chat');
        this.app.use(chat.saveRefMiddleware());
        return this;
    }

    addUserSave() {
        let chat = init('chat');
        this.app.use(chat.saveUserMiddleware());
        return this;
    }

    addProfile() {
        let profile = init('profile');
        this.app.use(profile.initSessionProfileMiddleware());
        return this;
    }

    addSaveActivity() {
        this.app.use(SaveActivityMiddleware);
        return this;
    }

    addSubscription() {
        this.app.use(checkSubscriptionMiddleware);
        return this;
    }

    addHandleBlocks() {
        this.app.use(toggleBlockedMiddleware);
        return this;
    }

    blockNonPrivate() {
        let chat = init('chat');
        this.app.use(chat.blockNonPrivate());
        return this;
    }

    addScenes(code, params, exclude = []) {
        const stage = this.stage ? this.stage : new Stage();

        let dir = `${__dirname}/../scenes/${code}/`;
        let filenames = fs.readdirSync(dir);
        filenames.forEach(file => {
            if (exclude.indexOf(file) !== -1) {
                return;
            }

            let fullFilename = path.join(dir, file);
            let scene = require(fullFilename);
            stage.register(scene(params));
        });

        this.app.use(stage.middleware());
        this.stage = stage;

        return this;
    }

    addScene(groupCode, sceneCode, params) {
        const stage = this.stage ? this.stage : new Stage();

        let filename = `${__dirname}/../scenes/${groupCode}/${sceneCode}.js`;
        let canonicalFilename = path.normalize(filename);

        let scene = require(canonicalFilename);
        stage.register(scene(params));

        this.stage = stage;
        this.app.use(stage.middleware());
        return this;
    }

    addDisclaimer(text, afterAccept) {
        this.app.start(async ctx => {
            let messageShown = ctx && ctx.session && ctx.session.introShown;
            if (messageShown) {
                return afterAccept(ctx);
            }

            try {
                ctx.session.introShown = true;
                return ctx.replyWithHTML(__(text, ['content', 'intro']), menu([{code: '_accept', text: 'Понятно'}]));
            }
            catch (e) {
                console.log(e);
            }
        });

        this.app.action('_accept', afterAccept);
        return this;
    }

    addRoute(type, subType, handler) {
        if (typeof(subType) === 'function') {
            handler = subType;
            subType = null;
            this.app[type](handler);
        }
        else {
            this.app[type](subType, handler);
        }

        return this;
    }

    addDefaultRoute(defaultRoute, addStart = true) {
        if (addStart) {
            this.app.start(defaultRoute);
        }

        this.app.action(/.*/, defaultRoute);
        this.app.on('message', defaultRoute);
        return this;
    }

    addPerformance() {
        let perf = init('performance');
        this.app.use(perf.getMiddleware());
        return this;
    }

    get() {
        return this.app;
    }
}


module.exports = (app) => new Injector(app);