const {getDb} = require('../../bot/modules/Database');
const {getPg} = require('../modules/pgdb');
const moment = require('moment');
const config = require('../config');

module.exports = {
    async botList(ctx) {
        ctx.body = {bots: await config.botList()}
    },
    async general(ctx) {
        let botstats = [];
        let filter = ctx.request.body && ctx.request.body.filter
            ? ctx.request.body.filter || {}
            : {};

        let bots = await config.botList();
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
            await db.end();

            let usersStat = countRes && countRes.rows ? countRes.rows[0] : false;
            let refsStat = refRes.rows;

            botstats.push({botId: bot.id, users: usersStat, refs: refsStat, external: true});
        }

        ctx.body = {stats: botstats};
    },
    async details(ctx) {
        let botIds = ctx.request.body && ctx.request.body.botIds
            ? ctx.request.body.botIds || []
            : [];

        let tz = ctx.request.body && ctx.request.body.tz
            ? ctx.request.body.tz || false
            : false;

        let defaultRange = {start: moment().startOf('d').unix(), end: moment().endOf('d').unix()};
        let range = ctx.request.body && ctx.request.body.range
            ? ctx.request.body.range || defaultRange
            : defaultRange;

        let defaultScale = 'H';
        let scale = ctx.request.body && ctx.request.body.scale
            ? ctx.request.body.scale || defaultScale
            : defaultScale;

        let formats = [
            {scale: 'Y', slot: '%Y"', tag: '%Y', momentTag: 'YYYY', step: 'y'},
            {scale: 'M', slot: '%Y%m', tag: '%m.%Y', momentTag: 'MM.YYYY', step: 'month'},
            {scale: 'D', slot: '%Y%m%d', tag: '%d.%m.%Y', momentTag: 'DD.MM.YYYY', step: 'd'},
            {scale: 'H', slot: '%Y%m%d%H', tag: '%H:00, %d.%m.%Y', momentTag: 'HH:00, DD.MM.YYYY', step: 'h'},
        ];

        let format = formats.find(item => item.scale === scale) || formats[3];

        let start = moment.unix(range.start);
        let tagsCount = moment.unix(range.end).diff(moment.unix(range.start), format.step);
        let steps = Array(tagsCount).fill(0).map((_, index) => start.clone().add(index, format.step));
        let tags = steps.map(step => step.format(format.momentTag));
        let unixSteps = steps.map(step => step.unix());

        let projectQuery = unixSteps.reduce( (fields, time, index) => {
            let key = `date_group_${index}`;
            fields[key] = {"$cond": [ { "$lte": [ "$targetDate", time ] }, 1, 0 ]};
            return fields;
        }, {} );

        let groupQuery = unixSteps.reduce( (fields, time, index) => {
            let fieldKey = `date_group_${index}`;
            let key = `count_${index}`;
            fields[key] = {"$sum": `$${fieldKey}`};
            return fields;
        }, {'_id': '1'} );
        
        let allBots = await config.botList();
        let bots = botIds && botIds.length > 0
            ? allBots.filter(bot => botIds.indexOf(bot.id) !== -1)
            : allBots;

        let botstats = [];
        for (const bot of bots) {
            let db = await getDb(bot.dbName);
            let users = db.collection('users');
            let refs = db.collection('refs');
            let activity = db.collection('activity');

            let totalUsersResult = await users.aggregate([
                {$set: {targetDate: "$registered"}},
                {$project: projectQuery},
                {$group: groupQuery}
            ]).toArray();

            let usersResult = await users.aggregate([
                {$match: {$or: [
                    {blocked: {$in: [null, false]}},
                    {$and: [ {blocked: true}, {blockedSince: {$gt: range.end}} ]}
                ]}},
                {$match: {$and: [{registered: {$gte: range.start}}, {registered: {$lt: range.end}}]}},
                {$set: {registered_date: {$toDate: {$multiply: ["$registered", 1000]}}}},
                {$set: {
                        timeslot: { $dateToString: {date: "$registered_date", format: format.slot} },
                        tag: {$dateToString: {date: {$min: "$registered_date"}, format: format.tag} }
                    }
                },
                {$group: {"_id": "$timeslot", "count": {$sum: 1}, "tag": {$first: "$tag"}}},
                {$sort: {"tag": 1}}
            ]).toArray();

            let refsResult = await refs.aggregate([
                {$match: {$and: [{date: {$gte: range.start}}, {date: {$lt: range.end}}]}},
                {$set: {registered_date: {$toDate: {$multiply: ["$date", 1000]}}}},
                {$set: {
                        timeslot: { $dateToString: {date: "$registered_date", format: format.slot} },
                        tag: {$dateToString: {date: {$min: "$registered_date"}, format: format.tag} }
                    }
                },
                {$group: {"_id": {$concat: ["$timeslot", ":", "$ref"]}, "count": {$sum: 1}, "tag": {$first: "$tag"}, "ref": {$first: "$ref"}}},
                {$sort: {"tag": 1}}
            ]).toArray();

            let activeUsersResult = await activity.aggregate([
                {$match: {$and: [{date: {$gte: range.start}}, {date: {$lt: range.end}}]}},
                {$set: {date_date: {$toDate: {$multiply: ["$date", 1000]}}}},
                {$set: {
                        timeslot: { $dateToString: {date: "$date_date", format: format.slot} },
                        tag: {$dateToString: {date: {$min: "$date_date"}, format: format.tag} }
                    }
                },
                {$group: {"_id": "$timeslot", "count": {$sum: 1}, "tag": {$first: "$tag"}}},
                {$sort: {"tag": 1}}
            ]).toArray();

            let refNames = refsResult.map(item => item.ref).filter((ref, index, all) => all.indexOf(ref) === index);

            let stats = tags.map((tag, index) => {
                let userCount = usersResult.find(item => item.tag === tag);
                let activeUserCount = activeUsersResult.find(item => item.tag === tag);

                let count = userCount && userCount['count'] ? userCount['count'] : 0;
                let total = totalUsersResult[0][`count_${index}`] || 0;
                let active = activeUserCount && activeUserCount['count'] ? activeUserCount['count'] : 0;

                return {tag, count, active, total};
            });

            let refStats = refNames.map(refName => {
                let stats = tags.map(tag => {
                    let item = refsResult.find(item => item.tag === tag && item.ref === refName);
                    let count = item && item['count'] ? item['count'] : 0;
                    return {tag, count};
                });

                return {ref: refName, stats};
            });

            let noRefsCount = stats.map(tagTotalStats => {
                let totalTagRefCount = refStats.reduce((sum, refStat) => {
                    let tagRefItem = refStat.stats.find(item => item.tag === tagTotalStats.tag);
                    if (tagRefItem) {
                        sum += tagRefItem.count;
                    }

                    return sum;
                }, 0);

                return {tag: tagTotalStats.tag, count: tagTotalStats.count - totalTagRefCount};
            });

            refStats.push({ref: false, stats: noRefsCount});
            botstats.push({botId: bot.id, stats, refStats});
        }

        ctx.body = {stats: botstats};
    },
    async refUsers(ctx) {
        let db = await getDb('refs_bot');
        let profiles = await db.collection('profiles').find({}).toArray();
        ctx.body = {users: profiles}
    },
    async updateRefUser(ctx) {
        let db = await getDb('refs_bot');
        let updatedProfile = ctx.request.body && ctx.request.body.profile
            ? ctx.request.body.profile
            : false;

        let userId = updatedProfile && updatedProfile.userId
            ? updatedProfile.userId
            : false;

        if (!userId) {
            ctx.body = {user: false};
            return;
        }

        if (updatedProfile._id) {
            delete updatedProfile._id;
        }

        let result = await db.collection('profiles').findOneAndReplace({userId}, updatedProfile);

        ctx.body = {user: result && result.ok ? result.value : false};
    },
    async refList(ctx) {
        let botIds = ctx.request.body && ctx.request.body.botIds
            ? ctx.request.body.botIds || []
            : [];

        let allBots = await config.botList();
        let bots = botIds && botIds.length > 0
            ? allBots.filter(bot => botIds.indexOf(bot.id) !== -1)
            : allBots;

        let refs = [];
        for (const bot of bots) {
            let db = await getDb(bot.dbName);
            let visits = db.collection('refs');
            let foundRefs = await visits.aggregate([{$group: {"_id": "$ref"}}]).toArray();
            refs.push({
                botId: bot.id,
                bot,
                refs: foundRefs.map(ref => ref._id),
            });
        }

        ctx.body = {refs};
    }
}