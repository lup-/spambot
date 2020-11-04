const getBotManager = require('../modules/Bot');
const getChatManager = require('./Chat');
const getStatManager = require('./Stat');

let instances = false;

async function init() {
    let bot = await getBotManager().init(process.env.BOT_TOKEN);
    let chat = await getChatManager().init();
    let stat = await getStatManager().init(process.env.MONGO_DB);

    return {bot, chat, stat};
}

module.exports = {
    getManager: async function (manager) {
        if (instances) {
            return instances[manager];
        }

        instances = await init();
        return instances[manager];
    },
    initManagers: async function () {
        instances = await init();
        return instances;
    }
}