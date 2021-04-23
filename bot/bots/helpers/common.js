const {getDb} = require('../../modules/Database');
const {getManagerSync} = require('../../managers');
const {escapeHTML} = require('../../modules/Helpers');
const moment = require('moment');

async function catchErrors(err, ctx) {
    let sendError = false;
    let blockUser = false;

    try {
        await ctx.reply('Похоже, что-то пошло не по плану.\nПопробуйте начать заново /start.');
    }
    catch (e) {
        sendError = e;
        if (sendError && sendError.code) {
            if (sendError.code === 403) {
                blockUser = true;
            }
        }
    }

    if (blockUser) {
        try {
            let chat = getManagerSync('chat');
            await chat.addUserBlock(ctx, 'reply');
            return false;
        }
        catch (e) {
        }
    }

    try {
        let db = await getDb();
        let {from, chat} = ctx;
        let userId = from.id || chat.id || false;
        let errorRecord = {
            date: moment().unix(),
            userId,
            error: err.toString(),
            stack: err.stack || false,
            sendError: sendError.toString()
        }

        await db.collection('errors').insertOne(errorRecord);
    }
    catch (e) {}

    return;
}
function getDomain(link) {
    if (link.indexOf('http') !== 0) {
        link = 'https://'+link;
    }

    try {
        let url = new URL(link);
        return url.hostname.toLowerCase() || false;
    }
    catch (e) {
        return  false;
    }
}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

module.exports = {catchErrors, getDomain, escapeHTML, clone}