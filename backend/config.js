const fs = require('fs');
const yaml = require('js-yaml');
const Telegram = require('telegraf/telegram');

module.exports = {
    parseEnvVars(varLines) {
        let vars = {};
        for (const line of varLines) {
            let matches = line.match(/^(.*?)=(.*)$/);
            if (matches) {
                let [,varName, varValue] = matches;
                vars[varName] = varValue;
            }
        }

        return vars;
    },
    getEnvVars() {
        let envPath = fs.realpathSync(__dirname+'/../.env');
        let envFile = fs.readFileSync(envPath, 'utf8');
        return this.parseEnvVars( envFile.split('\n') );
    },
    async getTgBotData(botToken) {
        const telegram = new Telegram(botToken);
        let me = await telegram.getMe();
        return me;
    },
    async botList() {
        let bots = [];

        try {
            let dockerConfigPath = fs.realpathSync(__dirname+'/../docker-compose.yml');
            const dockerConfig = yaml.safeLoad(fs.readFileSync(dockerConfigPath, 'utf8'));
            let botCodes = Object.keys(dockerConfig.services).filter(serviceName => /_bot$/.test(serviceName));
            let envVars = this.getEnvVars();

            for (const id of botCodes) {
                const botConfig = dockerConfig.services[id];
                const botEnv = this.parseEnvVars(botConfig.environment);
                let tokenVar = botEnv['BOT_TOKEN'].replace(/[$\{\}]/g,'');
                let containerName = botConfig.container_name;
                let dbName = botEnv['MONGO_DB'];
                let botName = botEnv['BOT_NAME'];
                let token = envVars[tokenVar];

                let tg = token
                    ? await this.getTgBotData(token)
                    : false;

                bots.push({
                    id, containerName, dbName, botName, token, tg
                });
            }
        }
        catch (e) {
            console.log(e);
        }

        return bots;
    },
    externalBotsList() {
        return [
            {
                id: 'book_bot',
                containerName: false,
                dbName: 'bookdb',
                botName: 'book_bot',
                token: false,
                external: true,
            },
            {
                id: 'music_bot',
                containerName: false,
                dbName: 'music_bot',
                botName: 'music_bot',
                token: false,
                external: true,
            },
            {
                id: 'promo_bot',
                containerName: false,
                dbName: 'promo-bot-db',
                botName: 'promo_bot',
                token: false,
                external: true,
            },
            {
                id: 'remotework_bot',
                containerName: false,
                dbName: 'remoteworkdb',
                botName: 'remotework_bot',
                token: false,
                external: true,
            },
        ];
    }
}