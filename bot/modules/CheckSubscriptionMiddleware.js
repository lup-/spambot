const {getDb} = require('./Database');
const Telegram = require('telegraf/telegram');
const {wait, eventLoopQueue} = require('./Helpers');
const BOT_TOKEN = process.env.BOT_TOKEN;
const tg = new Telegram(BOT_TOKEN);

const MAX_WAIT_TIMEOUT_SEC = 5 * 60;

async function checkSubscribe(tg, chat, userId) {
    let subscriber = await tg.getChatMember(chat, userId);
    let isSubscriber = subscriber && subscriber.status && ["creator", "administrator", "member"].indexOf(subscriber.status) !== -1;
    return isSubscriber;
}

async function waitForSubscription(tg, chat, userId) {
    let timeout = MAX_WAIT_TIMEOUT_SEC * 1000;
    let checkStepTime = 1000;

    return new Promise(resolve => {
        let checkIntervalId;
        let doCheck = async () => {
            console.log(`Check: ${userId}`); //
            let isSubscriber = await checkSubscribe(tg, chat, userId);
            if (isSubscriber) {
                console.log(`Clearing: ${userId}`); //
                clearInterval(checkIntervalId);
                resolve(isSubscriber);
            }
        };

        checkIntervalId = setInterval(doCheck, checkStepTime);
        doCheck();

        setTimeout(async () => {
            clearInterval(checkIntervalId);
            let isSubscriber = await checkSubscribe(tg, chat, userId);
            resolve(isSubscriber);
        }, timeout);
    });
}

module.exports = async (ctx, next) => {
    let skipThisUpdate = ctx.chat.type !== 'private';
    if (skipThisUpdate) {
        return next();
    }

    if (ctx && ctx.session && ctx.session.delaySubscribeCheck) {
        return next();
    }

    if (ctx && ctx.session && ctx.session.subscribtionSuccess) {
        return next();
    }

    let botName = process.env.BOT_NAME;
    let db = await getDb('botofarmer');
    let settings = db.collection('botSettings');
    let botSettings = await settings.findOne({botName});
    let needsSubscription = botSettings && botSettings.needsSubscription && botSettings.needsSubscription.length > 0;

    if (needsSubscription) {
        let chatUsername = botSettings.needsSubscription;
        let userId = ctx.from ? ctx.from.id : false;

        let isSubscriber = false;

        if (userId) {
            try {
                isSubscriber = await checkSubscribe(ctx.tg, chatUsername, userId);
            }
            catch (e) {
                isSubscriber = true;
            }
        }

        if (!isSubscriber) {
            console.log(`Need: ${userId}`); //
            let chatId = ctx.chat.id;
            setTimeout(async () => {
                try {
                    console.log(`Reply: ${userId} ${chatId}`); //
                    await tg.sendMessage(chatId,'Сначала необходимо подписаться на '+chatUsername);
                    isSubscriber = await waitForSubscription(ctx.tg, chatUsername, userId);
                    if (isSubscriber) {
                        console.log(`OK: ${userId}`); //
                        await tg.sendMessage(chatId,'Спасибо, что подписались! Продолжаю работу...');
                        return next();
                    }
                }
                catch (e) {
                    console.log(e); //
                }
            }, 0);
            return;
        }
    }

    if (ctx.session) {
        ctx.session.subscribtionSuccess = true;
    }

    return next();
}