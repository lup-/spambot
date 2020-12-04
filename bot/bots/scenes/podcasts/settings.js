const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');

const categoryText = 'Категории для поиска. Если одновременно выбраны "Спорт" и "Технологии", то в поиске будут обе категории';

function categoryMenu(selectedCategoryIds, allCategories) {
    let buttons = allCategories.map(category => {
        let isSelected = selectedCategoryIds.indexOf(category.id) !== -1;

        return {
            code: 'category_'+category.id,
            text: isSelected ? '☑ ' + category.title : category.title,
        }
    });

    return menu(buttons, 2);
}

module.exports = function (podcastManager, profileManager) {
    const scene = new BaseScene('settings');

    scene.enter(async ctx => {
        let caterogryIds = podcastManager.getSavedCategories(ctx);
        let allCategories = await podcastManager.listCategories();

        await ctx.reply(categoryText, categoryMenu(caterogryIds, allCategories));
        return ctx.reply(
            __('После настройки нажмите', ['settings', 'save']),
            menu([{code: 'ready', text: 'Готово'}])
        );
    });

    scene.action(/category_(.*)/, async ctx => {
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
            await ctx.editMessageText(categoryText, categoryMenu(categoryIds, allCategories));
        }
        catch (e) {}

        return;
    });

    scene.action('ready', async ctx => {
        if (ctx.session.profile) {
            ctx.session.profile.category = ctx.session.category;
            await profileManager.saveProfile(ctx.session.profile);
        }
        return ctx.scene.enter('discover');
    });

    return scene;
}