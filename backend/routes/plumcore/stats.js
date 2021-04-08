const {getDb} = require('../../../bot/modules/Database');
const moment = require('moment');

const DB_NAME = 'plumcore_bot';

module.exports = {
    async dashboard(ctx) {

    },

    async sales(ctx) {
        let days = ctx.request.body && ctx.request.body.days
            ? parseInt(ctx.request.body.days)
            : 7;

        let start = moment().subtract(days, 'day').startOf('d').unix();
        let end = moment().endOf('d').unix();
        let dateFilter = {$and: [
            {created: {$gte: start}},
            {created: {$lte: end}}
        ]};

        let db = await getDb(DB_NAME);
        let sales = await db.collection('payments').aggregate([
            { $match: dateFilter },
            { $addFields: {
                    createdDate: { $dateToString: {
                            format: "%d.%m.%Y",
                            date: {$toDate: {$multiply: ["$created", 1000]}},
                        }
                    }
            }},
            { $group: {
                    _id: "$createdDate",
                    date: {$first: "$createdDate"},
                    totalSum: {$sum: "$price"},
                    ordersCount: {$sum: 1},
                    courses: {$addToSet: "$item.id"}
            }},
            { $addFields: {courseCount: {$size: '$courses'}} }
        ]).toArray();

        let categories = await db.collection('payments').aggregate([
            { $match: dateFilter },
            { $unwind: "$item.categories" },
            { $group: {
                    _id: "$item.categories",
                    count: {$sum: 1}
                }},
            { $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: 'id',
                    as: 'category'
                }},
            { $unwind: "$category" },
            { $project: {id: "$_id", name: "$category.title", value: "$count"} },
            { $sort: {value: -1} }
        ]).toArray();

        let courses = await db.collection('payments').aggregate([
            { $match: dateFilter },
            { $group: {
                    _id: "$item.id",
                    count: {$sum: 1}
                }},
            { $lookup: {
                    from: 'courses',
                    localField: '_id',
                    foreignField: 'id',
                    as: 'course'
                }},
            { $unwind: "$course" },
            { $project: {id: "$_id", name: "$course.title", value: "$count"} },
            { $sort: {value: -1} }
        ]).toArray();

        ctx.body = {sales, categories, courses};
    }
}