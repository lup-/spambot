const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');

const EMPTY_FILE_ID = 'AgACAgIAAxkDAAIF3V-0xDwAAZxgtMPCLuAv-dYMDWkVvAACZbAxG68woEnFDINlmSGWEGdyGZguAAMBAAMCAANtAAMFLQMAAR4E';

function itemMenu({hasPrev, hasNext, totalItems, isFavorite, item}, hasSubmenu, action) {
    let buttons = [];

    buttons.push(hasPrev
        ? {code: 'go_prev', text: '◀' }
        : {code: '_skip', text: '➖' }
    );

    buttons.push(action.button);
    buttons.push({code: 'favourite', text: isFavorite ? '☑ ⭐' : '⭐'});

    buttons.push(hasNext
        ? {code: 'go_next', text: '▶' }
        : {code: '_skip', text: '➖' }
    );

    buttons.push(totalItems > 1
        ? {code: 'random', text: '🎲'}
        : {code: '_skip', text: '➖' }
    );

    buttons.push(hasSubmenu
        ? {code: 'menu', text: '↩'}
        : {code: '_skip', text: '➖' }
    );

    buttons.push({code: 'settings', text: '🔧'});

    return menu(buttons, 4);
}
function noItemsMenu() {
    return menu([{code: 'settings', text: '🔧'}, {code: 'menu', text: '↩'}]);
}
async function replyWithItem(ctx, showNewMessage, {getItemAtIndex, getEmptyText, getItemDescription, getItemImage, getAction}) {
    let currentIndex = ctx.session.index || 0;
    let favorites = ctx.session.profile.favorite || [];
    let category = ctx.session.profile.category || [];

    let results = await getItemAtIndex(currentIndex, ctx);
    let hasResults = results && results.item;
    if (!hasResults) {
        ctx.session.index = 0;
        if (currentIndex === 0) {
            let emptyExtra = noItemsMenu();
            emptyExtra.caption = getEmptyText(ctx);
            return ctx.replyWithPhoto(EMPTY_FILE_ID, emptyExtra)
        }
        else {
            return ctx.scene.reenter();
        }
    }

    ctx.session.hasNext = results.hasNext;
    ctx.session.totalItems = results.totalItems;

    let imageUrl = getItemImage(results.item) || false;
    let action = await getAction(ctx);
    let hasSubmenu = favorites.length > 0 || category.length > 0;

    let photoExtra = itemMenu(results, hasSubmenu, action);
    photoExtra.parse_mode = 'html';
    photoExtra.caption = getItemDescription(results.item);

    let editExtra = itemMenu(results, hasSubmenu, action);
    editExtra.parse_mode = 'html';

    let media = imageUrl
        ? {url: imageUrl}
        : EMPTY_FILE_ID;

    return ctx.safeReply(
        ctx => {
            return showNewMessage
                ? ctx.replyWithPhoto(media, photoExtra)
                : ctx.editMessageMedia({type: 'photo', media, caption: getItemDescription(results.item)}, photoExtra);
        },
        [
            ctx => ctx.replyWithPhoto(media, photoExtra),
            ctx => ctx.replyWithPhoto(EMPTY_FILE_ID, {caption: 'Ошибка загрузки данных'}, itemMenu(results, hasSubmenu, action)),
        ],
        ctx);
}

module.exports = function (params) {
    const scene = new BaseScene('discover');
    const {getAction, toggleFavorite, getItemAtIndex} = params;

    scene.enter(async ctx => {
        let fromNav = typeof (ctx.session.nav) === 'boolean' ? ctx.session.nav : false;
        let showNewMessage = !fromNav;
        ctx.session.index = ctx.session.index || 0;

        return replyWithItem(ctx, showNewMessage, params);
    });

    scene.action('go_prev', ctx => {
        let index = ctx.session.index || 0;
        if (index > 0) {
            index--;
        }

        ctx.session.index = index;
        ctx.session.nav = true;
        return ctx.scene.reenter();
    });

    scene.action('go_next', ctx => {
        let hasNext = ctx.session.hasNext;

        let index = ctx.session.index || 0;
        if (hasNext) {
            index++;
        }

        ctx.session.index = index;
        ctx.session.nav = true;
        return ctx.scene.reenter();
    });

    scene.action('random', ctx => {
        let maxNum = ctx.session.totalItems-1;

        let index = ctx.session.index || 0;
        let randomIndex = false;
        let retries = 0;
        let maxRetries = 5;

        do {
            retries++;
            randomIndex = maxNum
                ? Math.floor(Math.random() * maxNum)
                : 0;
        }
        while (maxNum > 0 && index === randomIndex && retries < maxRetries)

        if (ctx.session.index === randomIndex) {
            return;
        }
        else {
            ctx.session.index = randomIndex;
            ctx.session.nav = true;
            return ctx.scene.reenter();
        }
    });

    scene.action('action', async ctx => {
        let currentIndex = ctx.session.index || 0;
        let {item} = await getItemAtIndex(currentIndex, ctx);

        let action = await getAction(ctx);
        return action.route(item, ctx);
    });

    scene.action('settings', ctx => {
        ctx.session.index = 0;
        ctx.session.nav = false;
        return ctx.scene.enter('settings');
    });

    scene.action('menu', ctx => {
        ctx.session.index = 0;
        ctx.session.nav = false;
        return ctx.scene.enter('intro');
    });

    scene.action('favourite', async ctx => {
        let currentIndex = ctx.session.index || 0;
        let {item} = await getItemAtIndex(currentIndex, ctx);

        await toggleFavorite(item, ctx);

        ctx.session.nav = true;
        return ctx.scene.reenter();
    });

    scene.action('_skip', ctx => {});

    return scene;
}