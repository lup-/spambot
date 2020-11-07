const {md} = require('../modules/Helpers');
const {__, __md} = require('../modules/Messages');
const moment = require('moment');
const {getMenu} = require('../menus');
const getBot = require('../managers/Bot');
const {getManager} = require('../managers');

module.exports = {
    async menu(ctx) {
        return ctx.editMessageText(__('statMenu'), getMenu('stats', ctx.session));
    },
    async stat1d(ctx) {
        let stats = await getManager('stat');
        let dayStart = moment().startOf('d');
        let dayEnd = moment().endOf('d');
        let dayStats = await stats.getUsersStat(dayStart, dayEnd, 'h');
        let chart = await stats.drawChart(dayStats, 'Статистика за день');
        return ctx.replyWithPhoto({source: chart}, getMenu('stats', ctx.session));
    },
    async stat1w(ctx) {
        let stats = await getManager('stat');
        let dayStart = moment().startOf('w');
        let dayEnd = moment().endOf('w');
        let dayStats = await stats.getUsersStat(dayStart, dayEnd, 'd');
        let chart = await stats.drawChart(dayStats, 'Статистика за неделю');
        return ctx.replyWithPhoto({source: chart}, getMenu('stats', ctx.session));
    },
    async stat1m(ctx) {
        let stats = await getManager('stat');
        let dayStart = moment().startOf('M');
        let dayEnd = moment().endOf('M');
        let dayStats = await stats.getUsersStat(dayStart, dayEnd, 'd');
        let chart = await stats.drawChart(dayStats, 'Статистика за месяц');
        return ctx.replyWithPhoto({source: chart}, getMenu('stats', ctx.session));
    },
    async stat1y(ctx) {
        let stats = await getManager('stat');
        let dayStart = moment().startOf('y');
        let dayEnd = moment().endOf('y');
        let dayStats = await stats.getUsersStat(dayStart, dayEnd, 'm');
        let chart = await stats.drawChart(dayStats, 'Статистика за год');
        return ctx.replyWithPhoto({source: chart}, getMenu('stats', ctx.session));
    },
}
