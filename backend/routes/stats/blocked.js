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

    async getBlockedUsers() {
        let dayBlockedUsers = await this.getDaysBLockedUsers(0);
        let yesterdayBlockedUsers = await this.getDaysBLockedUsers(1);
        let weekBlockedUsers = await this.getDaysBLockedUsers(7);
        let monthBlockedUsers = await this.getDaysBLockedUsers(30);

        return {dayBlockedUsers, yesterdayBlockedUsers, weekBlockedUsers, monthBlockedUsers};
    },

    async getBlockedUsersFromBotDb(dbName, days) {
        let db = await getDb(dbName);
        let countBlockedDB = await db.collection('users').count({blockSince: {$lt: this.dateTo(days)}});
        return countBlockedDB;
    },

    async getBlockedUsersInAllBots(days) {
        let bots = await this.getBotsList();
        let countBlockedUsers = 0;

        for (const bot of bots) {
            let blockedUsers = await this.getBlockedUsersFromBotDb(bot.dbName, days);

            countBlockedUsers += blockedUsers;
        }

        return countBlockedUsers;
    },

    async getDaysBLockedUsers(days) {
        let blockedUsers = await this.getBlockedUsersInAllBots(days);

        return blockedUsers;
    },
};
