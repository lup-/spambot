const {getDb} = require('../../bot/modules/Database');

module.exports = {
    async list(ctx) {
        let filter = ctx.request.body && ctx.request.body.filter
            ? ctx.request.body.filter || {}
            : {};

        let defaultFilter = {
            'deleted': {$in: [null, false]}
        };

        filter = Object.assign(defaultFilter, filter);

        let db = await getDb();
        let allMessages = db.collection('messages');

        let messages = await allMessages.find(filter).toArray();
        ctx.body = {messages};
    },
}