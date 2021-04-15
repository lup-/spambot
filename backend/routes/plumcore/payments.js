const {getDb} = require('../../../bot/modules/Database');

const DB_NAME = 'plumcore_bot';
const COLLECTION_NAME = 'payments';
const ITEMS_NAME = 'payments';

module.exports = {
    async list(ctx) {
        let filter = ctx.request.body && ctx.request.body.filter
            ? ctx.request.body.filter || {}
            : {};

        let defaultFilter = {
            'deleted': {$in: [null, false]},
            'status': {$ne: 'canceled'},
        };

        filter = Object.assign(defaultFilter, filter);

        let db = await getDb(DB_NAME);
        let items = await db.collection(COLLECTION_NAME).aggregate([
            { $match: filter },
            { $lookup: {
                from: 'users',
                localField: 'profile.userId',
                foreignField: 'id',
                as: 'user'
            }},
            { $unwind: '$user' },
            { $set: {'user': '$user.user'} }
        ]).toArray();
        let response = {};
        response[ITEMS_NAME] = items;

        ctx.body = response;
    }
}