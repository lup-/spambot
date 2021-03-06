const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {markMessageToDelete} = require('../../../modules/deleteMessageMiddleware');
const EMPTY_FILE = {source: new Buffer('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')};

function markCatalogMessage(ctx, message) {
    if (ctx.session) {
        ctx.session.catalogMessage = message;
    }

    return message;
}

function itemMenu({hasPrev, hasNext, totalItems, isFavorite, item}, hasSubmenu, action, hasFavorite = true, hasRandom = true) {
    let buttons = [];

    buttons.push(hasPrev
        ? {code: 'go_prev', text: '◀' }
        : {code: '_skip', text: '➖' }
    );

    buttons.push(action.button);
    if (hasFavorite) {
        buttons.push({code: 'favourite', text: isFavorite ? '☑ ⭐' : '⭐'});
    }

    buttons.push(hasNext
        ? {code: 'go_next', text: '▶' }
        : {code: '_skip', text: '➖' }
    );

    if (hasRandom) {
        buttons.push(totalItems > 1
            ? {code: 'random', text: '🎲'}
            : {code: '_skip', text: '➖'}
        );
    }

    buttons.push(hasSubmenu
        ? {code: 'menu', text: '↩'}
        : {code: '_skip', text: '➖' }
    );

    buttons.push({code: 'settings', text: '🔧'});

    return menu(buttons, hasFavorite ? 4 : 3);
}
function noItemsMenu() {
    return menu([{code: 'settings', text: '🔧'}, {code: 'menu', text: '↩'}]);
}

function dataUriToBuffer(uri) {
    let data = uri.split(',')[1];
    return Buffer.from(data,'base64');
}

async function replyWithItem(ctx, showNewMessage, withPhoto, params) {
    let {getItemAtIndex, getEmptyText, getItemDescription, getItemImage, getAction, checkSubmenu} = params;

    const hasFavorite = typeof (params.hasFavorite) !== 'undefined'
        ? params.hasFavorite
        : true;

    const hasRandom = typeof (params.hasRandom) !== 'undefined'
        ? params.hasRandom
        : true;

    let currentIndex = ctx.session.index || 0;
    let favorites = ctx.session.profile.favorite || [];
    let category = ctx.session.profile.category || [];
    let catalogMessage = false;

    let results = await getItemAtIndex(currentIndex, ctx);
    let hasResults = results && results.item;
    if (!hasResults) {
        ctx.session.index = 0;
        if (currentIndex === 0) {
            let emptyExtra = noItemsMenu();
            let text = getEmptyText(ctx);
            emptyExtra.caption = text;
            let message = withPhoto
                ? ctx.replyWithPhoto(EMPTY_FILE, emptyExtra)
                : ctx.replyWithHTML(text, noItemsMenu());
            return markCatalogMessage(message);
        }
        else {
            return ctx.scene.reenter();
        }
    }

    ctx.session.hasNext = results.hasNext;
    ctx.session.totalItems = results.totalItems;

    let image = getItemImage(results.item) || false;
    let imageUrl = typeof (image) === 'string' ? image : false;
    let imageSrc = image && image.src ?  image.src : false;
    let action = await getAction(ctx, results.item);

    let hasSubmenu = true;
    if (checkSubmenu) {
        hasSubmenu = checkSubmenu(ctx);
    }
    else {
        hasSubmenu = hasFavorite
            ? favorites.length > 0 || category.length > 0
            : true;
    }

    let itemText = getItemDescription(results.item);
    let messageMenu = itemMenu(results, hasSubmenu, action, hasFavorite, hasRandom);
    let photoExtra = itemMenu(results, hasSubmenu, action, hasFavorite, hasRandom);
    photoExtra.parse_mode = 'html';
    photoExtra.caption = itemText;

    let editExtra = itemMenu(results, hasSubmenu, action, hasFavorite, hasRandom);
    editExtra.parse_mode = 'html';

    let media = EMPTY_FILE;

    if (imageUrl) {
        media = {url: imageUrl};
    }

    if (imageSrc) {
        media = {source: dataUriToBuffer(imageSrc)};
    }

    if (withPhoto) {
        catalogMessage = await ctx.safeReply(
            ctx => {
                return showNewMessage
                    ? ctx.replyWithPhoto(media, photoExtra)
                    : ctx.editMessageMedia({
                        type: 'photo',
                        media,
                        caption: getItemDescription(results.item)
                    }, photoExtra);
            },
            [
                ctx => ctx.replyWithPhoto(media, photoExtra),
                ctx => ctx.replyWithPhoto(EMPTY_FILE_ID, {caption: 'Ошибка загрузки данных'}, itemMenu(results, hasSubmenu, action, hasFavorite, hasRandom)),
            ],
            ctx);
    }
    else {
        catalogMessage = await ctx.safeReply(
            ctx => {
                return showNewMessage
                    ? ctx.replyWithHTML(itemText, messageMenu)
                    : ctx.editMessageText(itemText, editExtra);
            },
            ctx => ctx.replyWithHTML(itemText, messageMenu),
            ctx);
    }

    return markCatalogMessage(ctx, catalogMessage);
}

module.exports = function (params) {
    const scene = new BaseScene('discover');
    const {getAction, toggleFavorite, getItemAtIndex} = params;

    const withPhoto = typeof (params.withPhoto) !== 'undefined'
        ? params.withPhoto
        : true;

    const additionalActions = typeof (params.additionalActions) !== 'undefined'
        ? params.additionalActions
        : false;

    const discoverAction = typeof (params.discoverAction) !== 'undefined'
        ? params.discoverAction
        : false;

    scene.enter(async ctx => {
        let fromNav = typeof (ctx.session.nav) === 'boolean' ? ctx.session.nav : false;
        let showNewMessage = !fromNav;
        ctx.session.index = ctx.session.index || 0;

        if (discoverAction) {
            await discoverAction(ctx);
        }

        return replyWithItem(ctx, showNewMessage, withPhoto, params);
    });

    scene.start(ctx => ctx.scene.enter('intro'));
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

        let action = await getAction(ctx, item);
        return action.route(item, ctx);
    });

    scene.action('settings', ctx => {
        ctx.session.index = 0;
        ctx.session.nav = false;
        if (ctx.session.catalogMessage) {
            markMessageToDelete(ctx, ctx.session.catalogMessage);
            ctx.session.catalogMessage = false;
        }

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

    if (additionalActions) {
        for (const action of additionalActions) {
            scene.action(action.code, action.callback);
        }
    }

    return scene;
}