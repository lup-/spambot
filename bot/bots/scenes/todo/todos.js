const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {postpone, complete} = require('../../helpers/postpone');

const moment = require('moment-timezone');

const START_HOUR = 9;

function dayMenu(taskId) {
    return menu([
        {code: `day_${taskId}_today`, text: 'Сегодня'},
        {code: `day_${taskId}_tomorrow`, text: 'Завтра'},
        {code: `day_${taskId}_nextweek`, text: 'На следующей неделе'},
        {code: `day_${taskId}_exact`, text: 'Другое'}
    ], 1);
}

function timeMenu(taskId) {
    return menu([
        {code: `time_${taskId}_9h`, text: '9:00'},
        {code: `time_${taskId}_15h`, text: '15:00'},
        {code: `time_${taskId}_exact`, text: 'Другое'},
    ])
}

module.exports = function (periodic) {
    const scene = new BaseScene('todos');

    scene.enter(async (ctx) => {
        let hasZone = ctx.session.profile && ctx.session.profile.zone;

        try {
            if (!hasZone) {
                return ctx.scene.enter('tzsetup');
            }

            return ctx.reply('Напиши о чем тебе напомнить');
        }
        catch (e) {}
    });

    scene.command('start', ctx => ctx.scene.reenter());
    scene.command('time', ctx => ctx.scene.enter('tzsetup'));

    scene.on('message', async ctx => {
        let hasMessage = ctx && ctx.update && ctx.update.message;
        let messageTarget = ctx.session.messageTarget;
        ctx.session.messageTarget = false;

        if (!hasMessage) {
            return ctx.scene.reenter();
        }

        if (messageTarget === 'day') {
            let dateText = ctx.update.message.text;
            let taskId = ctx.session.taskId;
            let validDate = /\d{2}\.\d{2}\.\d{4}/.test(dateText);

            if (taskId && validDate) {
                try {
                    let date = moment(dateText, 'DD.MM.YYYY');
                    if (date.isValid()) {
                        let newTime = date.startOf('d').hour(START_HOUR);;
                        let updatedTask = await periodic.setTaskTime(taskId, newTime);
                        ctx.session.taskId = false;
                        return ctx.reply('Хорошо. Напомню ' + moment.unix(updatedTask.nextRemind).tz(ctx.session.profile.zone).format('DD.MM.YYYY'), timeMenu(taskId));
                    }
                }
                catch (e) {}
            }

            return ctx.reply('Напишите дату в формате 31.12.2020');
        }
        else if (messageTarget === 'time') {
            let timeText = ctx.update.message.text;
            let taskId = ctx.session.taskId;
            let validTime = /\d{1,2}:\d{1,2}/.test(timeText);

            if (taskId && validTime) {
                try {
                    let [h, m] = timeText.split(':').map(val => parseInt(val));
                    let task = await periodic.getTask(taskId);
                    let time = moment.unix(task.nextRemind).tz(ctx.session.profile.zone);
                    let newTime = time.hour(h).minute(m);
                    let updatedTask = await periodic.setTaskTime(taskId, newTime);
                    ctx.session.taskId = false;
                    return ctx.reply('Хорошо. Напомню ' + moment.unix(updatedTask.nextRemind).tz(ctx.session.profile.zone).format('DD.MM.YYYY в HH:mm'));
                }
                catch (e) {}
            }

            return ctx.reply('Напишите время в формате 13:50');
        }
        else {
            let userId = ctx.update.message.from.id;
            let chatId = ctx.update.message.chat.id;
            let taskText = ctx.update.message.text;
            let zone = ctx.session.profile.zone;

            let task = await periodic.addTask(taskText, userId, chatId, zone);
            ctx.session.taskId = task.taskId;

            return ctx.reply(task.text, dayMenu(task.taskId));
        }
    });

    scene.action(/day_(.*?)_(.*)/i, async ctx => {
        let [, taskId, dayType] = ctx.match;
        let userTime = moment().tz(ctx.session.profile.zone);

        let newTime = userTime.add(1, 'h');
        if (dayType === 'tomorrow') {
            newTime = userTime.add(1, 'd').startOf('d').hour(START_HOUR);
        }
        else if (dayType === 'nextweek') {
            newTime = userTime.add(1, 'w').startOf('w').hour(START_HOUR);
        }
        else if (dayType === 'exact') {
            ctx.session.messageTarget = 'day';
            ctx.session.taskId = taskId;
            return ctx.reply('Напишите дату в формате 31.12.2020');
        }

        try {
            let updatedTask = await periodic.setTaskTime(taskId, newTime);
            let taskTime = moment.unix(updatedTask.nextRemind).tz(ctx.session.profile.zone).format('DD.MM.YYYY');
            return ctx.reply('Хорошо. Напомню ' + taskTime, timeMenu(taskId));
        }
        catch (e) {
            console.log(e);
            return ctx.scene.reenter();
        }
    });

    scene.action(/time_(.*?)_(.*)/i, async ctx => {
        let [, taskId, timeType] = ctx.match;
        if (timeType === 'exact') {
            ctx.session.messageTarget = 'time';
            ctx.session.taskId = taskId;
            return ctx.reply('Напишите время в формате 13:50');
        }

        let task = await periodic.getTask(taskId);
        let time = moment.unix(task.nextRemind).tz(ctx.session.profile.zone);
        let h = parseInt(timeType.replace('h', ''));
        let newTime = time.hour(h).minute(0);

        let updatedTask = await periodic.setTaskTime(taskId, newTime);
        let taskTime = moment.unix(updatedTask.nextRemind).tz(ctx.session.profile.zone).format('DD.MM.YYYY в HH:mm');
        return ctx.reply('Хорошо. Напомню ' + taskTime);
    });

    scene.action(/complete_(.*)/i, ctx => complete(ctx, periodic));
    scene.action(/postpone_(.*?)_(.*)/i, ctx => postpone(ctx, periodic));

    return scene;
}