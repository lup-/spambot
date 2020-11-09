const {getDb} = require('../modules/Database');
const shortid = require('shortid');
const moment = require('moment');

module.exports = function () {
    return {
        async listMailings(userId) {
            let filter = {
                userId,
                deleted: {$in: [null, false]},
                dateFinished: {$in: [null, false]},
                dateStarted: {$gte: moment().unix()}
            }

            const db = await getDb();
            const mailings = db.collection('mailings');
            let filteredMailings = await mailings.find(filter).toArray();

            return filteredMailings;
        },
        async listActiveMailings(exceptIds = []) {
            let filter = {
                id: {$nin: exceptIds},
                deleted: {$in: [null, false]},
                dateFinished: {$in: [null, false]},
            }

            const db = await getDb();
            const mailings = db.collection('mailings');
            let filteredMailings = await mailings.find(filter).toArray();

            return filteredMailings;
        },
        async getMailing(mailingId, userId) {
            const db = await getDb();
            const mailings = db.collection('mailings');

            let mailing = await mailings.findOne({id: mailingId, userId});
            return mailing;
        },
        async saveMailing(mailingFields) {
            const db = await getDb();
            const mailings = db.collection('mailings');

            if (!mailingFields.id) {
                mailingFields.id = shortid.generate();
            }

            const id = mailingFields.id;
            let updateResult = await mailings.findOneAndReplace({id}, mailingFields, {upsert: true, returnOriginal: false});
            return updateResult.value || false;
        },
    }
}