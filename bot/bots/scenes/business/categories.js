const BaseScene = require('telegraf/scenes/base');
const {menuWithControls} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');

const categoryText = 'Выбирайте одну или несколько интересных тем, а потом жмите "Готово"';

async function categoryMenu(type, selectedCategoryIds, business, pageIndex = 0) {
    let categories = await business.getCategories(type);
    let MAX_ITEMS_PER_PAGE = 10;
    let showPagination = categories.length > MAX_ITEMS_PER_PAGE;

    let pageCategories = showPagination
        ? categories.splice(pageIndex * MAX_ITEMS_PER_PAGE, MAX_ITEMS_PER_PAGE)
        : categories;

    let maxPageIndex = Math.floor(categories.length / MAX_ITEMS_PER_PAGE);
    if (maxPageIndex * MAX_ITEMS_PER_PAGE < categories.length) {
        maxPageIndex+=1;
    }

    let prevPageIndex = pageIndex > 0 ? pageIndex-1 : pageIndex;
    let nextPageIndex = pageIndex < maxPageIndex ? pageIndex+1 : pageIndex;

    let categoryButtons = pageCategories.map(category => {
        let isSelected = selectedCategoryIds.indexOf(category.id) !== -1;

        return {
            code: `category/${type}/page/${pageIndex}/${category.id}`,
            text: isSelected ? '☑ ' + category.title : category.title,
        }
    });

    let controlButtons = showPagination
        ? [
            {code: `category/${type}/page/${prevPageIndex}`, text: prevPageIndex !== pageIndex ? '◀' : '➖'},
            {code: 'next', text: 'Готово'},
            {code: `category/${type}/page/${nextPageIndex}`, text: nextPageIndex !== pageIndex ? '▶': '➖'}]
        : [{code: 'next', text: 'Готово'}];

    return menuWithControls(categoryButtons, 1, controlButtons);
}

module.exports = function (business, profile) {
    const scene = new BaseScene('categories');

    scene.enter(async ctx => {
        let type = ctx.scene.state.type || 'bm';
        let selectedIds = business.getSelectedCategories(ctx.session.profile, type) || [];

        return ctx.replyWithHTML(__(categoryText, ['settings', 'categories', 'menu']), await categoryMenu(type, selectedIds, business));
    });

    scene.action(/^category\/([^\/]+)\/page\/(\d+)\/([^\/]+)$/, async ctx => {
        let [, type, page, categoryId] = ctx.match;
        let pageIndex = parseInt(page) || 0;

        ctx.session.profile = await business.toggleCategory(ctx.session.profile, type, categoryId, profile);
        let selectedIds = business.getSelectedCategories(ctx.session.profile, type);

        try {
            await ctx.editMessageText(categoryText, await categoryMenu(type, selectedIds, business, pageIndex));
        }
        catch (e) {
            console.log(e);
        }

        return;
    });

    scene.action(/^category\/([^\/]+)\/page\/(\d+)$/, async ctx => {
        let [, type, page] = ctx.match;
        let pageIndex = parseInt(page) || 0;

        let selectedIds = business.getSelectedCategories(ctx.session.profile, type) || [];
        let menu = await categoryMenu(type, selectedIds, business, pageIndex);
        menu.parse_mode = 'HTML';

        try {
            await ctx.editMessageText(__(categoryText, ['settings', 'categories', 'menu']), menu);
        }
        catch (e) {
            console.log(e);
        }

        return;
    });

    scene.action('next', async ctx => {
        let type = ctx.scene.state.type;
        let selectedIds = business.getSelectedCategories(ctx.session.profile, type);
        if (selectedIds === false) {
            if (!ctx.session.profile.categories) {
                ctx.session.profile.categories = {bm: false, ff: false};
            }

            if (!ctx.session.profile.categories[type]) {
                ctx.session.profile.categories[type] = [];
            }

            ctx.session.profile = await profile.saveProfile(ctx.session.profile);
        }

        return ctx.scene.enter('discover', {type});
    });

    return scene;
}