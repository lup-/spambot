const { Telegraf } = require('telegraf');
const setupBot = require('./helpers/setup');
const {getManagerSync: manager} = require('../managers');

const BOT_TOKEN = process.env.BOT_TOKEN;

let app = new Telegraf(BOT_TOKEN);
let bus = manager('bus');
let periodic = manager('periodic');
let coupon = manager('coupon');
let profileManager = manager('profile');

let settingsParams = {
    getSettingsText() {
        return `Укажите интересные вам категории. Так игра будет интереснее`;
    },
    getSelectedCategoryIds(ctx) {
        return ctx.session.profile.category || [];
    },
    getAllCategories: coupon.getCatalogCategories.bind(coupon),
    async saveSettings(profile, ctx) {
        ctx.session.profile = await profileManager.saveProfile(profile);
    },
    settingsNextScene: 'couponMenu'
}
let disclaimer = `В этом боте 100-тни тысяч скидок и предложений. И посмотреть их все -- нереально.

Но можно испытать удачу. Правда не чаще, чем 1 раз в час: все самое сладкое нужно поберечь.

Бросайте кости и получайте лучшие скидки. Чем больше очков, тем больше скидка. За дубль -- самое сладкое.`;

function settingsOrMenu(ctx) {
    let categorySelected = ctx.session.profile && ctx.session.profile.categorySelected;
    if (categorySelected) {
        return ctx.scene.enter('couponMenu');
    }
    else {
        return ctx.scene.enter('settings');
    }
}

app = setupBot(app)
    .blockNonPrivate()
    .addPerformance()
    .addSession()
    .addSafeReply()
    .addIdsToSession()
    .addRefSave()
    .addUserSave()
    .addProfile()
    .addSaveActivity()
    .addSubscription()
    .addScene('catalog', 'settings', settingsParams)
    .addScenes('coupon', {coupon, profile: profileManager})
    .addDisclaimer(disclaimer, settingsOrMenu)
    .addDefaultRoute(settingsOrMenu, false)
    .get();

periodic.setRepeatingTask(async () => {
    await coupon.updateAllCampaigns();
    await coupon.updateAllCoupons();
    await coupon.connectNewCampaigns();
    await coupon.updateAllProducts();
}, 86400);

bus.listenCommands();
app.launch();