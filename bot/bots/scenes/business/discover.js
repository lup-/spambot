const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {truncateString} = require('../../../modules/Helpers');
const {__} = require('../../../modules/Messages');
const moment = require('moment');

const EMPTY_FILE_ID = 'AgACAgIAAxkDAAIF3V-0xDwAAZxgtMPCLuAv-dYMDWkVvAACZbAxG68woEnFDINlmSGWEGdyGZguAAMBAAMCAANtAAMFLQMAAR4E';

function ideaMenu({hasPrev, hasNext, totalIdeas, isFavorite}) {
    let buttons = [];

    buttons.push(hasPrev
        ? {code: 'go_prev', text: '◀' }
        : {code: '_skip', text: '➖' }
    );

    buttons.push({code: 'favourite', text: isFavorite ? '☑ ⭐' : '⭐'});

    buttons.push(hasNext
        ? {code: 'go_next', text: '▶' }
        : {code: '_skip', text: '➖' }
    );

    buttons.push(totalIdeas > 1
        ? {code: 'random', text: '🎲'}
        : {code: '_skip', text: '➖' }
    );

    buttons.push({code: 'settings', text: '🔧'});
    buttons.push({code: 'menu', text: '↩'});

    return menu(buttons, 3);
}
function noIdeasMenu() {
    return menu([
        //{code: 'settings', text: '🔧'},
        {code: 'menu', text: '↩'}
    ]);
}

function ideaDescription(idea) {
    let title = idea.title;
    let subtitle = idea.subtitle ? `\n<b>idea.subtitle</b>` : '';

    const MAX_LEN = 1024;

    let descr = __(`<b>${title}</b>${subtitle}

${idea.description}

${idea.viewLink}`, ['content', 'business', 'idea', 'info'], 'photo');

    return truncateString(descr, MAX_LEN);
}
async function replyWithIdea(ctx, business, profileManager, showNewMessage) {
    let searchType = ctx.scene.state.type || 'bm';
    let currentIndex = ctx.session.index || 0;
    let profile = ctx.session.profile || {};

    let results = await business.discoverAtIndex(searchType, profile, currentIndex);

    if (searchType === 'recommendations') {
        profile.lastRecommends = moment().unix();
        await profileManager.saveProfile(profile);
    }

    if (!results) {
        ctx.session.index = 0;
        if (currentIndex === 0) {
            let emptyExtra = noIdeasMenu();
            emptyExtra.caption = `Тут ничего нет`;
            return ctx.replyWithPhoto(EMPTY_FILE_ID, emptyExtra)
        }
        else {
            return ctx.scene.reenter();
        }
    }

    ctx.session.hasNext = results.hasNext;
    ctx.session.totalIdeas = results.totalIdeas;

    let imageUrl = results.idea && results.idea.cover
        ? results.idea.cover
        : false;

    let photoExtra = ideaMenu(results);
    photoExtra.parse_mode = 'html';
    photoExtra.disable_web_page_preview = true;
    photoExtra.caption = ideaDescription(results.idea);

    let editExtra = ideaMenu(results);
    editExtra.parse_mode = 'html';
    editExtra.disable_web_page_preview = true;

    let media = imageUrl
        ? {url: imageUrl}
        : EMPTY_FILE_ID;

    return ctx.safeReply(
        ctx => {
            return showNewMessage
                ? ctx.replyWithPhoto(media, photoExtra)
                : ctx.editMessageMedia({type: 'photo', media, caption: ideaDescription(results.idea)}, photoExtra);
        },
        ctx => ctx.replyWithPhoto(EMPTY_FILE_ID, {caption: 'Ошибка загрузки данных'}, ideaMenu(results)),
        ctx);
}

module.exports = function (business, profile) {
    const scene = new BaseScene('discover');

    scene.enter(async ctx => {
        let fromNav = typeof (ctx.session.nav) === 'boolean' ? ctx.session.nav : false;
        let showNewMessage = !fromNav;

        return replyWithIdea(ctx, business, profile, showNewMessage);
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
        let maxNum = ctx.session.totalIdeas-1;

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

    scene.action('menu', ctx => {
        ctx.session.index = 0;
        ctx.session.nav = false;
        return ctx.scene.enter('menu');
    });

    scene.action('settings', ctx => {
        let type = ctx.scene.state.type;
        ctx.session.index = 0;
        ctx.session.nav = false;
        return ctx.scene.enter('categories', {type});
    });

    scene.action('favourite', async ctx => {
        let searchType = ctx.scene.state.type || 'bm';
        let currentIndex = ctx.session.index || 0;

        let {idea} = await business.discoverAtIndex(searchType, ctx.session.profile, currentIndex);

        ctx.session.profile = await business.toggleInFavourites(ctx.session.profile, idea, profile);

        return ctx.scene.reenter();
    });

    scene.action('_skip', ctx => {});

    return scene;
}