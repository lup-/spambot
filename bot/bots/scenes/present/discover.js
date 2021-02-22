const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {truncateString} = require('../../../modules/Helpers');
const {__} = require('../../../modules/Messages');

const EMPTY_FILE_ID = 'AgACAgIAAxkDAAIF3V-0xDwAAZxgtMPCLuAv-dYMDWkVvAACZbAxG68woEnFDINlmSGWEGdyGZguAAMBAAMCAANtAAMFLQMAAR4E';

function presentMenu({hasPrev, hasNext, totalPresents}) {
    let buttons = [];

    if (hasPrev) {
        buttons.push({code: 'go_prev', text: '◀' });
    }

    buttons.push({code: 'like', text: '👍'});

    if (hasNext) {
        buttons.push({code: 'go_next', text: '▶' });
    }

    if (totalPresents > 1) {
        buttons.push({code: 'random', text: '🎲'});
    }

    buttons.push({code: 'menu', text: '↩'});

    return menu(buttons, 3);
}

function noPresentsMenu() {
    return menu([{code: 'settings', text: '🔧'}, {code: 'menu', text: '↩'}]);
}

function presentDescription(present) {
    let title = present.name;
    let overview = present.description;
    let approxPrice = present.price > 1000
        ? Math.round(present.price / 1000) * 1000
        : Math.round(present.price / 100) * 100;

    const MAX_LEN = 1024;

    let descr = __(`<b>${title}</b>
Примерная цена: ${approxPrice} руб

${overview}`, ['content', 'info', 'goods'], 'photo');

    return truncateString(descr, MAX_LEN);
}

async function replyWithPresent(ctx, presentManager, showNewMessage) {
    let category = ctx.session.category;
    let currentIndex = ctx.session.index || 0;

    let results = await presentManager.discoverAtIndex(category, currentIndex);
    if (!results) {
        ctx.session.index = 0;
        if (currentIndex === 0) {
            let emptyExtra = noPresentsMenu();
            emptyExtra.caption = `Ничего не нашлось, попробуйте посмотреть другие категории`;
            return ctx.replyWithPhoto(EMPTY_FILE_ID, emptyExtra)
        }
        else {
            return ctx.scene.reenter();
        }
    }

    ctx.session.hasNext = results.hasNext;
    ctx.session.totalPresents = results.totalPresents;

    let imageUrl = results.present && results.present.image
        ? results.present.image
        : false;

    let photoExtra = presentMenu(results);
    photoExtra.parse_mode = 'html';
    photoExtra.caption = presentDescription(results.present);

    let editExtra = presentMenu(results);
    editExtra.parse_mode = 'html';

    let media = false;

    if (results.present && results.present.imageId) {
        media = results.present.imageId;
    }

    if (!media && imageUrl) {
        media = {url: imageUrl};
    }

    if (!media) {
        media = EMPTY_FILE_ID;
    }


    let result = showNewMessage
        ? await ctx.replyWithPhoto(media, photoExtra)
        : await ctx.editMessageMedia({type: 'photo', media, caption: presentDescription(results.present)}, photoExtra);

    if (!results.present.imageId) {
        await presentManager.saveImageId(results.present, result);
    }

    return result;
}

module.exports = function (presentManager) {
    const scene = new BaseScene('discover');

    scene.enter(async ctx => {
        let fromNav = typeof (ctx.session.nav) === 'boolean' ? ctx.session.nav : false;
        let showNewMessage = !fromNav;

        return replyWithPresent(ctx, presentManager, showNewMessage);
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
        let maxNum = ctx.session.totalPresents-1;

        let index = ctx.session.index || 0;
        let randomIndex = false;

        do {
            randomIndex = maxNum
                ? Math.floor(Math.random() * maxNum)
                : 0;
        } while (maxNum > 0 && index === randomIndex)

        if (ctx.session.index === randomIndex) {
            return;
        }
        else {
            ctx.session.index = randomIndex;
            ctx.session.nav = true;
            return ctx.scene.reenter();
        }
    });

    scene.action('menu', ctx => {
        ctx.session.index = 0;
        ctx.session.nav = false;
        return ctx.scene.enter('categoryMenu');
    });

    scene.action('like', async ctx => {
        let category = ctx.session.category;
        let currentIndex = ctx.session.index || 0;
        let {present} = await presentManager.discoverAtIndex(category, currentIndex);

        ctx.session.nav = false;
        await presentManager.saveLike(ctx.session.userId, ctx.session.chatId, present);

        return ctx.scene.reenter();
    });

    scene.action('settings', ctx => {
        ctx.session.index = 0;
        ctx.session.nav = false;
        return ctx.scene.enter('categoryMenu');
    });

    return scene;
}