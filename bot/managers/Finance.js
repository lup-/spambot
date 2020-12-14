const {getDb} = require('../modules/Database');
const {getTags} = require('../bots/parsers/finance');
const moment = require('moment');

module.exports = function () {
    return {
        async listTags() {
            return getTags();
        },
        async listCategoriesByTag(tag) {
            let db = await getDb();
            let categories = db.collection('categories');
            return categories.find({tags: tag}).toArray();
        },
        async getRandomArticleByCategories(categories, profile) {
            let db = await getDb();
            let articles = db.collection('articles');
            let skipArticleIds = profile.sentArticleIds || [];
            let filter = { id: {$nin: skipArticleIds} };
            if (categories && categories.length > 0) {
                filter["categories.title"] = {$in: categories};
            }

            let randomArticle = await articles.aggregate([
                { $match: filter },
                { $sample: { size: 1 } }
            ]).toArray();

            return randomArticle[0];
        },
        getSavedTags(profile) {
            let hasTags = profile && profile.tags && profile.tags.length > 0;
            let hasNoTags = !hasTags;

            if (hasNoTags) {
                return [];
            }

            return profile.tags.map(tagData => tagData.tag);
        },
        getSavedTagCategories(tag, profile) {
            let hasTags = profile && profile.tags && profile.tags.length > 0;
            let hasNoTags = !hasTags;

            if (hasNoTags) {
                return [];
            }

            let tagData = profile.tags.find(tagData => tagData.tag === tag);
            if (!tagData) {
                return [];
            }

            return tagData.categories || [];
        },
        getSavedCategories(profile) {
            let tags = profile.tags || [];
            if (tags.length === 0) {
                return [];
            }

            let categories = tags
                .map(tag => tag.categories || [])
                .reduce((all, categories) => {
                    return all.concat(categories);
                }, [])
                .filter((title, index, all) => all.indexOf(title) === index);

            return categories;
        },
        getNextRemindDate() {
            return moment().add(2, 'm');
        },
        async subscribe(profileData, periodic, profile) {
            profileData.subscribed = true;
            await profile.saveProfile(profileData);
            let {userId, chatId} = profileData;

            let nextMessageTime = this.getNextRemindDate();
            return periodic.addCustomTaskInTime(userId, chatId, nextMessageTime);
        },
        async unsubscribe(profileData, periodic, profile) {
            profileData.subscribed = false;
            await profile.saveProfile(profileData);
            let {userId} = profileData;
            await periodic.setAllUserTasksComplete(userId);
        }
    }
}