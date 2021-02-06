const {getDb} = require('../../bot/modules/Database');
const {wait} = require('../../bot/modules/Helpers');
const Telegram = require('../../bot/node_modules/telegraf/telegram');
const moment = require('../../bot/node_modules/moment');

const MAILING_DB_NAME = 'botofarmer';
const MAILING_ID = process.argv[2];
const BOT_ID = process.argv[3];
const BOT_TOKEN = process.argv[4];
const CHUNK_SIZE = 5;

const tg = new Telegram(BOT_TOKEN);

async function deleteNotInited(db, mailingId) {
    let mailing = await db.collection('mailings').findOne({id: mailingId});
    return typeof(mailing.deleteStatus) === 'undefined';
}

async function initDeleteQueue(db, mailingId) {
    return db.collection('mailingQueue').updateMany({mailing: mailingId, status: 'sent'}, { $set: {
            "delete.status": 'new'
        }
    });
}

async function initDeleteCounters(db, mailingId) {
    return db.collection('mailings').updateOne({id: mailingId}, { $set: {
        deleteStarted: moment().unix(),
        deleteStatus: 'processing',
        "delete": {
            total: 0,
            success: 0,
            blocks: 0,
            errors: 0,
            processed: 0,
        }
    } });
}

async function finishDelete(db, mailingId) {
    return db.collection('mailings').updateOne({id: mailingId}, { $set: {
            deleteFinished: moment().unix()
        } });
}

async function getMailingMessagesChunk(db, mailingId, chunkSize) {
    return db.collection('mailingQueue').aggregate([
        { $match: {mailing: mailingId, bot: BOT_ID, "delete.status": 'new'} },
        { $limit: chunkSize }
    ]).toArray();
}

async function updateCounters(counterCode) {
    let query = {"delete.processed": 1};
    query[`delete.${counterCode}`] = 1;

    let mailingDb = await getDb(MAILING_DB_NAME);
    return mailingDb.collection('mailings').updateOne({id: this.id}, {$inc: query});
}

async function setDeleteFailed(db, queueMessage, error) {
    console.log(`${queueMessage.chatId}, ${queueMessage.messageId} ошибка ${error.toString()}`);
    await db.collection('mailingQueue').updateOne({_id: queueMessage._id}, {$set: {"delete.status": 'failed', "delete.error": error}});
    return updateCounters('errors');
}

async function setDeleteFinished(db, queueMessage) {
    console.log(`${queueMessage.chatId}, ${queueMessage.messageId} сообщение удалено`);
    await db.collection('mailingQueue').updateOne({_id: queueMessage._id}, {$set: {"delete.status": 'deleted'}});
    return updateCounters('success');
}

async function setDeleteBlock(db, queueMessage) {
    console.log(`${queueMessage.chatId}, ${queueMessage.messageId} блокировка`);
    await db.collection('mailingQueue').updateOne({_id: queueMessage._id}, {$set: {"delete.status": 'blocked'}});
    return updateCounters('blocks');
}

async function deleteMessage(db, tg, queueMessage) {
    let response = false;

    try {
        response = await tg.deleteMessage(queueMessage.chatId, queueMessage.messageId);
        if (!response) {
            await setDeleteFailed(db, queueMessage, false);
        }
        else {
            await setDeleteFinished(db, queueMessage);
        }
    }
    catch (sendError) {
        if (sendError && sendError.code) {
            if (sendError.code === 403) {
                await setDeleteBlock(db, queueMessage);
                return false;
            }

            if (sendError.code === 429) {
                let waitTimeMs = sendError.parameters && sendError.parameters.retry_after
                    ? (sendError.parameters.retry_after || 1) * 1000
                    : 1000;

                console.log(`Пауза ${waitTimeMs/1000}`);
                await wait(waitTimeMs);
                return deleteMessage(db, tg, queueMessage);
            }

            await setDeleteFailed(db, queueMessage, sendError);
            return false;
        }
    }

    return response;
}

(async () => {
    let db = await getDb(MAILING_DB_NAME);
    if (await deleteNotInited(db, MAILING_ID)) {
        await initDeleteQueue(db, MAILING_ID);
        await initDeleteCounters(db, MAILING_ID);
    }

    let chunkHasMessages = false;
    do {
        let messageChunk = await getMailingMessagesChunk(db, MAILING_ID, CHUNK_SIZE);
        chunkHasMessages = messageChunk.length > 0;
        if (chunkHasMessages) {
            for (const queueMessage of messageChunk) {
                await deleteMessage(db, tg, queueMessage);
            }
        }
    } while (chunkHasMessages);

    await finishDelete(db, MAILING_ID);
    process.exit();
})();