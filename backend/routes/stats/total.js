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

    async getTotalUsers() {
        let dayTotalUsers = await this.getDaysTotalUsers(0);
        let yesterdayTotalUsers = await this.getDaysTotalUsers(1);
        let weekTotalUsers = await this.getDaysTotalUsers(7);
        let monthTotalUsers = await this.getDaysTotalUsers(30);

        return {dayTotalUsers,yesterdayTotalUsers, weekTotalUsers, monthTotalUsers};
    },

    async getTotalUsersFromBotDb(dbName, days) {
        let db = await getDb(dbName);
        let countUsersDB = await db.collection('users').count({registered: {$lt: this.dateTo(days)}});
        return countUsersDB;
    },

    async getTotalUsersInAllBots(days) {
        let bots = await this.getBotsList();

        let countTotalUsers = 0;

        for (const bot of bots) {
            let totalUsers = await this.getTotalUsersFromBotDb(bot.dbName, days);

            countTotalUsers += totalUsers;
        }

        return countTotalUsers;
    },

    async getDaysTotalUsers(days) {
        let daysTotalUsers = await this.getTotalUsersInAllBots(days);

        return daysTotalUsers;
    },

};
