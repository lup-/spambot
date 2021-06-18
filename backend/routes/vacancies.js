const {getDb} = require('../../bot/modules/Database');
const shortid = require('shortid');
const moment = require('moment');
const axios = require('axios');

const VACANCIES_DB = process.env.VACANCIES_DB || 'vacancies';

const HH_API_BASE = `https://api.hh.ru/`;
async function getHH(entity, id = false, params) {
    let url = HH_API_BASE + entity;
    if (id) {
        url += '/' + id;
    }

    let config = params ? {params} : {};
    let results = await axios.get(url, config);
    return results.data;
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

        let db = await getDb(VACANCIES_DB);
        let vacancies = await db.collection('vacancies').find(filter).toArray();
        ctx.body = {vacancies};
    },
    async add(ctx) {
        let vacancyFields = ctx.request.body.vacancy;
        if (vacancyFields._id) {
            ctx.body = {vacancy: false};
            return;
        }

        vacancyFields = Object.assign(vacancyFields, {
            id: shortid.generate(),
            created: moment().unix(),
            updated: moment().unix(),
        });

        const db = await getDb(VACANCIES_DB);
        let result = await db.collection('vacancies').insertOne(vacancyFields);
        let vacancy = result.ops[0];
        ctx.body = {vacancy};
    },
    async update(ctx) {
        const db = await getDb(VACANCIES_DB);

        let vacancyFields = ctx.request.body.vacancy;
        let id = vacancyFields.id;

        if (vacancyFields._id) {
            delete vacancyFields._id;
        }

        vacancyFields = Object.assign(vacancyFields, {
            updated: moment().unix(),
        });

        let updateResult = await db.collection('vacancies').findOneAndReplace({id}, vacancyFields, {returnOriginal: false});
        let vacancy = updateResult.value || false;

        ctx.body = {vacancy};
    },
    async delete(ctx) {
        const db = await getDb(VACANCIES_DB);

        let vacancyFields = ctx.request.body.vacancy;
        let id = vacancyFields.id;

        let updateResult = await db.collection('vacancies').findOneAndUpdate({id}, {$set: {deleted: moment().unix()}}, {returnOriginal: false});
        let vacancy = updateResult.value || false;

        ctx.body = {vacancy};
    },
    async categories(ctx) {
        let specs = await getHH('specializations');

        let categories = specs.reduce((categories, spec) => {
            spec.specializations.forEach(subspec => {
                categories.push({
                    id: subspec.id,
                    title: [spec.name, subspec.name].join('/'),
                });
            });

            return categories;
        }, []);

        ctx.body = {categories};
    },
    async customCategories(ctx) {
        let botNames = ctx.request.body.botNames || [];

        const db = await getDb(VACANCIES_DB);
        let categories = await db.collection('vacancies').aggregate([
            {$unwind: "$bots"},
            {$match: {bots: {$in: botNames}}},
            {$unwind: "$categories"},
            {$group: {
                "_id": "$bots",
                "bot": {$first: "$bots"},
                "categories": {$addToSet: "$categories"}
            }}
        ]).toArray();
        ctx.body = {categories};
    }
}