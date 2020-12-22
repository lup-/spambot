const fs = require('fs');
const path = require('path');

const Stage = require('telegraf/stage');
const session = require('telegraf/session');

const store = new Map();
const {catchErrors} = require('../helpers/common');

const SafeReplyMiddleware = require('../../modules/SafeReplyMiddleware');
const SaveActivityMiddleware = require('../../modules/SaveActivityMiddleware');


const {init} = require('../../managers');

class Injector {
        constructor(app) {
            this.app = app;
        }

        addSession() {
            this.app.use(session({store}));
            return this;
        }

        addSafeReply() {
            let safeReply = new SafeReplyMiddleware();
            safeReply.setDefaultFallback(catchErrors);

            this.app.use(safeReply.getMiddleware());
            this.app.catch(catchErrors);
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

        addScenes(code, params) {
            const stage = new Stage();

            let dir = `${__dirname}/../scenes/${code}/`;
            let filenames = fs.readdirSync(dir);
            filenames.forEach(file => {
                let fullFilename = path.join(dir, file);
                let scene = require(fullFilename);
                stage.register(scene(params));
            });

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
                    return ctx.reply(__(text, ['content', 'intro']), menu([{code: '_accept', text: 'Понятно'}]));
                }
                catch (e) {
                }
            });

            this.app.action('_accept', afterAccept);
            return this;
        }

        addDefaultRoute(defaultRoute) {
            this.app.start(defaultRoute);
            this.app.action(/.*/, defaultRoute);
            this.app.on('message', defaultRoute);
            return this;
        }

        get() {
            return this.app;
        }
}


module.exports = (app) => new Injector(app);