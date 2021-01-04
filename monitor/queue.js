const fs = require('fs');
const yaml = require('js-yaml');
const Prometheus = require('prom-client');
const Koa = require('koa');
const Telegram = require('telegraf/telegram');

function parseEnvVars(varLines) {
    let vars = {};
    for (const line of varLines) {
        let matches = line.match(/^(.*?)=(.*)$/);
        if (matches) {
            let [,varName, varValue] = matches;
            vars[varName] = varValue;
        }
    }

    return vars;
}
function getEnvVars() {
    let envPath = fs.realpathSync(__dirname+'/.env');
    let envFile = fs.readFileSync(envPath, 'utf8');
    return parseEnvVars( envFile.split('\n') );
}
function wait(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
}
async function botList() {
    let bots = [];

    try {
        let dockerConfigPath = fs.realpathSync(__dirname+'/docker-compose.yml');
        const dockerConfig = yaml.load(fs.readFileSync(dockerConfigPath, 'utf8'));
        let botCodes = Object.keys(dockerConfig.services).filter(serviceName => /_bot$/.test(serviceName));
        let envVars = getEnvVars();

        for (const id of botCodes) {
            const botConfig = dockerConfig.services[id];
            const botEnv = parseEnvVars(botConfig.environment);
            let tokenVar = botEnv['BOT_TOKEN'].replace(/[$\{\}]/g,'');
            let containerName = botConfig.container_name;
            let botName = botEnv['BOT_NAME'];
            let token = envVars[tokenVar];

            bots.push({
                id, containerName, botName, token
            });
        }
    }
    catch (e) {
        console.log(e);
    }

    return bots;
}
const eventLoopQueue = () => {
    return new Promise(resolve =>
        setImmediate(resolve)
    );
}

(async () => {
    let bots = await botList();

    let register = Prometheus.register;
    let gauges = {};
    let run = true;

    for (const bot of bots) {
        gauges[bot.id] = new Prometheus.Gauge({
            name: `${bot.id}_queue`,
            help: `Очередь обновлений для ${bot.id}`
        });
    }

    const server = new Koa();
    server.use(async ctx => {
        const url = ctx.request.url;

        try {
            ctx.type = register.contentType;

            if (url === '/metrics') {
                ctx.body = await register.metrics();
            }
            else {
                ctx.body = 'NOOP';
            }
        }
        catch (e) {
            ctx.status = 500;
            ctx.body = e;
        }
    });

    let httpServer = server.listen(process.env.PORT || 3000);

    process.once('SIGTERM', () => {
        run = false;
        httpServer.close();
    });

    while (run) {
        for (const bot of bots) {
            try {
                let telegram = new Telegram(bot.token);
                let webhookData = await telegram.getWebhookInfo();
                let updatesCount = webhookData.pending_update_count;

                let g = gauges[bot.id];
                g.set(updatesCount);
            }
            catch (e) {
            }
        }

        await wait(60 * 1000);
        await eventLoopQueue();
    }
})();

