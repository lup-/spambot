const axios = require('axios');
const {parseUrl} = require('../bots/helpers/parser');
const {getDb} = require('../modules/Database');
const moment = require('moment');

const HH_API_BASE = `https://api.hh.ru/`;
const VACANCIES_DB = process.env.VACANCIES_DB || 'vacancies';
const SKIP_HH = process.env.SKIP_HH === '1';
const BOT_NAME = process.env.BOT_NAME;

module.exports = function () {
    return {
        async getHH(entity, id = false, params) {
            let url = HH_API_BASE + entity;
            if (id) {
                url += '/' + id;
            }

            let config = params ? {params} : {};
            let results = await axios.get(url, config);
            return results.data;
        },
        async getLocalCatalogCategories() {
            const db = await getDb(VACANCIES_DB);
            let botCategories = await db.collection('vacancies').aggregate([
                {$unwind: "$bots"},
                {$match: {bots: BOT_NAME}},
                {$unwind: "$categories"},
                {$group: {
                        "_id": "$bots",
                        "bot": {$first: "$bots"},
                        "categories": {$addToSet: "$categories"}
                    }}
            ]).toArray();

            return botCategories && botCategories[0] && botCategories[0].categories
                ? botCategories[0].categories.map(text => ({id: text, title: text}))
                : [];
        },
        async getCatalogCategories() {
            let settingsDb = await getDb('botofarmer');
            let settings = await settingsDb.collection('botSettings').findOne({botName: BOT_NAME});

            if (settings.restrictToBot) {
                return this.getLocalCatalogCategories();
            }

            let specs = await this.getHH('specializations');

            return specs.map(spec => {
                let children = spec.specializations.map(subspec => ({
                    id: subspec.id,
                    title: subspec.name
                }));

                return {
                    id: spec.id,
                    title: spec.name,
                    children
                }
            });
        },
        async getCategoriesByIds(ids) {
            let allCategories = await this.getCatalogCategories();
            return allCategories.reduce((all, category) => {
                let selectedChildren = category.children.filter(subcat => ids.indexOf(subcat.id) !== -1);
                return all.concat(selectedChildren);
            }, [])
        },
        getSelectedCategoryIds(ctx) {
            return ctx.session.profile.category || [];
        },
        async getLocalVacancies(categoryIds, params) {
            let db = await getDb(VACANCIES_DB);
            let settingsDb = await getDb('botofarmer');
            let query = categoryIds && categoryIds.length > 0
                ? {categories: {$in: categoryIds}}
                : {};

            let settings = await settingsDb.collection('botSettings').findOne({botName: BOT_NAME});

            if (settings.restrictToBot) {
                query['bots'] = BOT_NAME;
            }
            else {
                if (params && params.schedule && params.schedule === 'remote') {
                    query['remote'] = true;
                }

                if (params && params.employment && params.employment === 'probation') {
                    query['internship'] = true;
                }
            }

            let vacancies = await db.collection('vacancies').aggregate([
                {$match: query},
                {$sort: {created: -1}}
            ]).toArray();

            return vacancies.map(vacancy => {
                vacancy.showType = 'local';
                return vacancy;
            });
        },
        async getHHVacancies(categoryIds, index, params) {
            const pageSize = 20;
            const pageNum = Math.floor(index/pageSize);

            let query = categoryIds.map(id => `specialization=${id}`).join('&');
            query += `&page=${pageNum}`;

            let response = await this.getHH('vacancies', '?'+query, params);
            let vacancies = response.items.map(vacancy => {
                vacancy.showType = 'hh';
                return vacancy;
            });
            return {
                vacancies,
                totalVacancies: response.found
            }
        },
        async getVacancies(categoryIds, index, params, skipHH = false) {
            let localVacancies = await this.getLocalVacancies(categoryIds, params);
            if (skipHH) {
                return {vacancies: localVacancies, totalVacancies: localVacancies.length};
            }

            let joinedVacancies = [].concat(localVacancies);

            let totalVacancies = localVacancies.length;
            let hhIndex = index-localVacancies.length < 0 ? 0 : index-localVacancies.length;

            let result = await this.getHHVacancies(categoryIds, hhIndex, params);
            joinedVacancies = joinedVacancies.concat(result.vacancies);
            totalVacancies += result.totalVacancies;

            return {vacancies: joinedVacancies, totalVacancies};
        },
        async getLatestVacancy(profile, params, saveProfile = false) {
            let categoryIds = profile.category || [];
            let sinceTime = profile.lastVisit;

            let localVacancies = await this.getLocalVacancies(categoryIds, params);
            let hasLocalVacancies = localVacancies && localVacancies.length > 0;
            let latestVacancy = false;

            if (hasLocalVacancies) {
                let briefVacancy = localVacancies[0];
                if (briefVacancy.created > sinceTime) {
                    briefVacancy.showType = 'local';
                    latestVacancy = briefVacancy;
                }
            }

            if (!latestVacancy) {
                let result = await this.getHHVacancies(categoryIds, 0, params);
                let hhVacancies = result.vacancies;
                let hasHHVacancies = hhVacancies && hhVacancies.length > 0;

                if (hasHHVacancies) {
                    let briefVacancy = hhVacancies[0];
                    let vacancyTime = moment(briefVacancy.published_at).unix();

                    if (vacancyTime > sinceTime) {
                        if (saveProfile) {
                            profile.lastVisit = vacancyTime;
                            await saveProfile(profile);
                        }

                        latestVacancy = briefVacancy;
                    }
                }
            }

            return latestVacancy ? this.getVacancy(latestVacancy.id) : false;
        },
        async parseVacancy(url) {
            let {vacancy} = await parseUrl(url, {
                vacancy(document) {
                    let templateEl = document.querySelector('#HH-Lux-InitialState');
                    let dataJSON = templateEl.innerHTML;
                    let data = JSON.parse(dataJSON);
                    return data.vacancyView;
                }
            });

            return vacancy;
        },
        async getLocalVacancy(id) {
            let db = await getDb(VACANCIES_DB);
            return db.collection('vacancies').findOne({id});
        },
        async getVacancy(id) {
            let vacancy = await this.getLocalVacancy(id);
            if (vacancy) {
                vacancy.showType = 'local';
                return vacancy;
            }

            vacancy = this.getHH('vacancies', id) || false;
            if (vacancy) {
                vacancy.showType = 'hh';
            }

            return vacancy;
        },
        async discoverAtIndex(ctx, index, params) {
            let categoryIds = this.getSelectedCategoryIds(ctx);

            let savedVacancies = ctx.scene.state.vacancies || false;
            let favorite = ctx.session.profile.favorite || [];
            let totalItems = ctx.scene.state.totalItems || 0;

            let needLoadVacancies = (savedVacancies === false) || (savedVacancies && savedVacancies.length-1 < index);
            if (needLoadVacancies) {
                let {vacancies, totalVacancies} = await this.getVacancies(categoryIds, index, params, SKIP_HH);
                totalItems = totalVacancies;
                savedVacancies = savedVacancies
                    ? savedVacancies.concat(vacancies)
                    : vacancies;
                ctx.scene.state.vacancies = savedVacancies;
                ctx.scene.state.totalItems = totalItems;
            }

            let brief = savedVacancies ? savedVacancies[index] || false : false;
            let item = brief;

            let hasNext = index < totalItems-1;
            let hasPrev = index > 0;
            let isFavorite = favorite && favorite.indexOf(item.id) !== -1;

            return item && totalItems > 0 ? {item, hasPrev, hasNext, index, totalItems, isFavorite} : false;
        },
        async deleteResume(userId) {
            const db = await getDb(VACANCIES_DB);
            let updateResult = await db.collection('resumes').findOneAndUpdate({userId}, {$set: {deleted: moment().unix()}});
            return updateResult.value || false;
        },
        async hasResume(userId) {
            const db = await getDb(VACANCIES_DB);
            let count = await db.collection('resumes').find({userId, deleted: {$in: [null, false]}}).count();
            return count > 0
        },
        async saveResume(candidate, fileId, text, userId) {
            const db = await getDb(VACANCIES_DB);
            let resume = {
                botName: process.env.BOT_NAME,
                candidate,
                fileId,
                text,
                userId
            }

            let updateResult = await db.collection('resumes').findOneAndReplace({userId}, resume, {upsert: true, returnOriginal: false});
            return updateResult.value || false;
        },
        getNextRemindDate() {
            return moment().startOf('d').add(1, 'd').add(11, 'h');
        }
    }
}