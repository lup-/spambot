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
        let allAds = db.collection('ads');

        let ads = await allAds.find(filter).toArray();
        ctx.body = {ads};
    },
    async add(ctx) {
        const db = await getDb();
        const adsCollection = db.collection('ads');

        let adFields = ctx.request.body.ad;
        if (adFields._id) {
            ctx.body = {ad: false};
            return;
        }

        adFields = Object.assign(adFields, {
            id: shortid.generate(),
            created: moment().unix(),
            updated: moment().unix(),
        });

        let result = await adsCollection.insertOne(adFields);
        let ad = result.ops[0];
        ctx.body = {ad};
    },
    async update(ctx) {
        const db = await getDb();
        const adsCollection = db.collection('ads');

        let adFields = ctx.request.body.ad;
        let id = adFields.id;

        if (adFields._id) {
            delete adFields._id;
        }

        adFields = Object.assign(adFields, {
            updated: moment().unix(),
        });

        let updateResult = await adsCollection.findOneAndReplace({id}, adFields, {returnOriginal: false});
        let ad = updateResult.value || false;

        ctx.body = {ad};
    },
    async delete(ctx) {
        const db = await getDb();
        const adsCollection = db.collection('ads');

        let adFields = ctx.request.body.ad;
        let id = adFields.id;

        if (adFields._id) {
            delete adFields._id;
        }

        adFields = Object.assign(adFields, {
            deleted: moment().unix(),
        });

        let updateResult = await adsCollection.findOneAndReplace({id}, adFields, {returnOriginal: false});
        let ad = updateResult.value || false;

        ctx.body = {ad};
    },
}