const getBotManager = require('./Bot');
const getChatManager = require('./Chat');
const StatManager = require('./Stat');
const HoroscopeManager = require('./Horoscope');
const MailingManager = require('./Mailing');
const DatingManager = require('./Dating');
const FilmManager = require('./Film');
const PddManager = require('./Pdd');
const PresentManager = require('./Present');
const PeriodicManager = require('./Periodic');
const ProfileManager = require('./Profile');
const DiseasesManager = require('./Diseases');
const PodcastsManager = require('./Podcasts');
const MessageBus = require('./MessageBus');

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
        case 'pdd':
            return new PddManager();
        case 'present':
            return new PresentManager();
        case 'periodic':
            return new PeriodicManager();
        case 'diseases':
            return new DiseasesManager();
        case 'profile':
            return new ProfileManager();
        case 'podcasts':
            return new PodcastsManager();
        case 'bus':
            return new MessageBus();

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