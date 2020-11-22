const {getDb} = require('../modules/Database');
const shortid = require('shortid');

module.exports = function () {
    return {
        async loadProfileByUserId(userId) {
            const db = await getDb();
            const profiles = db.collection('profiles');

            let profile = await profiles.findOne({userId});
            return profile;
        },
        async saveProfile(profile) {
            const db = await getDb();
            const profiles = db.collection('profiles');

            if (!profile.id) {
                profile.id = shortid.generate();
            }

            const id = profile.id;
            let updateResult = await profiles.findOneAndReplace({id}, profile, {upsert: true, returnOriginal: false});
            return updateResult.value || false;
        },
        initSessionProfileMiddleware() {
            return async (ctx, next) => {
                if (ctx.session.profile) {
                    return next();
                }

                const fromInfo = ctx.update.callback_query
                    ? ctx.update.callback_query.from
                    : ctx.update.message.from;
                const chatInfo = ctx.update.callback_query
                    ? ctx.update.callback_query.message.chat
                    : ctx.update.message.chat;

                const userId = fromInfo.id;

                ctx.session.userId = userId;
                ctx.session.chatId = chatInfo.id;

                let defaultProfile = {
                    userId,
                    chatId: chatInfo.id,
                }

                if (!ctx.session.profile) {
                    ctx.session.profile = await this.loadProfileByUserId(userId) || defaultProfile;
                }

                return next();
            }
        },

    }
}