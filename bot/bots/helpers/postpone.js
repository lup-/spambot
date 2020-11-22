const {menu} = require('./wizard');
const START_HOUR = 9;
const moment = require('moment-timezone');

function postponeMenu(taskId) {
    return menu([
        {code: `complete_${taskId}`, text: 'Готово'},
        {code: `postpone_${taskId}_1h`, text: 'Отложить на 1 час'},
        {code: `postpone_${taskId}_3h`, text: 'На 3 часа'},
        {code: `postpone_${taskId}_1d`, text: 'До завтра'},
        {code: `postpone_${taskId}_1w`, text: 'До след. недели'},
    ], 2);
}

async function complete(ctx, periodic) {
    let [, taskId] = ctx.match;
    let task = await periodic.setTaskComplete(taskId);
    ctx.reply(`${task.text}\n\nТак держать! 👍`);
}

async function postpone(ctx, periodic) {
    let [, taskId, postponeType] = ctx.match;
    let task = await periodic.getTask(taskId);
    let newTime = moment.unix(task.nextRemind).tz(task.zone);
    let taskTime = newTime.clone();

    try {
        switch (postponeType) {
            case '1h':
            case '3h':
                let h = parseInt(postponeType.replace('h', ''));
                newTime = newTime.add(h, 'h');
                task = await periodic.setTaskTime(taskId, newTime);
                break;
            case '1d':
                newTime = newTime.add(1, 'd').startOf('d').hour(START_HOUR);
                task = await periodic.setTaskTime(taskId, newTime);
                break;
            case '1w':
                newTime = newTime.add(1, 'w').startOf('w').hour(START_HOUR);
                break;
        }

        let updatedTask = await periodic.setTaskTime(taskId, newTime);
        taskTime = moment.unix(updatedTask.nextRemind).tz(task.zone).format('DD.MM.YYYY HH:mm');

    }
    catch (e) {}

    return ctx.reply(`${task.text}\n\nХорошо. Напомню ${taskTime}`);
}

module.exports = {postpone, complete, postponeMenu}