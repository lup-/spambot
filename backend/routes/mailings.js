const shortid = require('shortid');
const moment = require('moment');

const {getDb} = require('../../bot/modules/Database');
const config = require('../config');
const {Sender, MAILER_BOT_ID, TEST_BOT_ID, STATUS_NEW, MAILING_STATUS_PAUSED, MAILING_STATUS_NEW} = require('../../bot/mailer/SenderClass');
const {publishCommandWithReply} = require('../modules/commands');

const QUEUE_SAMPLE_SIZE = 5;

module.exports = {
    async list(ctx) {
        let filter = ctx.request.body && ctx.request.body.filter
            ? ctx.request.body.filter || {}
            : {};

        let defaultFilter = {
            'deleted': {$in: [null, false]}
        };

        filter = Object.assign(defaultFilter, filter);

        let db = await getDb();
        let allMailings = db.collection('mailings');

        let mailings = await allMailings.find(filter).toArray();
        ctx.body = {mailings};
    },
    async add(ctx) {
        const db = await getDb();
        const mailingsCollection = db.collection('mailings');

        let mailingFields = ctx.request.body.mailing;
        if (mailingFields._id) {
            ctx.body = {mailing: false};
            return;
        }

        mailingFields = Object.assign(mailingFields, {
            id: shortid.generate(),
            status: 'new',
            created: moment().unix(),
            updated: moment().unix(),
        });

        let result = await mailingsCollection.insertOne(mailingFields);
        let mailing = result.ops[0];
        ctx.body = {mailing};
    },
    async update(ctx) {
        const db = await getDb();
        const mailingsCollection = db.collection('mailings');

        let mailingFields = ctx.request.body.mailing;
        let id = mailingFields.id;

        if (mailingFields._id) {
            delete mailingFields._id;
        }

        if (mailingFields.cachedImage) {
            delete mailingFields.cachedImage;
        }

        mailingFields = Object.assign(mailingFields, {
            updated: moment().unix(),
        });

        let updateResult = await mailingsCollection.findOneAndReplace({id}, mailingFields, {returnOriginal: false});
        let mailing = updateResult.value || false;

        ctx.body = {mailing};
    },
    async delete(ctx) {
        const db = await getDb();
        const mailingsCollection = db.collection('mailings');

        let mailingFields = ctx.request.body.mailing;
        let id = mailingFields.id;

        if (mailingFields._id) {
            delete mailingFields._id;
        }

        mailingFields = Object.assign(mailingFields, {
            deleted: moment().unix(),
        });

        let updateResult = await mailingsCollection.findOneAndReplace({id}, mailingFields, {returnOriginal: false});
        let mailing = updateResult.value || false;

        ctx.body = {mailing};
    },
    async start(ctx) {
        let mailingFields = ctx.request.body.mailing;
        let mailingId = mailingFields.id;

        const db = await getDb();
        let updateResult = await db.collection('mailings').updateOne({id: mailingId}, {$set: {status: MAILING_STATUS_NEW}}, {returnOriginal: false});
        ctx.body = {success: updateResult && updateResult.ok};
    },
    async pause(ctx) {
        let mailingFields = ctx.request.body.mailing;
        let mailingId = mailingFields.id;
        let replies = await publishCommandWithReply('stopMailing', [MAILER_BOT_ID], [mailingId])
        let exitCode = replies && replies[0] ? replies[0].data : null;
        let success = exitCode === false || exitCode === 0;

        const db = await getDb();
        let updateResult = await db.collection('mailings').updateOne({id: mailingId}, {$set: {status: MAILING_STATUS_PAUSED}}, {returnOriginal: false});

        ctx.body = {success, result: exitCode, updateSuccess: updateResult && updateResult.ok};
    },
    async testUsers(ctx) {
        let bots = await config.botList();
        let bot = bots.find(bot => bot.id === TEST_BOT_ID);
        if (!bot) {
            ctx.body = {users: []};
            return;
        }

        let db = await getDb(bot.dbName);
        let users = await db.collection('users').find({}).toArray();
        ctx.body = {users};
    },
    async predictUsers(ctx) {
        let mailingFields = ctx.request.body.mailing;
        let sender = new Sender();
        await sender.init(mailingFields);
        let queue = await sender.makeQueue();
        let sample = queue && queue.length > 0 ? queue.slice(0, QUEUE_SAMPLE_SIZE) : [];
        ctx.body = {count: queue.length, sample};
    },
    async preview(ctx) {
        let mailingFields = ctx.request.body.mailing;
        let chatId = ctx.request.body.chatId;

        let mailTo = {
            mailing: false,
            bot: TEST_BOT_ID,
            userId: chatId,
            chatId: chatId,
            status: STATUS_NEW
        }

        let sender = new Sender();
        await sender.init(mailingFields);
        try {
            let result = await sender.sendMailingToChat(mailTo);
            ctx.body = {success: true, error: false, result};
        }
        catch (e) {
            ctx.body = {success: false, error: e, result: false};
        }
    }
}