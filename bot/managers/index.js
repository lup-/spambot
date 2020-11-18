const getBotManager = require('./Bot');
const getChatManager = require('./Chat');
const StatManager = require('./Stat');
const HoroscopeManager = require('./Horoscope');
const MailingManager = require('./Mailing');
const DatingManager = require('./Dating');
const FilmManager = require('./Film');

let instances = {};

function init(manager, params = {}) {
    switch (manager) {
        case 'bot':
            let token = params.token || process.env.BOT_TOKEN;
            return getBotManager().init(token);
        case 'chat':
            return getChatManager().init();
        case 'stat':
            let db = params.db || process.env.MONGO_DB;
            return (new StatManager).init(db);
        case 'horoscope':
            return new HoroscopeManager();
        case 'mailing':
            return new MailingManager();
        case 'dating':
            return new DatingManager();
        case 'film':
            return new FilmManager();
        default:
            return null;
    }
}

module.exports = {
    init,
    getManager: async function (manager) {
        if (instances && instances[manager]) {
            return instances[manager];
        }

        instances[manager] = await init(manager);
        return instances[manager];
    },
    initManagers: async function (managersList = [], params = {}) {
        instances = {};
        for (const manager of managersList) {
            let managerParams = params[manager] || {};
            instances[manager] = await init(manager, managerParams);
        }

        return instances;
    }
}