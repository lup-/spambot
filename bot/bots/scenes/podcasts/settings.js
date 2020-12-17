const BaseScene = require('telegraf/scenes/base');
const {menu, menuWithControls} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');

const categoryText = `Выберите интересующие вас категории для поиска.

Если выбрать одновременно например "Спорт" и "Технологии", то в поиске будут обе категории.

Если ничего не выбирать и нажать "Дальше", вы получите весь список подкастов.`;

const sortText = `Выберите как вы хотите сортировать подкасты. Одновременно может быть выбран только один способ сортировки.

Чтобы поменять сортировку, нажмите`;

function categoryMenu(selectedCategoryIds, allCategories, routeType) {
    let buttons = allCategories.map(category => {
        let isSelected = selectedCategoryIds.indexOf(category.id) !== -1;

        return {
            code: 'category_'+category.id,
            text: isSelected ? '☑ ' + category.title : category.title,
        }
    });

    let controls = routeType === 'category'
        ? [{code: 'ready', text: 'Готово'}]
        : [{code: 'sort', text: 'Дальше'}]


    return menuWithControls(buttons, 2, controls);
}
function sortMenu(currentSort) {
    let currentSortDir = currentSort && currentSort.listeners
        ? currentSort.listeners
        : false;

    let controls = [{code: 'ready', text: 'Готово'}];

    return menuWithControls([
        {code: 'sort/listeners/-1', text: (currentSortDir === -1 ? '☑ ' : '') + 'Сначала популярные'},
        {code: 'sort/listeners/0', text: (currentSortDir === 0 ? '☑ ' : '') + 'Без сортировки'},
        {code: 'sort/listeners/1', text: (currentSortDir === 1 ? '☑ ' : '') + 'Сначала неизвестные'},
    ], 1, controls)
}

module.exports = function (podcastManager, profileManager) {
    const scene = new BaseScene('settings');

    scene.enter(async ctx => {
        let routeType = ctx.scene.state.route || false;
        if (routeType === 'sort') {
            let sort = ctx.session.profile.sort || {};
            ctx.session.sort = sort;

            return ctx.reply(sortText, sortMenu(sort));
        }

        let caterogryIds = podcastManager.getSavedCategories(ctx);
        let allCategories = await podcastManager.listCategories();

        return ctx.reply(categoryText, categoryMenu(caterogryIds, allCategories, routeType));
    });

    scene.action(/category_(.*)/, async ctx => {
        let routeType = ctx.scene.state.route || false;
        if (!ctx.session) {
            return ctx.scene.enter('discover');
        }

        let newCategoryId = ctx.match[1] ? parseInt(ctx.match[1]) : false;
        if (typeof (newCategoryId) !== 'number') {
            return;
        }

        let categoryIds = podcastManager.getSavedCategories(ctx);
        let selectedIndex = categoryIds.indexOf(newCategoryId);
        if (selectedIndex === -1) {
            categoryIds.push(newCategoryId);
        }
        else {
            categoryIds.splice(selectedIndex, 1);
        }

        ctx.session.category = categoryIds;
        let allCategories = await podcastManager.listCategories();

        try {
            await ctx.editMessageText(categoryText, categoryMenu(categoryIds, allCategories, routeType));
        }
        catch (e) {}

        return;
    });

    scene.action('sort', async ctx => {
        let sort = ctx.session.profile.sort || {};
        ctx.session.sort = sort;

        return ctx.editMessageText(sortText, sortMenu(sort));
    });

    scene.action(/sort\/(.*?)\/(.*)$/i, async ctx => {
        let [ ,field, dir] = ctx.match;
        let sort = ctx.session.sort || {};
        sort[field] = parseInt(dir);
        ctx.session.sort = sort;

        return ctx.editMessageText(sortText, sortMenu(sort));
    });

    scene.action('ready', async ctx => {
        if (ctx.session.profile) {
            ctx.session.profile.sort = ctx.session.sort;
            ctx.session.profile.category = ctx.session.category || [];
            await profileManager.saveProfile(ctx.session.profile);
        }
        return ctx.scene.enter('discover');
    });

    return scene;
}