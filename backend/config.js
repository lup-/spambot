const fs = require('fs');
const yaml = require('js-yaml');

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
    botList() {
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
                let token = envVars[tokenVar];

                bots.push({
                    id, containerName, dbName, token
                });
            }
        }
        catch (e) {
            console.log(e);
        }

        return bots;
    }
}