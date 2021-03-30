const {getDb} = require('./Database');
const moment = require('moment');

module.exports = async (ctx, next) => {
    try {
        let memberChanged = ctx.update && typeof (ctx.update.my_chat_member) !== 'undefined';
        if (!memberChanged) {
            return next();
        }

        let from = ctx.update.my_chat_member.from;
        let userId = from.id;
        let oldMember = ctx.update.my_chat_member.old_chat_member;
        let newMember = ctx.update.my_chat_member.new_chat_member;
        let statusChanged = oldMember && newMember && oldMember.status !== newMember.status;
        if (!statusChanged) {
            return next();
        }

        let userBlockedBot = newMember.status === 'kicked';
        let userUnblockedBot = newMember.status === 'member';
        let otherStatusChange = !userBlockedBot && !userUnblockedBot;
        if (otherStatusChange) {
            return next();
        }

        if (userUnblockedBot) {
            const db = await getDb();
            await db.collection('users').updateOne({id: userId}, {$set: {blocked: false}});
            return next();
        }

        if (userBlockedBot) {
            const db = await getDb();
            await db.collection('users').updateOne({id: userId}, {$set: {blocked: moment().unix()}});
        }
    }
    catch (e) {
        return next();
    }
}