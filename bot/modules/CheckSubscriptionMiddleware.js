const {getDb} = require('./Database');

module.exports = async (ctx, next) => {
    let skipThisUpdate = ctx.chat.type !== 'private';
    if (skipThisUpdate) {
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
                let subscriber = await ctx.tg.getChatMember(chatUsername, userId);
                isSubscriber = subscriber && subscriber.status && ["creator", "administrator", "member"].indexOf(subscriber.status) !== -1;
            }
            catch (e) {
                isSubscriber = true;
            }
        }

        if (!isSubscriber) {
            try {
                return ctx.reply('Сначала необходимо подписаться на '+chatUsername);
            }
            catch (e) {
                return;
            }
        }
    }

    if (ctx.session) {
        ctx.session.subscribtionSuccess = true;
    }

    return next();
}