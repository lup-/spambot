const {getDb} = require('../../bot/modules/Database');
const {getPg} = require('../modules/pgdb');
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
                { $group: {"_id": "$ref", "count": {"$sum": 1}} },
                { $sort: { count: -1 } }
            ]).toArray();

            let usersStat = {count: usersCount};
            let refsStat = refsResult.map(refDb => {
                return {code: refDb._id, count: refDb.count};
            });

            botstats.push({botId: bot.id, users: usersStat, refs: refsStat});
        }

        let botQueries = [
            {
                botId: 'book_bot',
                userCount: 'SELECT COUNT(*) AS count FROM bot_user',
                refs: false,
            },
            {
                botId: 'music_bot',
                userCount: 'SELECT COUNT(*) AS count FROM userdata',
                refs: 'SELECT ref AS code, COUNT(*) AS count FROM userdata WHERE ref IS NOT NULL GROUP BY ref ORDER BY count DESC',
            },
            {
                botId: 'promo_bot',
                userCount: 'SELECT COUNT(*) AS count FROM bot_users',
                refs: false,
            },
            {
                botId: 'remotework_bot',
                userCount: 'SELECT COUNT(*) AS count FROM users',
                refs: false,
            },
        ];

        for (const bot of config.externalBotsList()) {
            let queries = botQueries.find(item => item.botId === bot.id);

            const db = await getPg(bot.dbName);
            const countRes = await db.query(queries.userCount);
            const refRes = queries.refs ? await db.query(queries.refs) : false;

            let usersStat = countRes && countRes.rows ? countRes.rows[0] : false;
            let refsStat = refRes.rows;

            botstats.push({botId: bot.id, users: usersStat, refs: refsStat, external: true});
        }

        ctx.body = {stats: botstats};
    },
}