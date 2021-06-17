const { exec } = require('child_process');

const RESTART_SCRIPT = process.env.RESTART_SCRIPT;
const STATUS_SCRIPT = process.env.STATUS_SCRIPT;

let restartWaiting = false;
let lastRestartCompleted = false;
let lastRestartError = null;
let lastRestartResult = null;

function execAsync(cmd, options) {
    return new Promise(resolve => {
        exec(cmd, options, (error, stdout, stderr) => {
            return resolve({error, stdout, stderr});
        });
    });
}

function execInBackground(fn) {
    return setTimeout(fn, 0);
}

module.exports = {
    async status(ctx) {
        let {error, stdout, stderr} = await execAsync(STATUS_SCRIPT);
        let hasError = error !== null;

        let serviceStatuses = stdout.split('\n')
            .filter(scriptOutputLine => scriptOutputLine && scriptOutputLine.length > 0)
            .map(scriptOutputLine => {
                let [service, status] = scriptOutputLine.split(' ');
                let ok = status === 'Up';
                return {service, status, ok};
            });

        let servicesOk = serviceStatuses.reduce((final, status) => final && status.ok, true);
        let everythingOk = !hasError && servicesOk;

        ctx.body = {everythingOk, serviceStatuses, error, debug: error ? stderr : null}
    },

    async restart(ctx) {
        restartWaiting = true;
        lastRestartCompleted = false;
        lastRestartError = null;
        lastRestartResult = null;

        execInBackground(async () => {
            let {error, stdout, stderr} = await execAsync(RESTART_SCRIPT);
            restartWaiting = false;
            lastRestartCompleted = true;
            lastRestartError = error ? error.code : null;
            lastRestartResult = stdout;
        });

        ctx.body = {waiting: true, error: null, result: null};
    },

    async restartStatus(ctx) {
        ctx.body = {waiting: restartWaiting, error: lastRestartError, result: lastRestartResult};
    }
}