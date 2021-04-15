const {getDb} = require('../../../bot/modules/Database');

const DB_NAME = 'plumcore_bot';
const COLLECTION_NAME = 'profiles';
const ITEMS_NAME = 'subscribers';

module.exports = {
    async list(ctx) {
        let filter = ctx.request.body && ctx.request.body.filter
            ? ctx.request.body.filter || {}
            : {};

        let defaultFilter = {
            'deleted': {$in: [null, false]}
        };

        filter = Object.assign(defaultFilter, filter);

        let db = await getDb(DB_NAME);
        let items = await db.collection('users').aggregate([
            { $match: filter },
            { $lookup: {
                    from: 'profiles',
                    localField: 'user.id',
                    foreignField: 'userId',
                    as: 'profile'
                } },
            { $set: {profile: {$cond: {
                if: {$gt: [{$size: '$profile'}, 0]},
                then: '$profile',
                else: {userId: '$user.id', chatId: '$chat.id'}}}}
            },
            { $unwind: '$profile' },
            { $addFields: {
                firstName: '$user.first_name',
                lastName: '$user.last_name',
                userName: '$user.username',
                lastPayment: '$profile.lastPayment',
                ownedCount: {$cond: [{$ne: [{$type : "$profile.owned"}, 'missing']}, {$size: '$profile.owned'}, 0]},
                subscribed: '$profile.subscribed',
                subscribedTill: '$profile.subscribedTill',
                blocked: '$blocked'
            } }
        ]).toArray();
        let response = {};
        response[ITEMS_NAME] = items;

        ctx.body = response;
    },
    async update(ctx) {
        let db = await getDb(DB_NAME);
        let subscriberData = ctx.request.body.subscriber;
        let userId = subscriberData.id;
        delete subscriberData.id;

        if (!userId) {
            ctx.body = { subscriber: false };
            return;
        }

        if (subscriberData._id) {
            delete subscriberData._id;
        }

        await db.collection(COLLECTION_NAME).findOneAndUpdate({userId}, {$set: subscriberData, $setOnInsert: {id: userId}}, {returnOriginal: false, upsert: true});
        let subscriber = await db.collection(COLLECTION_NAME).findOne({userId});

        ctx.body = { subscriber };
    },
}