const {getDb} = require('../../bot/modules/Database');
const config = require('../config');

module.exports = {
    async botList(ctx) {
        ctx.body = {bots: config.botList()}
    },
    async list(ctx) {
        let botstats = [];
        let filter = ctx.request.body && ctx.request.body.filter
            ? ctx.request.body.filter || {}
            : {};

        let bots = config.botList();
        for (const bot of bots) {
            let db = await getDb(bot.dbName);
            let users = db.collection('users');
            let refs = db.collection('refs');

            let usersCount = await users.count({});
            let refsResult = await refs.aggregate([
                {$group: {"_id": "$ref", "count": {"$sum": 1}}}
            ]).toArray();

            let usersStat = {count: usersCount};
            let refsStat = refsResult.map(refDb => {
                return {code: refDb._id, count: refDb.count};
            });

            botstats.push({botId: bot.id, users: usersStat, refs: refsStat});
        }

        ctx.body = {stats: botstats};
    },
}