const {getDb} = require('../modules/Database');
const {getTags} = require('../bots/parsers/finance');
const {hashCode} = require('../modules/Helpers');
const {getCache} = require('../modules/Cache');
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
        async listCategoriesByIds(ids) {
            let db = await getDb();
            let categories = db.collection('categories');
            let allCategories = await categories.find({}).toArray();
            return allCategories.filter(category => ids.indexOf(category._id.toString()) !== -1);
        },
        async listCategoriesHierarcy() {
            let tags = await this.listTags();
            let categories = [];

            for (const tag of tags) {
                let tagCategories = await this.listCategoriesByTag(tag);
                let children = tagCategories.map(category => {
                    category.id = category._id.toString();
                    return category;
                });

                categories.push({
                    id: hashCode(tag),
                    title: tag,
                    children
                });
            }

            return categories;
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
            return moment().startOf('d').add(1, 'd').add(11, 'h');
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
        },

        async getNew(categoryTitles, profile, lastVisit) {
            let cacheId = `fincat_new_${profile.userId}`;
            let cache = await getCache();
            let secondsUntilTomorrow = moment()
                .startOf('d')
                .add(1, 'd')
                .diff(moment(), 'seconds');

            return cache.getPermanent(cacheId, async () => {
                let db = await getDb();
                let articles = db.collection('articles');

                let filter = {};
                if (categoryTitles && categoryTitles.length > 0) {
                    filter["categories.title"] = {$in: categoryTitles};
                }

                let dateFilter = {};
                if (lastVisit) {
                    dateFilter["_datePosted"] = {$gte: moment.unix(lastVisit).toDate()}
                }

                foundArticles = await articles.aggregate([
                    {$match: filter},
                    {$set: {_datePosted: {$toDate: "$date"}}},
                    {$match: dateFilter},
                    {$sort: {_datePosted: -1}}
                ]).toArray();


                return foundArticles;
            }, secondsUntilTomorrow);

        },
        async discoverAtIndex(categoryTitles, favorite, index, searchType, profile, lastVisit) {
            let db = await getDb();
            let articles = db.collection('articles');

            let filter = {};
            if (categoryTitles && categoryTitles.length > 0) {
                filter["categories.title"] = {$in: categoryTitles};
            }

            let sortedArticles;
            if (searchType === 'new') {
                sortedArticles = await this.getNew(categoryTitles, profile, lastVisit);
            }
            else if (searchType === 'favorite') {
                sortedArticles = await articles.aggregate([
                    {$match: {id: {$in: favorite}}},
                    {$set: {_datePosted: {$toDate: "$date"}}},
                    {$sort: {_datePosted: -1}}
                ]).toArray();
            }
            else {
                sortedArticles = await articles.aggregate([
                    {$match: filter},
                    {$set: {_datePosted: {$toDate: "$date"}}},
                    {$sort: {_datePosted: -1}}
                ]).toArray();
            }

            let item = sortedArticles[index] || false;
            let totalItems = sortedArticles.length;
            let hasNext = index < totalItems-1;
            let hasPrev = index > 0;
            let isFavorite = favorite && favorite.indexOf(item.id) !== -1;

            return item && totalItems > 0 ? {item, hasPrev, hasNext, index, totalItems, isFavorite} : false;
        },
        async toggleInFavourites(profile, article, profileManager) {
            if (!profile.favorite) {
                profile.favorite = [];
            }

            let favIndex = profile.favorite.indexOf(article.id);
            if (favIndex === -1) {
                profile.favorite.push(article.id)
            }
            else {
                profile.favorite.splice(favIndex, 1);
            }

            return profileManager.saveProfile(profile);
        },
        async saveLike(profile, article) {
            const db = await getDb();
            const likes = db.collection('likes');
            let {userId, chatId} = profile;

            return likes.insertOne({userId, chatId, article});
        },
        async getLike(profile, article) {
            const db = await getDb();
            const likes = db.collection('likes');
            let {userId, chatId} = profile;

            return likes.findOne({userId, chatId, "article.id": article.id});
        }

    }
}