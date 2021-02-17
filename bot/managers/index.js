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
const FinanceManager = require('./Finance');
const BusinessManager = require('./Business');
const VacanciesManager = require('./Vacancies');
const BooksManager = require('./Books');
const MessageBus = require('./MessageBus');
const PerformanceManager = require('./Perfomance');
const ProxyManager = require('./Proxy');
const CouponManager = require('./Coupon');

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
        case 'finance':
            return new FinanceManager();
        case 'business':
            return new BusinessManager();
        case 'vacancies':
            return new VacanciesManager();
        case 'books':
            return new BooksManager(params.proxy);
        case 'bus':
            return new MessageBus();
        case 'performance':
            return new PerformanceManager();
        case 'proxy':
            return new ProxyManager();
        case 'coupon':
            return new CouponManager();
        default:
            return null;
    }
}

module.exports = {
    init,
    getManagerSync(manager, params) {
        if (instances && instances[manager]) {
            return instances[manager];
        }

        instances[manager] = init(manager, params);
        return instances[manager];
    },
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