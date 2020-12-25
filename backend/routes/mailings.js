const {getDb} = require('../../bot/modules/Database');
const shortid = require('shortid');
const moment = require('moment');

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
}