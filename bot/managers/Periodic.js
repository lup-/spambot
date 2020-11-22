const {getDb} = require('../modules/Database');
const shortid = require('shortid');
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');
const moment = require('moment');

const eventLoopQueue = () => {
    return new Promise(resolve =>
        setImmediate(resolve)
    );
}

module.exports = function () {
    let runTask = false;
    let runLoop = false;

    return {
        setTaskRunner(newRunTask) {
            runTask = newRunTask;
        },

        async addTask(text, userId, chatId, zone) {
            const db = await getDb();
            const tasks = db.collection('tasks');
            const taskId = shortid.generate();

            let result = await tasks.insertOne({taskId, text, userId, chatId, zone});
            return result && result.ops
                ? result.ops[0] || false
                :  false;
        },

        async getTask(taskId) {
            const db = await getDb();
            const tasks = db.collection('tasks');
            return tasks.findOne({taskId});
        },

        async setTaskTime(taskId, nextRemind) {
            if (moment.isMoment(nextRemind)) {
                nextRemind = nextRemind.unix();
            }

            const db = await getDb();
            const tasks = db.collection('tasks');

            await tasks.updateOne({taskId}, {$set: {nextRemind, lastRemind: null}}, {returnOriginal: false});
            return this.getTask(taskId);
        },

        async getAllTasks(userId) {
            const db = await getDb();
            const tasks = db.collection('tasks');
            let filter = {userId, complete: {$in: [null, false]}};

            return tasks.find(filter).toArray();
        },

        async getTasksWithoutTime(userId) {
            const db = await getDb();
            const tasks = db.collection('tasks');
            let now = moment().unix();

            let filter = {
                userId,
                complete: {$in: [null, false]},
                $or: [
                    {nextTime: {$in: [null, false]}},
                    {nextTime: {$lt: now}}
                ]
            };

            return tasks.find(filter).toArray();
        },

        async setTaskComplete(taskId) {
            const db = await getDb();
            const tasks = db.collection('tasks');
            await tasks.updateOne({taskId}, {$set: {complete: true}}, {returnOriginal: false});
            return this.getTask(taskId);
        },

        async setTaskRemindSuccess(taskId) {
            const db = await getDb();
            const tasks = db.collection('tasks');
            let now = moment().unix();

            await tasks.updateOne({taskId}, {$set: {lastRemind: now}}, {returnOriginal: false});
            return this.getTask(taskId);
        },

        async getReminds() {
            const db = await getDb();
            const tasks = db.collection('tasks');
            let now = moment().unix();

            let filter = {
                $and: [
                    {nextRemind: {$lt: now}},
                    {$or: [
                        {lastRemind: {$in: [null, false]}},
                        {$where: "this.nextRemind > this.lastRemind"},
                    ]}
                ],
                complete: {$in: [null, false]},
            }

            return tasks.find(filter).toArray();
        },

        async stop() {
            runLoop = false;
        },

        async launch() {
            runLoop = true;

            while (runLoop) {
                let reminds = await this.getReminds();

                if (reminds) {
                    for (const remind of reminds) {
                        await runTask(remind);
                    }
                }

                await eventLoopQueue();
            }
        }

    }
}