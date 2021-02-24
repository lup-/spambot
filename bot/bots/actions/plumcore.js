const {init} = require('../../managers');
const {__} = require('../../modules/Messages');
const moment = require('moment');
const {Telegram} = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const telegram = new Telegram(BOT_TOKEN);

let plumcore = init('plumcore');
let profileManager = init('profile');
let payment = init('payment');

function toggleFavorite(item, ctx) {
    return profileManager.toggleInFavourites(ctx.session.profile, item);
}

async function getAction() {
    return {button: {code: 'action', text: 'Оплатить'},
        route: async (item, ctx) => {
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
    let favoriteIds = ctx.session.profile.favorite || [];

    return plumcore.discoverAtIndex(categoryIds, favoriteIds, currentIndex, searchType);
}

function getEmptyText() {
    return `Похоже тут пока что ничего нет. 

Попробуйте задать другие категории для поиска.`;
}

function getSettingsText() {
    return `Выберите основные категории для поиска.

Если вы ставите две и более - контент из каждой будет показываться при пролистывании курсов.`;
}

function getItemDescription(item) {
    return __(`<b>${item.title}</b>

${item.description || ''}`, ['content', 'course', 'learn']);
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

async function onSuccessfulPayment(payment, profile) {
    let chatId = profile.chatId;
    let item = payment.item;

    let message = `Вы успешно купили ${item.title}`;
    return telegram.sendMessage(chatId, message);
}

module.exports = {
    disclaimer: {text: `Добро пожаловать!

Здесь желающие найдут возможность сэкономить на саморазвитии. Ну а что может быть лучше, чем стать профессионалом за умеренные деньги?

Приятного пользования!`, tags: ['content', 'intro', 'learn']},
    skipCategories: true,
    payment,
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
    onSuccessfulPayment
}