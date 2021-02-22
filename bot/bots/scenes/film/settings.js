const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {capitalize} = require('../../../modules/Helpers');
const {__} = require('../../../modules/Messages');

const genresText = 'Жанры для поиска. Если одновременно выбраны "семейный" и "комедия", то в поиске будут все "семейные комедии"';

function genresMenu(selectedGenreIds, allGenres) {
    let buttons = allGenres.map(genre => {
        let isSelected = selectedGenreIds.indexOf(genre.id) !== -1;

        return {
            code: 'genre_'+genre.id,
            text: isSelected ? '☑ ' + capitalize(genre.name) : capitalize(genre.name),
        }
    });

    return menu(buttons, true);
}

module.exports = function (filmManager) {
    const scene = new BaseScene('settings');

    scene.enter(async ctx => {
        let searchType = ctx.session.searchType || 'tv';
        let genreIds = filmManager.getSessionGenres(ctx.session);

        let allGenres = await filmManager.genresList(searchType);

        await ctx.reply(genresText, genresMenu(genreIds, allGenres));
        return ctx.replyWithHTML(
            __('После настройки нажмите', ['settings', 'save']),
            menu([{code: 'ready', text: 'Готово'}])
        );
    });

    scene.action(/genre_(.*)/, async ctx => {
        if (!ctx.session) {
            return ctx.scene.enter('mainMenu');
        }
        let newGenreId = ctx.match[1] ? parseInt(ctx.match[1]) : false;
        if (!newGenreId) {
            return;
        }

        let genreIds = filmManager.getSessionGenres(ctx.session);
        ctx.session = filmManager.updateSessionGenres(ctx.session, newGenreId);

        let searchType = ctx.session.searchType || 'tv';
        let allGenres = await filmManager.genresList(searchType);

        try {
            await ctx.editMessageText(genresText, genresMenu(genreIds, allGenres));
        }
        catch (e) {}

        return;
    });

    scene.action('ready', async ctx => {
        if (ctx.session.profile) {
            await filmManager.saveProfile(ctx.session.profile);
        }
        return ctx.scene.enter('discover');
    });

    return scene;
}