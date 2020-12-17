const {getDb} = require('../modules/Database');
const {hashCode} = require('../modules/Helpers');
const {getCache} = require('../modules/Cache');
const moment = require('moment');

module.exports = function () {
    return {
        getCategoryId(type, name) {
            return hashCode(type+':'+name)
        },
        async getCategories(type) {
            let db = await getDb();
            let articles = db.collection('articles');

            let categories = [];
            if (type === 'bm') {
                categories = await articles.aggregate([
                    {$match: {datePosted: {$nin: [false, null]}, source: type, viewLink: {$nin: [false, null]}}},
                    {$group: {"_id": "$category", count: {$sum: 1}}},
                    {$sort: {_id: 1}}
                ]).toArray();
            }
            else if (type === 'ff') {
                categories = await articles.aggregate([
                    {$match: {datePosted: {$nin: [false, null]}, source: type, viewLink: {$nin: [false, null]}}},
                    {$unwind: "$tags"},
                    {$group: {"_id": "$tags", count: {$sum: 1}}},
                    {$sort: {_id: 1}}
                ]).toArray();
            }
            else {
                return [];
            }

            return categories.map(rec => ({title: rec._id, id: this.getCategoryId(type, rec._id), type}));
        },
        getCategoryByIdAndType(id, type) {
            return this.getCategories(type).find(category => category.id === id);
        },
        async idsToCategories(categoryIds) {
            if (!categoryIds) {
                return [];
            }

            let [bm, ff] = await Promise.all([
                this.getCategories('bm'),
                this.getCategories('ff'),
            ]);

            return categoryIds.map(categoryId => {
                let bmCategory = bm.find(category => category.id === categoryId);
                let ffCategory = ff.find(category => category.id === categoryId);
                return bmCategory || ffCategory;
            });
        },
        async getArticles(selectedIds, type = false, fromPostTimeUnix = false) {
            let selectedCategories = await this.idsToCategories(selectedIds);
            let selectedNames = selectedCategories.map(category => category.title);
            let filterByNames = selectedNames && selectedNames.length > 0;

            let pipeline = [
                { $limit: 1 },
                { $project: { _id: 1 } },
                { $project: { _id: 0 } },
                { $lookup: { from: 'articles', pipeline: [
                            {$match: {datePosted: {$nin: [false, null]}, source: 'bm', viewLink: {$nin: [false, null]}}},
                            {$set: {searchCategory: "$category"}}
                        ], as: 'c1' } },
                { $lookup: { from: 'articles', pipeline: [
                            {$match: {datePosted: {$nin: [false, null]}, source: 'ff', category: 'Стартап', viewLink: {$nin: [false, null]}}},
                            (filterByNames ? {$unwind: "$tags"} : {$match: {}}),
                            {$set: {searchCategory: "$tags"}}
                        ], as: 'c2' } },

                {$project: {union: { $concatArrays: ["$c1", "$c2"] }}},
                {$unwind: "$union" },
                {$replaceRoot: {newRoot: "$union"}},
                {$set: {_datePosted: {$toDecimal: {$toDate: "$datePosted"}}}},
                {$sort: {_datePosted: -1}},
            ];

            if (type) {
                pipeline.push({$match: {source: type}});
            }

            if (filterByNames) {
                pipeline.push({$match: {searchCategory: {$in: selectedNames}}})
            }

            if (fromPostTimeUnix) {
                pipeline.push({$match: {_datePosted: {$gt: fromPostTimeUnix * 1000}}});
            }

            let db = await getDb();
            let articles = db.collection('articles');
            let foundArticles = await articles.aggregate(pipeline).toArray();

            return foundArticles;
        },
        async discoverAtIndex(type, profile, index) {
            let db = await getDb();
            let articles = db.collection('articles');

            let sortedArticles;
            if (type === 'recommendations') {
                sortedArticles = await this.getRecommendations(profile)
            }
            else if (type === 'favorite') {
                let favSlugs = profile && profile.favorite ? profile.favorite : [];

                sortedArticles = await articles.aggregate([
                    {$match: {slug: {$in: favSlugs}}},
                    {$set: {_datePosted: {$toDate: "$datePosted"}}},
                    {$sort: {_datePosted: -1}}
                ]).toArray();
            }
            else {
                let selectedIds = this.getSelectedCategories(profile, type);
                sortedArticles = await this.getArticles(selectedIds, type);
            }

            let idea = sortedArticles[index] || false;
            let totalIdeas = sortedArticles.length;
            let hasNext = index < totalIdeas-1;
            let hasPrev = index > 0;
            let isFavorite = profile && profile.favorite && profile.favorite.indexOf(idea.slug) !== -1;

            return idea && totalIdeas > 0 ? {idea, hasPrev, hasNext, index, totalIdeas, isFavorite} : false;
        },
        async toggleInFavourites(profile, idea, profileManager) {
            if (!profile.favorite) {
                profile.favorite = [];
            }

            let favIndex = profile.favorite.indexOf(idea.slug);
            if (favIndex === -1) {
                profile.favorite.push(idea.slug)
            }
            else {
                profile.favorite.splice(favIndex, 1);
            }

            return profileManager.saveProfile(profile);
        },
        getSelectedCategories(profile, type) {
            return profile && profile.categories && profile.categories[type]
                ? profile.categories[type] || false
                : false;
        },
        async toggleCategory(profile, type, categoryId, profileManager) {
            if (!profile.categories) {
                profile.categories = {bm: false, ff: false};
            }

            if (!profile.categories[type]) {
                profile.categories[type] = [];
            }

            let categoryIndex = profile.categories[type].indexOf(categoryId);
            if (categoryIndex === -1) {
                profile.categories[type].push(categoryId);
            }
            else {
                profile.categories[type].splice(categoryIndex, 1);
            }

            return profileManager.saveProfile(profile);
        },
        async getRecommendations(profile) {
            let cacheId = `recommendations_${profile.userId}`;
            let cache = await getCache();
            let secondsUntilTomorrow11am = moment()
                .startOf('d')
                .add(1, 'd').add(11, 'h')
                .diff(moment(), 'seconds');

            return cache.getPermanent(cacheId, async () => {
                let lastRecommends = profile.lastRecommends || false;

                let bm = profile.categories.bm || [];
                let ff = profile.categories.ff || [];
                let selectedIds = profile.categories
                    ? bm.concat(ff)
                    : [];

                let foundArticles = await this.getArticles(selectedIds, false, lastRecommends);

                return foundArticles;
            }, secondsUntilTomorrow11am);
        }
    }
}