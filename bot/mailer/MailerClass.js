const moment = require('moment');
const axios = require('axios');
const FileType = require('file-type');
const shortid = require('shortid');
const fs = require('fs');
const path = require('path');

const cp = require('child_process');
const {getDb} = require('../modules/Database');
const {wait} = require('../modules/Helpers');
const config = require('../../backend/config');
const {
    MAILING_DB_NAME, MAILING_STATUS_NEW, MAILING_STATUS_PROCESSING, MAILING_STATUS_FINISHED, MAILING_STATUS_PAUSED,
    TEST_QUEUE_SIZE, TEST_BOT_ID, TEST_USER_ID, TEST_CHAT_ID,
    STATUS_NEW, STATUSES_SUCCESS
} = require('./SenderClass');

const MAILINGS_CHECK_INTERVAL_SEC = 60;
const BASE_DOWNLOAD_URL = process.env.BASE_DOWNLOAD_URL;
const UPLOAD_DIR = process.env.UPLOAD_DIR;

const eventLoopQueue = () => {
    return new Promise(resolve =>
        setImmediate(resolve)
    );
}

function getHTMLFromMessage(message) {
    let text = message.text || message.caption;
    let entities = message.entities || message.caption_entities || [];

    let offsetShift = 0;
    let html = text;
    for (const entity of entities) {
        let offset = entity.offset + offsetShift;
        let oldText = html.substring(offset, offset + entity.length);

        let newText;
        switch (entity.type) {
            case 'text_link':
                newText = `<a href="${entity.url}">${oldText}</a>`;
            break;
            case 'bold':
                newText = `<strong>${oldText}</strong>`;
            break;
            case 'italic':
                newText = `<em>${oldText}</em>`;
            break;
            case 'strikethrough':
                newText = `<del>${oldText}</del>`;
            break;
            default:
                newText = oldText;
            break;
        }

        html = html.substr(0, offset) + newText + html.substr(offset + entity.length);
        let newShift = newText.length - oldText.length;
        offsetShift += newShift;
    }

    html = html.replace(/\n/gs, '<br>');

    return `<div>${html}</div>`
}

