const {getDb} = require('../modules/Database');
const {escapeHTML} = require('../modules/Helpers');
const COLLECTION_NAME = 'courses';

module.exports = class Plumcore {
    async categoriesList() {
        const db = await getDb();
        const categories = db.collection('categories');
        return categories.find({}).toArray();
    }

    async discoverAtIndex(categoryIds, favoriteIds, index, searchType) {
        let db = await getDb();

        let filter = {'deleted': {$in: [null, false]}};
        if (categoryIds && categoryIds.length > 0) {
            filter["categories"] = {$in: categoryIds};
        }

        let items;
        if (searchType === 'favorite') {
            items = await db.collection(COLLECTION_NAME).find({id: {$in: favoriteIds}}).toArray();
        }
        else {
            items = await db.collection(COLLECTION_NAME).find(filter).toArray();
        }

        let item = items[index] || false;
        item.description = escapeHTML(item.description, true);

        let totalItems = items.length;
        let hasNext = index < totalItems-1;
        let hasPrev = index > 0;
        let isFavorite = favoriteIds && favoriteIds.indexOf(item.id) !== -1;

        return item && totalItems > 0
            ? {item, hasPrev, hasNext, index, totalItems, isFavorite}
            : false;
    }

}