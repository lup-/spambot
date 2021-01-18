const {getDb} = require('../modules/Database');
const shortid = require('shortid');

module.exports = function () {
    return {
        settings(currentUserProfile) {
            let defaultSettings = {
                city: true,
                age: 'approx',
            }

            let currentSettings = currentUserProfile ? currentUserProfile.settings || {} : {};

            return  Object.assign(defaultSettings, currentSettings);
        },

        async randomProfile(currentUserProfile) {
            const db = await getDb();
            const profiles = db.collection('profiles');

            let settings = this.settings(currentUserProfile);

            let filter = {
                $and: [
                    {id: {$nin: currentUserProfile.skip || []}},
                    {id: {$nin: currentUserProfile.like || []}},
                ],
                sex: currentUserProfile.lookingFor,
                lookingFor: currentUserProfile.sex,
                stopped: {$in: [null, false]},
                blocked: {$in: [null, false]},
                complain: {$in: [null, false]},
            }

            if (settings.city && currentUserProfile.city) {
                filter.city = currentUserProfile.city;
            }

            if (settings.age === 'gt') {
                filter.age = {$gte: currentUserProfile.age};
            }

            if (settings.age === 'lt') {
                filter.age = {$lte: currentUserProfile.age};
            }

            if (settings.age === 'approx') {
                filter['$and'].push({age: {$gte: currentUserProfile.age-5}});
                filter['$and'].push({age: {$lte: currentUserProfile.age+5}});
            }

            let profile = await profiles.findOne(filter);
            return profile;
        },
        async myNextLike(currentUserProfile) {
            const db = await getDb();
            const profiles = db.collection('profiles');

            let filter = {
                $and: [
                    {id: {$nin: currentUserProfile.skip || []}},
                    {id: {$nin: currentUserProfile.like || []}},
                ],
                like: {$elemMatch: {$eq: currentUserProfile.id}},
            }

            let profile = await profiles.findOne(filter);
            return profile;
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
            if (profile.blocked) {
                profile.blocked = false;
            }
            profile.stopped = false;
            return this.saveProfile(profile);
        },
        async blockUser(profile) {
            if (profile) {
                profile.blocked = true;
                return this.saveProfile(profile);
            }
        },
        async stopSeeking(profile) {
            profile.stopped = true;
            return this.saveProfile(profile);
        },
        async complain(profile, byUser) {
            if (!profile.complainsBy) {
                profile.complainsBy = [];
            }

            if (profile.complainsBy.indexOf(byUser) === -1) {
                profile.complainsBy.push(byUser);
            }

            if (profile.complainsBy.length >= 3) {
                profile.complain = true;
            }
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