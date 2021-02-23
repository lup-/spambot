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

    async getUniqueUsersFromBotDb(dbName, days) {
        let db = await getDb(dbName);
        let countUniqueDB = await db.collection('users').find({registered: {$lt: this.dateTo(days)}});
        return countUniqueDB;
    },
    async getUniqueUsersInAllBots(days) {
        let bots = await this.getBotsList();
        let countUniqueUsers = [];

        for (const bot of bots) {
            let uniqueUsers = await this.getUniqueUsersFromBotDb(bot.dbName, days);

            countUniqueUsers = countUniqueUsers.concat(uniqueUsers);
        }

        return countUniqueUsers;
    },
    async getDaysUniqueUsers(days) {
        let uniqueUsers = await this.getUniqueUsersInAllBots(days);

        return uniqueUsers;
    },
    async getUniqueUsers(days) {
        let arrUsers = [];

        let usersBots = await config.botList();
        for (user of usersBots) {
            let db = await getDb(user.dbName);
            let users = await db.collection('users').find({registered: {$lt: this.dateTo(days)}}).toArray();

            arrUsers = arrUsers.concat(users);

        }
        let uniqueUsers = this.filterUniqueUserByIds(arrUsers);

        return uniqueUsers;
    },
    filterUniqueUserByIds(users) {

        let userIds = users.map(user => user.id);
        return userIds.filter((item, index, allItems) => allItems.indexOf(item) === index);
    },

    async getUniqueUsersCount(days) {
        let daysUniqueUsers = await this.getDaysUniqueUsers(days);

        return daysUniqueUsers.length;
    },

    async getUniqueUsers() {
        let dayUniqueUsers = await this.getUniqueUsersCount(0);
        let yesterdayUniqueUsers = await this.getUniqueUsersCount(1);
        let weekUniqueUsers = await this.getUniqueUsersCount(7);
        let monthUniqueUsers = await this.getUniqueUsersCount(30);

        return {dayUniqueUsers, yesterdayUniqueUsers, weekUniqueUsers, monthUniqueUsers};
    },

};
