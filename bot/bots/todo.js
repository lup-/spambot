const { Telegraf } = require('telegraf');
const {initManagers} = require('../managers');
const {catchErrors} = require('./helpers/common');

const session = require('telegraf/session');
const store = new Map();

const Stage = require('telegraf/stage');
const todoStage = require('./scenes/todo/todos');
const tzStage = require('./scenes/todo/tzsetup');
const {postpone, complete, postponeMenu} = require('./helpers/postpone');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);

initManagers(['chat', 'periodic', 'profile']).then(async ({chat, periodic, profile}) => {
    const stage = new Stage();
    stage.register(todoStage(periodic));
    stage.register(tzStage(periodic, profile));

    app.catch(catchErrors);

    app.use(session({store}));
    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());
    app.use(profile.initSessionProfileMiddleware());
    app.use(stage.middleware());

    app.command('time', async ctx => {
        return ctx.scene.enter('tzsetup');
    });
    app.start(async (ctx) => {
        try {
            return ctx.scene.enter('todos');
        }
        catch (e) {}
    });

    app.action(/complete_(.*)/i, ctx => complete(ctx, periodic));
    app.action(/postpone_(.*?)_(.*)/i, ctx => postpone(ctx, periodic));

    app.action(/.*/, ctx => ctx.scene.enter('todos'));
    app.on('message', ctx => ctx.scene.enter('todos'));

    app.launch();

    periodic.setTaskRunner(async task => {
        try {
            let message = await app.telegram.sendMessage(task.chatId, task.text, postponeMenu(task.taskId));
            if (message && message.message_id) {
                await periodic.setTaskRemindSuccess(task.taskId);
            }
        }
        catch (e) {
            if (e && e.code === 403) {
                await periodic.setTaskComplete(task.taskId);
            }
        }
    });

    periodic.launch();
});