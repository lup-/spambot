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
                category: {$elemMatch: {$eq: category.title}},
                disabled: {$in: [null, false]},
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
        },
        async saveImageId(present, mediaMessage) {
            const db = await getDb();
            let imageId = false;

            if (mediaMessage.photo && mediaMessage.photo.length > 0) {
                let maxPhoto = mediaMessage.photo.reduce((max, current) => {
                    if (!max) {
                        return current;
                    }

                    return max.file_size < current.file_size
                        ? current
                        : max;
                }, false);

                if (maxPhoto) {
                    imageId = maxPhoto.file_id;
                }
            }

            if (imageId) {
                await db.collection('presents').updateOne({id: present.id}, {$set: {imageId}});
            }
        }
    }
}