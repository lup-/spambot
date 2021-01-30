const fs = require('fs');
const {getDb} = require('../../bot/modules/Database');
const {ObjectId} = require('../../bot/node_modules/mongodb');

async function getData(db) {
    let users = await db.collection('users').find({transferred: true}).toArray();
    let userIds = users.map(user => user.id);
    let profiles = await db.collection('profiles').find({userId: {$in: userIds}}).toArray();
    let refs = await db.collection('refs').find({userId: 0}).toArray();
    return {users, userIds, profiles, refs};
}

async function removeOldData(db, userIds) {
    await db.collection('users').remove({transferred: true});
    await db.collection('profiles').remove({userId: {$in: userIds}});
    await db.collection('refs').remove({userId: 0});
}

async function insertData(db, data) {
    await db.collection('users').insertMany(data.users);
    await db.collection('profiles').insertMany(data.profiles);
    await db.collection('refs').insertMany(data.refs);
}

function correctIds(data) {
    return {
        users: data.users.map(user => {
            user._id = ObjectId(user._id);
            return user;
        }),
        profiles: data.profiles.map(profile => {
            profile._id = ObjectId(profile._id);
            return profile;
        }),
        refs: data.refs.map(ref => {
            ref._id = ObjectId(ref._id);
            return ref;
        }),
        userIds: data.userIds,
    }
}

(async () => {
    let whDb = await getDb('workhant_bot');
    let trDb = await getDb('traineeship_bot');
    let vcDb = await getDb('vacancies');
    //
    // let whData = await getData(whDb);
    // let trData = await getData(trDb);
    //
    // fs.writeFileSync('whData.json', JSON.stringify(whData));
    // fs.writeFileSync('trData.json', JSON.stringify(trData));
    //
    // await removeOldData(whDb, whData.userIds);
    // await removeOldData(trDb, trData.userIds);

    let whData = JSON.parse( fs.readFileSync('whData.json') );
    let trData = JSON.parse( fs.readFileSync('trData.json') );
    whData = correctIds(whData);
    trData = correctIds(trData);

    await removeOldData(whDb, trData.userIds);

    await insertData(whDb, trData);
    await insertData(trDb, whData);

    await vcDb.collection('resumes').updateMany({botName: 'workhant_bot'}, {$set: {botName: '_'}});
    await vcDb.collection('resumes').updateMany({botName: 'traineeship_bot'}, {$set: {botName: 'workhant_bot'}});
    await vcDb.collection('resumes').updateMany({botName: '_'}, {$set: {botName: 'traineeship_bot'}});

    process.exit();
})();
