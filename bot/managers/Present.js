const {getDb} = require('../modules/Database');

module.exports = function () {
    return {
        async categoriesList() {
            const db = await getDb();
            const categories = db.collection('categories');
            return categories.find({}).toArray();
        },
        async discoverAtIndex(category, index) {
            const db = await getDb();
            const presentsCollection = db.collection('presents');

            let presents = await presentsCollection.find({
                category: {$elemMatch: {$eq: category.title}}
            }).toArray();

            let present = presents[index];
            let totalPresents = presents.length;
            let hasNext = index < totalPresents-1;
            let hasPrev = index > 0;

            return {present, hasPrev, hasNext, index, totalPresents} || false;
        },
        async saveLike(userId, chatId, present) {
            const db = await getDb();
            const likes = db.collection('likes');

            return likes.insertOne({userId, chatId, present});
        }
    }
}