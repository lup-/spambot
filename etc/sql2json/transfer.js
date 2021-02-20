const {getDb} = require('../../bot/modules/Database');
const moment = require('../../bot/node_modules/moment');
const axios = require('../../bot/node_modules/axios');
const shortid = require('../../bot/node_modules/shortid');

const VACANCIES_DB = process.env.VACANCIES_DB || 'vacancies';

const fromDb = process.argv[2];
const toDb = process.argv[3];

function normalizePhone(phone) {
    phone = phone.replace(/\D+/g, '').replace(/^\+8/, '+7');

    if (phone[0] === '8') {
        phone[0] = '7';
    }

    if (phone.length <= 10) {
        phone = '7'+phone;
    }

    return '+'+phone;
}

async function getData(dbName) {
    let db = await getDb(dbName);
    let users = false;
    let refs = false;
    let cvs = false;
    let profiles = false;

    switch (dbName) {
        case 'bookie_bot':
        case 'bookie_bot_old':
        case 'book_savebot':
        case 'boookie_bot_new':
        case 'book_savebot_new':
        case 'books_for_free_bott_new':
            let oldUsers = await db.collection('public.bot_user').find({}).toArray();
            users = oldUsers.map(oldUser => {
                let startedAt;
                try {
                    startedAt = oldUser.startedAt ? moment(oldUser.startedAt).unix() : null;
                }
                catch (e) {
                    startedAt = null
                }

                return {
                    "id": oldUser.id,
                    "user": {
                        "id": oldUser.id,
                        "is_bot": false,
                        "first_name": oldUser.firstName,
                        "last_name": oldUser.lastName,
                        "username": oldUser.username,
                        "language_code": null
                    },
                    "chat": {
                        "id": oldUser.id,
                        "first_name": oldUser.firstName,
                        "last_name": oldUser.lastName,
                        "username": oldUser.username,
                        "type": "private"
                    },
                    "transferred": true,
                    "registered": startedAt,
                    "updated": startedAt
                };
            });

            let refDate = moment().subtract('1', 'd').startOf('d').unix();
            let oldRefs = await db.collection('public.post_model').find({}).toArray();
            refs = oldRefs.reduce((records, oldRef) => {
                let refRecords = Array(oldRef.amountOfViews).fill(false).map(() => {
                    let ref = 'p'+oldRef.id;
                    let userId = 0;

                    return {
                        "refId" : `${userId}:${ref}`,
                        "userId" : userId,
                        "ref" : ref,
                        "date" : refDate
                    }
                });

                records = records.concat(refRecords);
                return records;
            }, []);
        break;
        case 'remoteworkdb':
        case 'remoteworkdb1':
        case 'remoteworkdb2':
            let oldRemoteUsers = await db.collection('public.users').aggregate([
                {$lookup: {from: 'public.category_user', localField: 'userId', foreignField: 'userId', as: 'user_category'}},
                {$lookup: {from: 'public.categories', localField: 'user_category.categoryId', foreignField: 'categoryId', as: 'categories'}},
            ]).toArray();
            let oldCvs = await db.collection('public.cvs').find({}).toArray();
            let response = await axios.get('https://api.hh.ru/specializations');
            let hhCategories = response.data.reduce((categories, area) => categories.concat(area.specializations || []), []);
            let oldVacancies = await db.collection('public.vacancies').find({}).toArray();

            users = oldRemoteUsers.map(oldUser => {
                let startedAt;
                try {
                    startedAt = oldUser.dateOfStart ? moment(oldUser.dateOfStart).unix() : null;
                }
                catch (e) {
                    startedAt = null
                }

                return {
                    "id": oldUser.userId,
                    "user": {
                        "id": oldUser.userId,
                        "is_bot": false,
                        "first_name": oldUser.firstName,
                        "last_name": oldUser.lastName,
                        "username": oldUser.tag,
                        "language_code": null
                    },
                    "chat": {
                        "id": oldUser.userId,
                        "first_name": oldUser.firstName,
                        "last_name": oldUser.lastName,
                        "username": oldUser.tag,
                        "type": "private"
                    },
                    "transferred": true,
                    "registered": startedAt,
                    "updated": startedAt
                };
            });

            let usersWithCvs = oldRemoteUsers.filter(oldUser => oldCvs.findIndex(oldCv => oldCv.userId === oldUser.userId) !== -1);
            cvs = usersWithCvs.map(oldUser => {
                let oldUserCvs = oldCvs.filter(oldCv => oldUser.userId === oldCv.userId);
                let oldCv = oldUserCvs.reduce((oldestCv, currentCv) => {
                    if (!oldestCv) {
                        return currentCv;
                    }

                    return oldestCv.createdAt < currentCv.createdAt
                        ? currentCv
                        : oldestCv;
                }, false)
                let position = oldCv && oldCv.title && oldCv.title.length < 100 ? oldCv.title : oldCv.cvName;
                let phone = oldUser && oldUser.phoneNumber
                    ? normalizePhone(oldUser.phoneNumber)
                    : false;

                let isFileFieldLink = oldCv && oldCv.filePath && /^https*:\/\//i.test(oldCv.filePath);

                let isPathFileId = oldCv && oldCv.filePath && /^[a-z0-9_-]+$/i.test(oldCv.filePath) && oldCv.filePath.length > 70;
                let isExpFileId = oldCv && oldCv.experience && /^[a-z0-9_-]+$/i.test(oldCv.experience) && oldCv.experience.length > 70;
                let fileId = isPathFileId
                    ? oldCv.filePath
                    : (isExpFileId ? oldCv.experience : false);

                return {
                    "botName" : toDb,
                    "candidate" : {
                        "name" : oldUser ? [oldUser.lastName, oldUser.firstName].join(' ').trim() : false,
                        "nameParts" : {
                            "f" : oldUser ? oldUser.lastName : false,
                            "i" : oldUser ? oldUser.firstName : false,
                            "o" : false
                        },
                        "position" : position,
                        "salary" : false,
                        "city" : false,
                        "age" : oldUser && oldUser.providedAge ? oldUser.providedAge : false,
                        "birthday" : false,
                        "contacts" : {
                            "email" : oldUser && oldUser.email ? [ oldUser.email ] : false,
                            "phone" : phone ? [ phone ] : false,
                            "skype" : false,
                            "telegram" : false,
                            "whatsapp" : false
                        },
                        "social" : {
                            "facebook" : false,
                            "vk" : false,
                            "linkedin" : false,
                            "github" : false
                        },
                        "skills" : [],
                        "link": isFileFieldLink ? oldCv.filePath : false,
                    },
                    "oldCvs": oldUserCvs,
                    "fileId" : fileId,
                    "text" : `${oldCv.cvName}, ${oldCv.title}\nОпыт:\n${oldCv.experience}`,
                    "userId" : oldCv.userId
                }
            });

            profiles = oldRemoteUsers.map(oldUser => {
                let startedAt;
                try {
                    startedAt = oldUser.dateOfStart ? moment(oldUser.dateOfStart).unix() : null;
                }
                catch (e) {
                    startedAt = null
                }

                let categories = oldUser.categories.map(oldCategory => {
                    return hhCategories.find(hhCategory => hhCategory.name === oldCategory.categoryName) || false;
                }).filter(category => category !== false).map(category => category.id);

                return {
                    "userId" : oldUser.userId,
                    "chatId" : oldUser.userId,
                    "category" : categories,
                    "id" : shortid.generate(),
                    "lastVisit" : startedAt,
                    "subscribed" : categories.length > 0,
                }
            });

            let remoteRefDate = moment().subtract('1', 'd').startOf('d').unix();
            refs = oldVacancies.reduce((records, oldRef) => {
                let refRecords = Array(oldRef.amountOfClicks).fill(false).map(() => {
                    let ref = oldRef.vacancyId;
                    let userId = 0;

                    return {
                        "refId" : `${userId}:${ref}`,
                        "userId" : userId,
                        "ref" : ref.toString(),
                        "date" : remoteRefDate
                    }
                });

                records = records.concat(refRecords);
                return records;
            }, []);
        break;
        case 'promokodes':
        case 'promokodas':
            let oldKodesUsers = await db.collection('public.bot_users').find({}).toArray();
            users = oldKodesUsers.map(oldUser => {
                let startedAt;
                try {
                    startedAt = oldUser.startedAt ? moment(oldUser.startedAt).unix() : null;
                }
                catch (e) {
                    startedAt = null
                }

                return {
                    "id": oldUser.id,
                    "user": {
                        "id": oldUser.id,
                        "is_bot": false,
                        "first_name": oldUser.firstName,
                        "last_name": oldUser.lastName,
                        "username": oldUser.username,
                        "language_code": null
                    },
                    "chat": {
                        "id": oldUser.id,
                        "first_name": oldUser.firstName,
                        "last_name": oldUser.lastName,
                        "username": oldUser.username,
                        "type": "private"
                    },
                    "transferred": true,
                    "registered": startedAt,
                    "updated": startedAt
                };
            });
            break;
    }

    return {users, refs, cvs, profiles};
}

(async () => {
    console.log(`Загрузка данных из ${fromDb}`);
    let {users, refs, cvs, profiles} = await getData(fromDb);

    let db = await getDb(toDb);
    if (users && users.length > 0) {
        console.log(`Сохранение ${users.length} пользователей в ${toDb}`);
        await db.collection('users').insertMany(users);
    }

    if (refs && refs.length > 0) {
        console.log(`Сохранение рефок в ${toDb}`);
        await db.collection('refs').insertMany(refs);
    }

    if (profiles && profiles.length > 0) {
        console.log(`Сохранение профилей в ${toDb}`);
        await db.collection('profiles').insertMany(profiles);
    }

    if (cvs && cvs.length > 0) {
        let vDb = await getDb(VACANCIES_DB);
        console.log(`Сохранение резюме в ${VACANCIES_DB}`);
        await vDb.collection('resumes').insertMany(cvs);
    }

    process.exit();
})();