const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {truncateString} = require('../../../modules/Helpers');

const EMPTY_FILE_ID = 'AgACAgIAAxkDAAIF3V-0xDwAAZxgtMPCLuAv-dYMDWkVvAACZbAxG68woEnFDINlmSGWEGdyGZguAAMBAAMCAANtAAMFLQMAAR4E';

function filmMenu({hasPrev, hasNext, totalFilms}) {
    let buttons = [];
    if (hasPrev) {
        buttons.push({code: 'go_prev', text: '◀' });
    }

    buttons.push({code: 'like', text: '👍'});

    if (hasNext) {
        buttons.push({code: 'go_next', text: '▶' });
    }

    if (totalFilms > 1) {
        buttons.push({code: 'random', text: '🎲'});
    }

    buttons.push({code: 'settings', text: '🔧'});
    buttons.push({code: 'menu', text: '↩'});

    return menu(buttons, 3);
}

function noFilmsMenu() {
    return menu([{code: 'settings', text: '🔧'}, {code: 'menu', text: '↩'}]);
}

function filmDescription(film) {
    let title = film.title ? film.title : film.name;
    let vote = film.vote_average;
    let overview = film.overview;
    let genres = film.genre.join(', ');
    const MAX_LEN = 1024;

    let descr = `<b>${title}</b>
Рейтинг: ${vote}/10
Жанры: ${genres}

${overview}`;

    return truncateString(descr, MAX_LEN);
}

async function replyWithFilm(ctx, filmManager, showNewMessage) {
    let searchType = ctx.session.searchType || 'tv';
    let currentIndex = ctx.session.index || 0;
    let genreIds = filmManager.getSessionGenres(ctx.session);

    let results = await filmManager.discoverAtIndex(searchType, genreIds, currentIndex);
    if (!results) {
        ctx.session.index = 0;
        if (currentIndex === 0) {
            let emptyExtra = noFilmsMenu();
            emptyExtra.caption = `Ничего не нашлось, попробуйте указать другие жанры`;
            return ctx.replyWithPhoto(EMPTY_FILE_ID, emptyExtra)
        }
        else {
            return ctx.scene.reenter();
        }
    }

    ctx.session.hasNext = results.hasNext;
    ctx.session.totalFilms = results.totalFilms;

    let imageUrl = results.film && results.film.poster_path
        ? 'https://image.tmdb.org/t/p/w500/'+results.film.poster_path
        : false;

    let photoExtra = filmMenu(results);
    photoExtra.parse_mode = 'html';
    photoExtra.caption = filmDescription(results.film);

    let editExtra = filmMenu(results);
    editExtra.parse_mode = 'html';

    let media = imageUrl
        ? {url: imageUrl}
        : EMPTY_FILE_ID;

    return showNewMessage
        ? ctx.replyWithPhoto(media, photoExtra)
        : ctx.editMessageMedia({type: 'photo', media, caption: filmDescription(results.film)}, photoExtra);

}

module.exports = function (filmManager) {
    const scene = new BaseScene('discover');

    scene.enter(async ctx => {
        let fromNav = typeof (ctx.session.nav) === 'boolean' ? ctx.session.nav : false;
        let showNewMessage = !fromNav;

        return replyWithFilm(ctx, filmManager, showNewMessage);
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
        let maxNum = ctx.session.totalFilms-1;

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
        return ctx.scene.enter('searchMenu');
    });

    scene.action('like', async ctx => {
        let searchType = ctx.session.searchType || 'tv';
        let currentIndex = ctx.session.index || 0;
        let genreIds = filmManager.getSessionGenres(ctx.session);

        let {film} = await filmManager.discoverAtIndex(searchType, genreIds, currentIndex);

        ctx.session.nav = false;
        await filmManager.saveLike(ctx.session.userId, ctx.session.chatId, film);

        return ctx.scene.reenter();
    });

    scene.action('settings', ctx => {
        ctx.session.index = 0;
        ctx.session.nav = false;
        return ctx.scene.enter('settings');
    });

    return scene;
}