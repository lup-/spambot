const { Telegraf } = require('telegraf');
const MongoSession = require('telegraf-session-mongo');
const {md} = require('../modules/Helpers');

const {__md} = require('../modules/Messages');
const applyRoutes = require('../routers/admin');
const {getMenu} = require('../menus');
const {getDb} = require('../modules/Database');

const {initManagers} = require('../managers');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);

Promise.all([
        initManagers(['bot', 'chat', 'stat']),
        getDb()
    ])
    .then(([{chat}, db]) => {
        const session = new MongoSession(db, {});
        session.setup().then(() => {
            app.use(session.middleware);

            app.start(async (ctx) => {
                const chatInfo = ctx.update.message.chat;
                await chat.saveChat(chatInfo);

                ctx.session = {
                    userId: chatInfo.id,
                };
                return ctx.reply( __md('startMessage'), getMenu('root', ctx.session), md );
            });

            app.catch((err, ctx) => {
                console.log(err);
                let errData = {
                    code: err.code || '',
                    description: err.description || err.message || err.response.description,
                }

                return ctx.reply( __md('error', errData), getMenu('root', ctx.session), md );
            });

            applyRoutes(app);
            app.launch();
        });
    });