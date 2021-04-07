const {init} = require('../../managers');
const {__} = require('../../modules/Messages');
const moment = require('moment');

let profileManager = init('profile');
let plumcore = init('plumcore', profileManager);
let payment = init('payment');

function toggleFavorite(item, ctx) {
    return profileManager.toggleInFavourites(ctx.session.profile, item);
}

async function getAction(ctx, item) {
    let profile = ctx.session.profile;
    let hasAccess = plumcore.hasItemAccess(item, profile);

    return hasAccess
        ? {button: {code: 'action', text: '📥'}, route: async (item, ctx) => {
                let chatId = ctx.from.id;
                await plumcore.sendFiles(chatId, item);
                return ctx.scene.reenter();
            }}
        : {button: {code: 'action', text: '💳'}, route: async (item, ctx) => {
                return ctx.scene.enter('payment', {item});
            }};
}

async function saveSettings(profile, ctx) {
    ctx.session.profile = await profileManager.saveProfile(profile);
}

function getSelectedCategoryIds(ctx) {
    return ctx.session.profile.category || [];
}

function getAllCategories() {
    return plumcore.categoriesList();
}

async function getItemAtIndex(currentIndex, ctx) {
    let searchType = ctx.scene.state.type || false;
    let categoryIds = getSelectedCategoryIds(ctx);

    return plumcore.discoverAtIndex(categoryIds, ctx.session.profile, currentIndex, searchType);
}

function getEmptyText() {
    return `Похоже тут пока что ничего нет. 

Попробуйте задать другие категории для поиска.`;
}

function getSettingsText() {
    return `Выберите категорию курсов:`;
}

function getItemDescription(item) {
    return __(`<b>${item.title}</b>

${item.description || ''}

<b>Оригинальная цена</b>: ${item.originalPrice ? item.originalPrice+'р' : ''}
<b>Цена выжимки</b>: ${item.price}р`, ['content', 'course', 'learn']);
}

function getItemImage(item) {
    return item.photos && item.photos[0] ? item.photos[0] : false;
}

function getLastVisit(ctx) {
    return ctx && ctx.session && ctx.session.profile
        ? ctx.session.profile.lastVisit
        : false;
}

async function setLastVisit(ctx) {
    let profile = ctx.session.profile;
    profile.lastVisit = moment().unix();
    return saveSettings(profile, ctx);
}

module.exports = {
    disclaimer: {text: `Добро пожаловать в PlumCoreMarket!

Теперь вам доступны курсы с гарантированным заработком.`, tags: ['content', 'intro', 'learn']},
    skipCategories: true,
    payment,
    plumcore,
    toggleFavorite,
    getAction,
    saveSettings,
    getSelectedCategoryIds,
    getAllCategories,
    getItemAtIndex,
    getEmptyText,
    getSettingsText,
    getItemDescription,
    getItemImage,
    getLastVisit,
    setLastVisit,
    onSuccessfulPayment: plumcore.finishPayment.bind(plumcore),
    checkSubmenu() { return true; }
}