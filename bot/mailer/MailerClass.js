const moment = require('moment');

const cp = require('child_process');
const {getDb} = require('../modules/Database');
const {wait} = require('../modules/Helpers');
const {MAILING_DB_NAME, MAILING_STATUS_NEW, MAILING_STATUS_PROCESSING} = require('./SenderClass');

const MAILINGS_CHECK_INTERVAL_SEC = 60;

const eventLoopQueue = () => {
    return new Promise(resolve =>
        setImmediate(resolve)
    );
}

module.exports = class Mailer {
    constructor() {
        this.runLoop = false;
        this.activeMailings = [];
    }

    async getPendingMailings() {
        let db = await getDb(MAILING_DB_NAME);
        let now = moment().unix();
        return await db.collection('mailings').find({
            startAt: {'$lte': now},
            status: {'$in': [MAILING_STATUS_NEW, MAILING_STATUS_PROCESSING]},
        }).toArray();
    }

    async getNewMailings() {
        let allMailings = await this.getPendingMailings();
        let mailingIdsInWork = this.activeMailings.map(item => item.mailing.id);
        return allMailings.filter(mailing => mailingIdsInWork.indexOf(mailing.id) === -1);
    }

    async startSending(mailing) {
        const subprocess = cp.fork(`${__dirname}/sender.js`, [mailing.id], {execArgv: []});
        subprocess.on('exit', () => this.clearProcess(mailing.id));
        subprocess.on('data', data => console.log(`data: ${data}`));
        subprocess.on('error', error => console.log(error));
        this.activeMailings.push({mailing, subprocess});
    }

    stop() {
        this.runLoop = false;
    }

    stopMailing(mailingId) {
        let mailingProcess = this.activeMailings.find(item => item.mailing.id === mailingId);
        return new Promise(resolve => {
            if (mailingProcess) {
                mailingProcess.on('exit', exitCode => {
                    this.clearProcess(mailingId);
                    resolve(exitCode);
                });

                mailingProcess.subprocess.send({action: 'stop'});
            }
            else {
                resolve(false);
            }
        })
    }

    clearProcess(mailingId) {
        let index = this.activeMailings.findIndex(item => item.mailing.id === mailingId);
        if (index !== -1) {
            this.activeMailings.splice(index, 1);
        }
    }

    async launch() {
        this.runLoop = true;

        while (this.runLoop) {
            let mailings = await this.getNewMailings();

            if (mailings && mailings.length > 0) {
                for (const mailing of mailings) {
                    await this.startSending(mailing);
                }
            }

            await wait(MAILINGS_CHECK_INTERVAL_SEC * 1000);
            await eventLoopQueue();
        }
    }
}
