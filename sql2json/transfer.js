const {getDb} = require('../bot/modules/Database');
const moment = require('../bot/node_modules/moment');

const fromDb = process.argv[2];
const toDb = process.argv[3];

async function getData(dbName) {
    let db = await getDb(dbName);
    let users = false;
    let refs = false;

    switch (dbName) {
        case 'bookie_bot':
        case 'bookie_bot_old':
        case 'book_savebot':
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
        break;
    }

    return {users, refs};
}

(async () => {
    console.log(`Загрузка данных из ${fromDb}`);
    let {users, refs} = await getData(fromDb);

    let db = await getDb(toDb);
    if (users && users.length > 0) {
        console.log(`Сохранение ${users.length} пользователей в ${toDb}`);
        await db.collection('users').insertMany(users);
    }

    if (refs && refs.length > 0) {
        console.log(`Сохранение рефок в ${toDb}`);
        await db.collection('refs').insertMany(refs);
    }

    process.exit();
})();