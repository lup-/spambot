const {getDb} = require('../modules/Database');
const config = require('../../backend/config');
const moment = require('moment');

module.exports = function () {
    return {
        async getBotById(botId) {
            let list = await config.botList();
            return list.find(bot => {
                return bot && bot.id === botId;
            });
        },
        async getBotByUsername(botUserName) {
            let list = await config.botList();
            return list.find(bot => {
                return bot && bot.tg && bot.tg.username === botUserName;
            });
        },
        getPeriodProps(periodType) {
            let range = {start: moment().startOf('d').unix(), end: moment().endOf('d').unix()};
            let scale = false;

            switch (periodType) {
                case '1d':
                    scale = 'H';
                case '7d':
                case '30d':
                    if (!scale) {
                        scale = 'D';
                    }

                    let periodSize = parseInt(periodType.replace('d', ''))-1;
                    range.start = moment.unix(range.end).clone().subtract(periodSize, 'd').startOf('d').unix();

                    break;
            }

            return {range, scale};
        },
        async getPeriodStat(bot, ref, periodType) {

            let {range, scale} = this.getPeriodProps(periodType);

            let formats = [
                {scale: 'Y', slot: '%Y"', tag: '%Y', momentTag: 'YYYY', step: 'y'},
                {scale: 'M', slot: '%Y%m', tag: '%m.%Y', momentTag: 'MM.YYYY', step: 'month'},
                {scale: 'D', slot: '%Y%m%d', tag: '%d.%m.%Y', momentTag: 'DD.MM.YYYY', step: 'd'},
                {scale: 'H', slot: '%Y%m%d%H', tag: '%H:00, %d.%m.%Y', momentTag: 'HH:00, DD.MM.YYYY', step: 'h'},
            ];

            let start = moment.unix(range.start);
            let format = formats.find(item => item.scale === scale) || formats[3];
            let tagsCount = moment.unix(range.end).diff(moment.unix(range.start), format.step);
            let steps = Array(tagsCount+1).fill(0).map((_, index) => start.clone().add(index, format.step));
            let tags = steps.map(step => step.format(format.momentTag));
            let unixSteps = steps.map(step => step.unix());

            let db = await getDb(bot.dbName);

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

            let refsResult = await db.collection('refs').aggregate([
                {$match: {ref}},
                {$set: {targetDate: "$date"}},
                {$project: projectQuery},
                {$group: groupQuery}
            ]).toArray();

            let prev = false;
            let stats = tags.map((tag, index) => {
                let count = refsResult[0][`count_${index}`] || 0;
                let delta = prev ? count - prev.count : 0;
                prev = {tag, count, delta};
                return prev;
            });

            return stats;
        }
    }
}