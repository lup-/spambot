const {getDb} = require('../modules/Database');
const shortid = require('shortid');

module.exports = function () {
    return {
        async randomProfile(currentUserProfile) {
            return this.loadProfileByUserId(483896081);
        },

        async myNextLike(currentUserProfile) {
            return this.loadProfileByUserId(483896081);
        },

        async loadProfileByUserId(userId) {
            const db = await getDb();
            const profiles = db.collection('profiles');

            let profile = await profiles.findOne({userId});
            return profile;
        },

        async loadProfileById(id) {
            const db = await getDb();
            const profiles = db.collection('profiles');

            let profile = await profiles.findOne({id});
            return profile;
        },

        async startSeeking(profile) {
            profile.stopped = false;
            return this.saveProfile(profile);
        },

        async stopSeeking(profile) {
            profile.stopped = true;
            return this.saveProfile(profile);
        },

        async like(targetId, profile) {
            if (!profile.like) {
                profile.like = [];
            }

            profile.like.push(targetId);
            return this.saveProfile(profile);
        },
        async isDoubleLike(targetId, meProfile) {
            let meLikes = meProfile.like && meProfile.like.indexOf(targetId) !== -1;
            if (!meLikes) {
                return false;
            }

            let themProfile = await this.loadProfileById(targetId);
            if (!themProfile) {
                return false;
            }

            let themLikes = themProfile.like && themProfile.like.indexOf(meProfile.id) !== -1;
            return meLikes && themLikes;
        },
        async skip(targetId, profile) {
            if (!profile.skip) {
                profile.skip = [];
            }

            profile.skip.push(targetId);
            return this.saveProfile(profile);
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

        getProfileText(profile) {
            if (!profile) {
                return '';
            }
            let details = profile.details ? `\n\n${profile.details}` : '';
            return `${profile.name}, ${profile.age}, ${profile.city}${details}`;
        }
    }
}