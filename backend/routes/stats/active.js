const {getDb} = require('../../../bot/modules/Database');
const moment = require('moment');
const config = require('../../config');

module.exports = {

    async getBotsList() {
        return config.botList();
    },

    dateTo(days) {
        return moment().subtract(days, 'd').startOf('d').unix();
    },

    async getActiveUsersFromBotDb(dbName, days) {
        let db = await getDb(dbName);
        let countActiveDB = await db.collection('activity').find({date: {$lt: this.dateTo(days)}});
        return countActiveDB;
    },

    async getActiveUsersInAllBots(days) {
        let bots = await this.getBotsList();
        let countActiveUsers = 0;

        for (const bot of bots) {
            let activeUsers = await this.getActiveUsersFromBotDb(bot.dbName, days);

            countActiveUsers += activeUsers;
        }
        return countActiveUsers;
    },

    async getDateActiveUsers(days) {
        let arrActiveUsers = [];

        let usersBots = await config.botList();
        for (user of usersBots) {
            let db = await getDb(user.dbName);
            let users = await db.collection('activity').find({date: {$lt: this.dateTo(days)}}).toArray();
            arrActiveUsers = arrActiveUsers.concat(users);
        }

        let activeUsers = this.filterActiveUserByIds(arrActiveUsers);
        return activeUsers;

    },

    filterActiveUserByIds(arrActiveUsers) {

        let userIds = arrActiveUsers.map(item => item.userId)
        return userIds.filter((item, index, allItems) => allItems.indexOf(item) === index);
    },

    async getActiveUsersCount(days) {

        let daysActiveUsers = await this.getDateActiveUsers(days);

        return daysActiveUsers.length;
    },

    async getActiveUsers() {
        let dayActiveUsers = await this.getActiveUsersCount(0);
        let yesterdayActiveUsers = await this.getActiveUsersCount(1);
        let weekActiveUsers = await this.getActiveUsersCount(7);
        let monthActiveUsers = await this.getActiveUsersCount(30);

        return {dayActiveUsers,yesterdayActiveUsers, weekActiveUsers, monthActiveUsers};
    },

};
