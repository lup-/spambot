const {getDb} = require('../modules/Database');
const {escapeHTML} = require('../modules/Helpers');
const {Telegram} = require('telegraf');
const State = require('./State');
const moment = require('moment');
const fs = require('fs');

const COLLECTION_NAME = 'courses';
const BOT_TOKEN = process.env.BOT_TOKEN;
const FILES_DIR = process.env.FILES_DIR;
const USE_REPEATING_PAYMENTS = process.env.USE_REPEATING_PAYMENTS === '1';
const telegram = new Telegram(BOT_TOKEN);
const globalState = new State();

module.exports = class Plumcore {
    constructor(profileManager) {
        this.profileManager = profileManager;
    }

    async categoriesList() {
        const db = await getDb();
        const categories = db.collection('categories');
        return categories.find({}).toArray();
    }

    async discoverAtIndex(categoryIds, profile, index, searchType) {
        let favoriteIds = profile.favorite || [];
        let ownedIds = profile.owned
            ? profile.owned.map(owned => owned.id) || []
            : [];

        let db = await getDb();

        let filter = {'deleted': {$in: [null, false]}};
        if (categoryIds && categoryIds.length > 0) {
            filter["categories"] = {$in: categoryIds};
        }

        let items;
        if (searchType === 'favorite') {
            items = await db.collection(COLLECTION_NAME).find({id: {$in: favoriteIds}}).toArray();
        }
        else if (searchType === 'owned') {
            items = await db.collection(COLLECTION_NAME).find({id: {$in: ownedIds}}).toArray();
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

    hasSubscription(profile) {
        return profile.subscribed && profile.subscribedTill >= moment().unix();
    }

    hasItemAccess(item, profile) {
        let isOwned = profile.owned && profile.owned.findIndex(owned => owned.id === item.id) !== -1;
        if (isOwned) {
            return true;
        }

        return this.hasSubscription(profile);
    }

    async finishItemPayment(payment, profile) {
        let chatId = profile.chatId;
        let item = payment.item;

        await this.profileManager.addToOwnedItems(profile, item);
        globalState.add('reloadProfile', profile.userId);

        let message = `Вы успешно купили ${item.title}`;
        await telegram.sendMessage(chatId, message);
        return this.sendFiles(chatId, item);
    }

    async finishSubscriptionPayment(payment, profile) {
        let chatId = profile.chatId;
        let now = moment().unix();
        let days = payment.days;

        let nextPeriod = profile.subscribedTill > now
            ? moment.unix(profile.subscribedTill).add(days, 'day').unix()
            : moment().add(days, 'day').unix();

        let db = await getDb();
        await db.collection('profiles').updateOne({id: profile.id}, {$set: {
            subscribed: true,
            subscribedTill: nextPeriod,
            autoSubscribe: USE_REPEATING_PAYMENTS,
        }});
        globalState.add('reloadProfile', profile.userId);
        await telegram.sendMessage(chatId, `Подписка оформлена успешно! Теперь вы можете скачивать курсы`);
    }

    async finishPayment(payment, profile) {
        if (payment.type === 'subscription') {
            return this.finishSubscriptionPayment(payment, profile);
        }
        else if (payment.type === 'item') {
            return this.finishItemPayment(payment, profile);
        }
    }

    async sendFiles(chatId, item) {
        let hasFiles = item && item.files && item.files.length > 0;
        if (!hasFiles) {
            await telegram.sendMessage(chatId, "В данном курсе нет файлов!");
            return;
        }

        if (!FILES_DIR) {
            return;
        }

        let idsSaved = false;
        for (let file of item.files) {
            if (file.telegramFileId) {
                try {
                    await telegram.sendDocument(chatId, file.telegramFileId);
                }
                catch (e) {
                    let [type] = file.type.split('/');
                    if (type === 'video') {
                        await telegram.sendVideo(chatId, file.telegramFileId);
                    }
                }
            }
            else {
                let path = FILES_DIR + '/' + file.serverFile.filename;
                let stream = fs.createReadStream(path);
                let message = await telegram.sendDocument(chatId, {source: stream, filename: file.name});
                let document = message.document || message.video;
                if (document && document.file_id) {
                    file.telegramFileId = document.file_id;
                    idsSaved = true;
                }
            }
        }

        if (idsSaved) {
            let db = await getDb();
            await db.collection('courses').updateOne({id: item.id}, {$set: {files: item.files}});
        }
    }
}