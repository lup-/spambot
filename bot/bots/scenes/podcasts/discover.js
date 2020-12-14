const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {truncateString} = require('../../../modules/Helpers');
const {__} = require('../../../modules/Messages');

const EMPTY_FILE_ID = 'AgACAgIAAxkDAAIF3V-0xDwAAZxgtMPCLuAv-dYMDWkVvAACZbAxG68woEnFDINlmSGWEGdyGZguAAMBAAMCAANtAAMFLQMAAR4E';

function podcastMenu({hasPrev, hasNext, totalPodcasts}) {
    let buttons = [];
    if (hasPrev) {
        buttons.push({code: 'go_prev', text: '◀' });
    }

    buttons.push({code: 'volumes', text: '👂'});

    if (hasNext) {
        buttons.push({code: 'go_next', text: '▶' });
    }

    if (totalPodcasts > 1) {
        buttons.push({code: 'random', text: '🎲'});
    }

    buttons.push({code: 'settings', text: '🔧'});

    return menu(buttons, 3);
}

function noPodcastsMenu() {
    return menu([{code: 'settings', text: '🔧'}, {code: 'menu', text: '↩'}]);
}

function podcastDescription(podcast) {
    let title = podcast.title;
    let listeners = podcast.listeners_count + podcast.yandex_listeners_count;
    let overview = podcast.description;
    let category = podcast.category;
    const MAX_LEN = 1024;

    let descr = __(`<b>${title}</b>
Слушателей: ${listeners}
Тема: ${category}

${overview}`, ['content', 'podcast', 'info'], 'photo');

    return truncateString(descr, MAX_LEN);
}

async function replyWithPodcast(ctx, podcastManager, showNewMessage) {
    let currentIndex = ctx.session.index || 0;
    let categoryIds = podcastManager.getSavedCategories(ctx);

    let results = await podcastManager.getPodcastByIndex(currentIndex, categoryIds);
    if (!results) {
        ctx.session.index = 0;
        if (currentIndex === 0) {
            let emptyExtra = noPodcastsMenu();
            emptyExtra.caption = `Ничего не нашлось, попробуйте указать другие темы`;
            return ctx.replyWithPhoto(EMPTY_FILE_ID, emptyExtra)
        }
        else {
            return ctx.scene.reenter();
        }
    }

    ctx.session.hasNext = results.hasNext;
    ctx.session.totalPodcasts = results.totalPodcasts;

    let imageUrl = results.podcast.cover || false;

    let photoExtra = podcastMenu(results);
    photoExtra.parse_mode = 'html';
    photoExtra.caption = podcastDescription(results.podcast);

    let editExtra = podcastMenu(results);
    editExtra.parse_mode = 'html';

    let media = imageUrl
        ? {url: imageUrl}
        : EMPTY_FILE_ID;

    return ctx.safeReply(
        ctx => {
            return showNewMessage
                ? ctx.replyWithPhoto(media, photoExtra)
                : ctx.editMessageMedia({type: 'photo', media, caption: podcastDescription(results.podcast)}, photoExtra);
        },
        [
            ctx => ctx.replyWithPhoto(media, photoExtra),
            ctx => ctx.replyWithPhoto(EMPTY_FILE_ID, {caption: 'Ошибка загрузки данных'}, podcastMenu(results)),
        ],
        ctx);
}

module.exports = function (podcastManager) {
    const scene = new BaseScene('discover');

    scene.enter(async ctx => {
        let fromNav = typeof (ctx.session.nav) === 'boolean' ? ctx.session.nav : false;
        let showNewMessage = !fromNav;
        ctx.session.index = ctx.session.index || 0;

        return replyWithPodcast(ctx, podcastManager, showNewMessage);
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
        let maxNum = ctx.session.totalPodcasts-1;

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

    scene.action('volumes', ctx => {
        ctx.session.nav = false;
        return ctx.scene.enter('volumes');
    });

    scene.action('settings', ctx => {
        ctx.session.index = 0;
        ctx.session.nav = false;
        return ctx.scene.enter('settings');
    });

    return scene;
}