const {init} = require('../../managers');
const {__} = require('../../modules/Messages');
const moment = require('moment');

let finance = init('finance');
let profileManager = init('profile');

function toggleFavorite(item, ctx) {
    return finance.toggleInFavourites(ctx.session.profile, item, profileManager);
}

async function getAction(ctx) {
    let currentIndex = ctx.session.index || 0;
    let {item} = await getItemAtIndex(currentIndex, ctx);
    let like = await finance.getLike(ctx.session.profile, item);

    let hasLike = Boolean(like);

    return {button: (hasLike
            ? {code: '_skip', text: '➖'}
            : {code: 'action', text: '👍'}),
        route: async (item, ctx) => {
            await finance.saveLike(ctx.session.profile, item);
            return ctx.scene.reenter();
        }};
}

async function saveSettings(profile, ctx) {
    ctx.session.profile = await profileManager.saveProfile(profile);
}

function getSelectedCategoryIds(ctx) {
    return ctx.session.profile.category || [];
}

function getAllCategories() {
    return finance.listCategoriesHierarcy();
}

async function getItemAtIndex(currentIndex, ctx) {
    let searchType = ctx.scene.state.type || false;
    let lastVisit = ctx.scene.state.lastVisit || false;
    let categoryIds = getSelectedCategoryIds(ctx);
    let categories = await finance.listCategoriesByIds(categoryIds);
    let categoryTitles = categories.map(category => category.title);

    let favorite = ctx.session.profile.favorite || [];
    let profile = ctx.session.profile || {};

    return finance.discoverAtIndex(categoryTitles, favorite, currentIndex, searchType, profile, lastVisit);
}

function getEmptyText() {
    return `Похоже тут пока что ничего нет. 

Попробуйте задать другие категории для поиска.`;
}

function getSettingsText() {
    return `Выберите основные категории для поиска.

Если вы ставите две и более - контент из каждой будет показываться при пролистывании статей.`;
}

function getItemDescription(item) {
    return __(`<b>${item.title}</b>

${item.description || ''}
    
<a href="${item.link}">Читать дальше...</a>`, ['content', 'article', 'finance']);
}

function getItemImage(item) {
    return item.image ? item.image.replace('http:', 'https:') : false;
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
    disclaimer: {text: `Добро пожаловать!

Я как минимум помогу вам наладить дела с финансами, бизнесом и личной продуктивностью. А дальше - как пойдет, этим не ограничимся

Чтобы начать мною пользоваться - выберите интересующую вас категорию, в каждой из них по темам рассортированы статьи проверенные временем.

Приятного пользования!`, tags: ['content', 'intro']},
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
    setLastVisit
}