module.exports = class Mailer {
    constructor() {
        this.runLoop = false;
        this.activeSenders = [];
    }

    async createMailing(ctx) {
        let db = await getDb(MAILING_DB_NAME);
        let message = ctx.update && ctx.update.message
            ? ctx.update.message
            : false;

        if (!message) {
            return false;
        }

        let mailing = {
            id: shortid.generate(),
            status: 'new',
            created: moment().unix(),
            updated: moment().unix(),
            text: getHTMLFromMessage(message),
        }

        let photo = false;
        let video = false;

        if (message.photo) {
            let photoFile = message.photo.reduce((maxSize, current) => {
                if (!maxSize) {
                    return current;
                }

                return current.file_size > maxSize.file_size
                    ? current
                    : maxSize;
            }, false);

            if (photoFile) {
                let fileLink = await ctx.tg.getFileLink(photoFile.file_id);
                let response = await axios.get(fileLink, {responseType: 'arraybuffer'});
                let buffer = response.data;
                let base64Src = buffer.toString('base64');
                let fileType = await FileType.fromBuffer(buffer);
                let dataUrl = `data:${fileType.mime};base64,${base64Src}`;

                photo = {
                    buffer,
                    file: false,
                    tlgFile: photoFile,
                    src: dataUrl,
                    type: fileType.mime,
                    name: `${photoFile.file_id}.${fileType.ext}`,
                }
            }
        }

        if (message.video) {
            let videoLink = await ctx.tg.getFileLink(message.video.file_id);
            let {data: videoStream} = await axios.get(videoLink, {responseType: 'stream'});

            let newFileName = message.video.file_name;
            let targetPath = path.join(UPLOAD_DIR, newFileName);

            videoStream.pipe(fs.createWriteStream(targetPath));
            let link = BASE_DOWNLOAD_URL + newFileName;
            let serverFile = {
                fieldname: "message",
                originalname: newFileName,
                encoding: "7bit",
                mimetype: message.video.mime_type,
                destination: UPLOAD_DIR,
                filename: newFileName,
                path: targetPath,
                size: message.video.file_size,
            }

            video = {
                file: {},
                serverFile,
                src: link,
                type: message.video.mime_type,
                name: newFileName,
            }
        }

        if (photo) {
            if (!mailing.photos) {
                mailing.photos = [];
            }

            mailing.photos.push(photo);
        }

        if (video) {
            if (!mailing.videos) {
                mailing.videos = [];
            }

            mailing.videos.push(video);
        }

        let hasButtons = message.reply_markup && message.reply_markup.inline_keyboard && message.reply_markup.inline_keyboard.length > 0;
        if (hasButtons) {
            let firstRow = message.reply_markup.inline_keyboard[0];
            let buttons = firstRow.map(tgButton => {
                return {
                    text: tgButton.text,
                    link: tgButton.url || ''
                }
            });

            mailing.buttons = buttons;
        }

        let result = await db.collection('mailings').insertOne(mailing);
        return result && result.ops && result.ops[0] ? result.ops[0] : false;
    }

    async makeTestQueue(mailing) {
        if (!mailing.id) {
            return false;
        }

        let testQueue = [];
        let bots = await this.getMailingBots(mailing);
        let botCount = Math.floor(TEST_QUEUE_SIZE / bots.length);

        for (const bot of bots) {
            let botQueue = Array(botCount).fill(false).map(_ => ({
                mailing: mailing.id,
                bot: bot.id,
                userId: TEST_USER_ID,
                chatId: TEST_CHAT_ID,
                status: STATUS_NEW
            }));

            testQueue = testQueue.concat(botQueue);
        }

        return testQueue;
    }

    async getBots() {
        if (this.bots) {
            return this.bots;
        }

        this.bots = await config.botList();
        return this.bots;
    }

    async getMailingBots(mailing) {
        let bots = await this.getBots();
        let hasTarget = mailing.target && mailing.target.length > 0;

        if (hasTarget) {
            let targetBotIds = mailing.target.reduce((bots, target) => {
                if (target.type === 'bots') {
                    if (!bots) {
                        bots = [];
                    }

                    bots = bots.concat(target.value).filter((botId, index, allBots) => allBots.indexOf(botId) === index);
                }

                return bots;
            }, false);

            if (targetBotIds) {
                bots = bots.filter(bot => targetBotIds.indexOf(bot.id) !== -1);
            }

        }

        return bots;
    }

    async makeQueue(mailing) {
        if (mailing.isTest) {
            return this.makeTestQueue(mailing);
        }

        let bots = await this.getMailingBots(mailing);
        let cmpToMongo = {'>': '$gt', '<': '$lt', '=': '$eq', '!=': '$ne'};
        let hasTarget = mailing.target && mailing.target.length > 0;

        let queue = [];
        for (const bot of bots) {
            let db = await getDb(bot.dbName);
            let matchConditions = [];
            let queueIsEmpty = false;

            if (hasTarget) {
                for (const target of mailing.target) {
                    let mongoCmp = {};
                    if (target.type !== 'bots' && target.cmp) {
                        mongoCmp[ cmpToMongo[target.cmp] ] = moment(target.value).unix();
                    }

                    if (target.type === 'activity') {
                        let activityCount = await db.collection('activity').countDocuments();
                        let hasActivity = activityCount > 0;

                        if (hasActivity) {
                            let activeUsers = await db.collection('activity').aggregate([
                                {$match: {date: mongoCmp}},
                                {$group: {"_id": "$userId"}}
                            ]).toArray();

                            let hasActiveUsersInPeriod = activeUsers && activeUsers.length > 0;
                            if (!hasActiveUsersInPeriod) {
                                queueIsEmpty = true;
                                break;
                            }

                            let activeUsersIds = activeUsers.map(user => user._id);
                            matchConditions.push({id: {$in: activeUsersIds}});
                        }
                    }

                    if (target.type === 'register') {
                        matchConditions.push({registered: mongoCmp});
                    }

                    if (target.type === 'mailing') {
                        let mailingDb = await getDb(MAILING_DB_NAME);
                        let mailingUsers = await mailingDb.collection('mailingQueue').aggregate([
                            {$match: {sentAt: mongoCmp, status: {$in: STATUSES_SUCCESS, bot: bot.id}}},
                            {$group: {"_id": "$userId"}}
                        ]).toArray();

                        let hasMailingUsersInPeriod = mailingUsers && mailingUsers.length > 0;
                        if (!hasMailingUsersInPeriod) {
                            queueIsEmpty = true;
                            break;
                        }

                        let mailingUsersIds = mailingUsers.map(user => user._id);
                        matchConditions.push({id: {$in: mailingUsersIds}});
                    }
                }
            }

            if (!queueIsEmpty) {
                let pipe = matchConditions.map(cond => ({'$match': cond}));
                let foundUsers = await db.collection('users').aggregate(pipe).toArray();
                queue = queue.concat(foundUsers.map(user => ({
                    mailing: mailing.id,
                    bot: bot.id,
                    userId: user.user.id,
                    chatId: user.chat.id,
                    status: STATUS_NEW
                })));
            }
        }

        return queue;
    }

    async initQueue(mailing) {
        if (!mailing.id) {
            return false;
        }

        let mailingDb = await getDb(MAILING_DB_NAME);
        let queueCount = await mailingDb.collection('mailingQueue').countDocuments({mailing: mailing.id});
        if (queueCount > 0) {
            return;
        }

        let queue = await this.makeQueue(mailing);

        if (queue.length > 0) {
            let result = await mailingDb.collection('mailingQueue').insertMany(queue);
            return result && result.result && result.result.ok;
        }

        return false;
    }

    async initProgress(mailing) {
        let mailingDb = await getDb(MAILING_DB_NAME);
        await mailingDb.collection('mailings').updateOne({id: mailing.id}, {$set: {
            dateStarted: moment().unix(),
            status: MAILING_STATUS_PROCESSING,
        }});

        if (!mailing.total) {
            let queueCount = await mailingDb.collection('mailingQueue').countDocuments({mailing: mailing.id});

            await mailingDb.collection('mailings').updateOne({id: mailing.id}, {$set: {
                total: queueCount
            }});
        }
    }

    async pauseMailing(mailingId) {
        let mailingDb = await getDb(MAILING_DB_NAME);
        return mailingDb.collection('mailings').updateOne({id: mailingId}, {$set: {
            datePaused: moment().unix(),
            status: MAILING_STATUS_PAUSED,
        }});
    }

    async finishMailing(mailingId) {
        let mailingDb = await getDb(MAILING_DB_NAME);
        return mailingDb.collection('mailings').updateOne({id: mailingId}, {$set: {
            dateFinished: moment().unix(),
            status: MAILING_STATUS_FINISHED,
        }});
    }

    async getPendingMailings() {
        let db = await getDb(MAILING_DB_NAME);
        let now = moment().unix();
        return await db.collection('mailings').find({
            startAt: {'$lte': now},
            deleted: { $in: [null,  false] },
            archived: { $in: [null,  false] },
            status: {'$in': [MAILING_STATUS_NEW, MAILING_STATUS_PROCESSING]},
        }).toArray();
    }

    async getNewMailings() {
        let allMailings = await this.getPendingMailings();
        let mailingIdsInWork = this.activeSenders
            .map(item => item.mailing.id)
            .filter( (id, index, ids) => ids.indexOf(id) === index );
        return allMailings.filter(mailing => mailingIdsInWork.indexOf(mailing.id) === -1);
    }

    getActiveSender(mailingId, botId) {
        return this.activeSenders.find(item => item.mailing.id === mailingId && item.botId === botId) || false;
    }

    getAllActiveSenders(mailingId) {
        return this.activeSenders.filter(item => item.mailing.id === mailingId) || [];
    }

    async startSending(mailing) {
        await this.initQueue(mailing);
        await this.initProgress(mailing);

        return new Promise(async resolve => {
            let bots = await this.getMailingBots(mailing);

            for (const botIndex in bots) {
                let bot = bots[botIndex];

                let activeSender = this.getActiveSender(mailing.id, bot.id);
                if (activeSender) {
                    continue;
                }

                let debugPort = 9200+parseInt(botIndex);
                let debugChildren = process.env.DEBUG_CHILDREN && parseInt(process.env.DEBUG_CHILDREN) !== 0;
                let execArgv = debugChildren
                    ? [`--inspect-brk=0.0.0.0:${debugPort}`]
                    : [];

                const subprocess = cp.fork(`${__dirname}/sender.js`, [mailing.id, bot.id], {execArgv});
                subprocess.on('message', message => {
                    if (message && message.action && message.action === 'started') {
                        resolve();
                    }
                });
                subprocess.on('spawn', () => resolve());
                subprocess.on('exit', () => this.onSenderFinish(mailing.id, bot.id));
                subprocess.on('data', data => console.log(`data: ${data}`));
                subprocess.on('error', error => console.log(error));
                this.activeSenders.push({mailing, subprocess, botId: bot.id});
            }
        });
    }

    stop() {
        this.runLoop = false;
    }

    async stopMailing(mailingId) {
        let senders = this.getAllActiveSenders(mailingId);

        let stopSenderPromises = senders.map(sender => new Promise(resolve => {
            if (sender) {
                sender.subprocess.removeAllListeners('exit');
                sender.subprocess.on('exit', exitCode => {
                    this.clearProcess(mailingId, sender.botId);
                    resolve(exitCode);
                });

                sender.subprocess.send({action: 'stop'});
            }
            else {
                resolve(false);
            }
        }));

        let exitCodes = await Promise.all(stopSenderPromises);
        await this.pauseMailing(mailingId);
        return exitCodes;
    }

    clearProcess(mailingId, botId) {
        let index = this.activeSenders.findIndex(item => item.mailing.id === mailingId && item.botId === botId);
        if (index !== -1) {
            this.activeSenders.splice(index, 1);
        }
    }

    allProcessesFinished(mailingId) {
        let senders = this.getAllActiveSenders(mailingId);
        return senders.length === 0;
    }

    onSenderFinish(mailingId, botId) {
        this.clearProcess(mailingId, botId);
        if (this.allProcessesFinished(mailingId)) {
            return this.finishMailing(mailingId);
        }
    }

    async launch() {
        this.runLoop = true;

        while (this.runLoop) {
            let mailings = await this.getNewMailings();

            if (mailings && mailings.length > 0) {
                for (const mailing of mailings) {
                    await this.startSending(mailing);
                }
            }

            await wait(MAILINGS_CHECK_INTERVAL_SEC * 1000);
            await eventLoopQueue();
        }
    }
}
