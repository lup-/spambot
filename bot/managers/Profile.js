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

            if (profile._id) {
                delete profile._id;
            }

            const id = profile.id;
            let updateResult = await profiles.findOneAndReplace({id}, profile, {upsert: true, returnOriginal: false});
            return updateResult.value || false;
        },
        async toggleInFavourites(profile, item) {
            if (!profile.favorite) {
                profile.favorite = [];
            }

            let favIndex = profile.favorite.indexOf(item.id);
            if (favIndex === -1) {
                profile.favorite.push(item.id)
            }
            else {
                profile.favorite.splice(favIndex, 1);
            }

            return this.saveProfile(profile);
        },
        async addToOwnedItems(profile, item) {
            if (!profile.owned) {
                profile.owned = [];
            }

            let notAlreadyOwned = profile.owned.findIndex(owned => owned.id === item.id) === -1;
            if (notAlreadyOwned) {
                profile.owned.push(item);
                return this.saveProfile(profile);
            }
            else {
                return profile;
            }
        },
        initSessionProfileMiddleware() {
            return async (ctx, next) => {
                const fromInfo = ctx.from;
                const chatInfo = ctx.chat;
                if (!fromInfo || !chatInfo) {
                    return next();
                }

                const userId = fromInfo.id;

                let hasProfile = Boolean(ctx.session.profile);
                let doReload = ctx.globalState && ctx.globalState.has('reloadProfile', userId);
                let noReload = !doReload;

                let skipProfile = hasProfile && noReload;

                if (skipProfile) {
                    return next();
                }

                if (doReload) {
                    ctx.globalState.delete('reloadProfile', userId);
                }

                ctx.session.userId = userId;
                ctx.session.chatId = chatInfo.id;

                let defaultProfile = {
                    userId,
                    chatId: chatInfo.id,
                }

                ctx.session.profile = await this.loadProfileByUserId(userId) || defaultProfile;
                return next();
            }
        }
    }
}