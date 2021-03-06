const {getDb} = require('../../../bot/modules/Database');
const {clone} = require('../../../bot/bots/helpers/common');
const moment = require('moment');

const DB_NAME = 'plumcore_bot';

module.exports = {
    getDates(start, end) {
        let datesCount = moment.unix(end).diff(moment.unix(start), 'd');
        let dates = Array(datesCount).fill(0).map((_, index) => moment.unix(start).add(index, 'd').format('DD.MM.YYYY'));
        return dates;
    },

    addMissingDates(start, end, data, emptyItem) {
        let dates = this.getDates(start, end);

        let allDatesData = [];
        for (const date of dates) {
            let dateItem = data.find(item => item.date === date);
            if (!dateItem) {
                dateItem = clone(emptyItem);
                dateItem.date = date;
            }

            allDatesData.push(dateItem);
        }

        return allDatesData;
    },

    async getUserStats(start, end) {
        let db = await getDb(DB_NAME);
        let newUsers = await db.collection('users').aggregate([
            { $match: {$and: [
                        {registered: {$gte: start}},
                        {registered: {$lte: end}},
                    ]} },
            { $addFields: {
                    createdDate: { $dateToString: {
                            format: "%d.%m.%Y",
                            date: {$toDate: {$multiply: ["$registered", 1000]}},
                        }
                    }
                }},
            { $group: {
                    _id: "$createdDate",
                    date: {$first: "$createdDate"},
                    count: {$sum: 1},
                }},
        ]).toArray();

        let blockedUsers = await db.collection('users').aggregate([
            { $match: {$and: [
                        {blocked: {$gte: start}},
                        {blocked: {$lte: end}},
                    ]} },
            { $addFields: {
                    blockedDate: { $dateToString: {
                            format: "%d.%m.%Y",
                            date: {$toDate: {$multiply: ["$blocked", 1000]}},
                        }
                    }
                }},
            { $group: {
                    _id: "$blockedDate",
                    date: {$first: "$blockedDate"},
                    count: {$sum: 1},
                }},
        ]).toArray();

        let baseCount = await db.collection('users').count({
            $and: [
                {registered: {$lt: start}},
                {$or: [
                    {blocked: {$in: [null, false]}},
                    {blocked: {$gte: start}}
                ]}
            ],
        });

        let dateUsers = [];
        let users = baseCount;
        let dates = this.getDates(start, end);

        for (const date of dates) {
            let newUsersData = newUsers.find(item => item.date === date);
            let blockedUsersData = blockedUsers.find(item => item.date === date);

            let newUsersCount = newUsersData ? newUsersData.count : 0;
            let blockedUsersCount = blockedUsersData ? blockedUsersData.count : 0;
            dateUsers.push({date, users, new: newUsersCount, blocked: blockedUsersCount});

            users = users + newUsersCount - blockedUsersCount;
        }

        return dateUsers;
    },

    async dashboard(ctx) {
        let start = moment().subtract(7, 'day').startOf('d').unix();
        let end = moment().endOf('d').unix();
        let dateFilter = {$and: [
                {created: {$gte: start}},
                {created: {$lte: end}},
                {status: 'succeeded'},
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
                }},
        ]).toArray();

        let dateUsers = await this.getUserStats(start, end);
        let dates = this.getDates(start, end);

        let dateSales = dates.map(date => {
            let salesData = sales.find(item => item.date === date);
            let sum = salesData ? salesData.totalSum : 0;
            return  {date, sum}
        });

        ctx.body = {sales: dateSales, users: dateUsers};
    },

    async sales(ctx) {
        let days = ctx.request.body && typeof (ctx.request.body.days) === 'number'
            ? parseInt(ctx.request.body.days)
            : 7;

        let start = moment().subtract(days, 'day').startOf('d').unix();
        let end = moment().endOf('d').unix();
        let dateFilter = {$and: [
            {created: {$gte: start}},
            {created: {$lte: end}},
            {status: 'succeeded'},
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

        sales = this.addMissingDates(start, end, sales, {
            totalSum: 0,
            ordersCount: 0,
            courses: [],
            courseCount: 0,
        });

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
    },

    async users(ctx) {
        let days = ctx.request.body &&  typeof (ctx.request.body.days) === 'number'
            ? parseInt(ctx.request.body.days)
            : 7;

        let start = moment().subtract(days, 'day').startOf('d').unix();
        let end = moment().endOf('d').unix();

        let users = await this.getUserStats(start, end);
        ctx.body = {users}
    }
}