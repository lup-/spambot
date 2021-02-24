const shortid = require('shortid');
const crypto = require('crypto');
const moment = require('moment');
const {getDb} = require('../../bot/modules/Database');

function md5(string) {
    return crypto.createHash('md5').update(string).digest("hex");
}

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
        let users = await db.collection('users').find(filter).toArray();
        ctx.body = {users};
    },
    async add(ctx) {
        let db = await getDb();
        let userData = ctx.request.body.user;

        userData.id = shortid.generate();
        userData.registered = moment().unix();
        userData.passwordHash = md5(userData.password);
        delete userData.password;

        let result = await db.collection('users').insertOne(userData);
        let user = result.ops[0];

        ctx.body = { user };
    },
    async update(ctx) {
        let db = await getDb();
        let filter = ctx.request.body.filter || {};
        let userData = ctx.request.body.user;
        let id = userData.id;
        let query = Object.assign({id, deleted: {$in: [null, false]}}, filter);

        if (!id) {
            ctx.body = { user: false };
            return;
        }

        if (userData._id) {
            delete userData._id;
        }

        if (userData.password) {
            userData.passwordHash = md5(userData.password);
            delete userData.password;
        }

        let updateResult = await db.collection('users').findOneAndReplace(query, userData, {returnOriginal: false});
        let user = updateResult.value || false;

        ctx.body = { user };
    },
    async login(ctx) {
        let filter = ctx.request.body.filter || {};
        let login = ctx.request.body.login;
        let passwordHash = md5(ctx.request.body.password);

        let query = Object.assign({login, passwordHash, deleted: {$in: [null, false]}}, filter);

        let db = await getDb();
        let user = await db.collection('users').findOne(query);
        let isLoaded = Boolean(user);

        if (isLoaded) {
            delete user.passwordHash;
        }

        ctx.body = {
            user,
            error: isLoaded ? false : 'Логин или пароль не подходят',
        };
    },
    async check(ctx) {
        let id = ctx.request.body.id;
        let filter = ctx.request.body.filter || {};
        let query = Object.assign({ id, deleted: {$in: [null, false]} }, filter);

        let db = await getDb();
        let user = await db.collection('users').findOne(query);
        ctx.body = {success: Boolean(user)};
    },
    async delete(ctx) {
        let userData = ctx.request.body.user;
        let filter = ctx.request.body.filter || {};
        let id = userData.id;
        let query = Object.assign({id}, filter);

        let db = await getDb();
        let deleted = moment().unix();
        let updateResult = await db.collection('users').findOneAndUpdate(query, {$set: {deleted}}, {returnOriginal: false});
        let user = updateResult.value || false;

        ctx.body = { user };
    }
}