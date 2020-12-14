const BaseScene = require('telegraf/scenes/base');
const {menu, menuWithControls} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');

function hashCode(str) {
    let hash = 0;

    if (str.length === 0) {
        return hash;
    }

    for (let i = 0; i < str.length; i++) {
        let char = str.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash;
    }

    return hash.toString();
}
async function unhashTag(str, finance) {
    let tags = await finance.listTags();
    return tags.find(tag => hashCode(tag) === str);
}
async function unhashCategory(str, tag, finance) {
    let categories = await finance.listCategoriesByTag(tag);
    let category = categories.find(category => hashCode(category.title) === str);
    return category ? category.title : false;
}

const categoryText = 'Темы для подписки. Каждый день вы будете получать одну случайную статью по интересным темам.';

async function categoryMenu(tag, selectedCategoryTitles, finance, pageIndex = 0) {
    let categories = await finance.listCategoriesByTag(tag);
    let MAX_ITEMS_PER_PAGE = 7;
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
        let isSelected = selectedCategoryTitles.indexOf(category.title) !== -1;

        return {
            code: `tag/${hashCode(tag)}/page/${pageIndex}/${hashCode(category.title)}`,
            text: isSelected ? '☑ ' + category.title : category.title,
        }
    });

    let controlButtons = showPagination
        ? [
            {code: `tag/${hashCode(tag)}/page/${prevPageIndex}`, text: prevPageIndex !== pageIndex ? '◀' : '-'},
            {code: 'back', text: 'Назад'},
            {code: `tag/${hashCode(tag)}/page/${nextPageIndex}`, text: nextPageIndex !== pageIndex ? '▶': '-'}]
        : [{code: 'back', text: 'Назад'}];

    return menuWithControls(categoryButtons, 1, controlButtons);
}
async function tagsMenu(selectedTags, finance, isSubscribed) {
    let tags = await finance.listTags();
    let buttons = tags.map(tag => {
        let isSelected = selectedTags.indexOf(tag) !== -1;

        return {
            code: 'tag/'+hashCode(tag)+'/page/1',
            text: isSelected ? '🔻 ' + tag : tag,
        }
    });

    let controls = isSubscribed
        ? [{code: 'unsubscribe', text: '🚫 Отписаться'}]
        : [{code: 'subscribe', text: '📨 Подписаться'}];

    return menuWithControls(buttons, 2, controls);
}

module.exports = function (finance, profile, periodic) {
    const scene = new BaseScene('settings');

    scene.enter(async ctx => {
        let selectedTags = finance.getSavedTags(ctx.session.profile || {});
        let isSubscribed = ctx.session && ctx.session.profile && ctx.session.profile.subscribed;

        return ctx.reply(__(categoryText, ['settings', 'menu']), await tagsMenu(selectedTags, finance, isSubscribed));
    });

    scene.action(/^tag\/([^\/]+)\/page\/(\d+)\/([^\/]+)$/, async ctx => {
        let [, tagHash, page, categoryTitleHash] = ctx.match;
        let tag = await unhashTag(tagHash, finance);
        let pageIndex = parseInt(page) || 0;
        let profileData = ctx.session.profile || {};
        if (!profileData.tags) {
            profileData.tags = [];
        }

        let tagDataIndex = profileData.tags.findIndex(tagData => hashCode(tagData.tag) === tagHash)
        let tagData = tagDataIndex !== -1 ? profileData.tags[tagDataIndex] : false;

        if (!tagData) {
            tagData = {tag, categories: []};
        }

        let categoryIndex = tagData.categories.findIndex(categoryTitle => hashCode(categoryTitle) === categoryTitleHash);
        let isEnabled = categoryIndex !== -1;
        if (isEnabled) {
            tagData.categories.splice(categoryIndex, 1);
        }
        else {
            let categoryTitle = await unhashCategory(categoryTitleHash, tag, finance);
            tagData.categories.push(categoryTitle);
        }

        if (tagDataIndex === -1) {
            profileData.tags.push(tagData);
        }
        else {
            profileData.tags[tagDataIndex] = tagData;
        }

        ctx.session.profile = profileData;
        let selectedCategoryTitles = finance.getSavedTagCategories(tag, profileData);

        try {
            await ctx.editMessageText(categoryText, await categoryMenu(tag, selectedCategoryTitles, finance, pageIndex));
        }
        catch (e) {
            console.log(e);
        }

        return;
    });

    scene.action(/^tag\/([^\/]+)\/page\/(\d+)$/, async ctx => {
        let [,tagHash, page] = ctx.match;
        let tag = await unhashTag(tagHash, finance);
        let pageIndex = parseInt(page) || 0;

        if (!tag) {
            return ctx.scene.reenter();
        }

        let selectedCategoryTitles = finance.getSavedTagCategories(tag, ctx.session.profile || {});
        let menu = await categoryMenu(tag, selectedCategoryTitles, finance, pageIndex);

        try {
            await ctx.editMessageText(tag, menu);
        }
        catch (e) {
            console.log(e);
        }

        return;
    });

    scene.action('back', async ctx => {
        await profile.saveProfile(ctx.session.profile);
        return ctx.scene.reenter();
    });

    scene.action('subscribe', async ctx => {
        await finance.subscribe(ctx.session.profile, periodic, profile);

        return ctx.reply(__('Вы подписались на ежедневную рассылку статей. Следующая статья будет завтра.', ['subscribe', 'info', 'success']));
    });

    scene.action('unsubscribe', async ctx => {
        ctx.session.profile.subscribed = false;
        await profile.saveProfile(ctx.session.profile);
        await finance.unsubscribe(ctx.session.profile, periodic, profile);

        return ctx.reply(
            __('Вы отписались от рассылки. Новые статьи больше не будут приходить.', ['unsubscribe', 'info']),
            menu([{text: '📨 Подписаться', code: 'subscribe'}])
        );
    });

    return scene;
}