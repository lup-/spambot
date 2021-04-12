const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {markMessageToDelete} = require('../../../modules/deleteMessageMiddleware');
const {__} = require('../../../modules/Messages');

function routeToNextStep(ctx) {
    try {
        let hasPassedSettings = ctx.session && ctx.session.profile && ctx.session.profile.category;
        if (hasPassedSettings) {
            return ctx.scene.enter('discover');
        }
        else {
            return ctx.scene.enter('settings');
        }
    }
    catch (e) {}
}

module.exports = function (params) {
    const scene = new BaseScene('intro');
    const {disclaimer, getLastVisit, setLastVisit, skipCategories} = params;

    const introAction = typeof (params.introAction) !== 'undefined'
        ? params.introAction
        : false;

    scene.enter(async ctx => {
        let messageShown = ctx.session.introShown || false;
        let hasFavorites = ctx.session.profile && ctx.session.profile.favorite && ctx.session.profile.favorite.length > 0;
        let hasCategories = ctx.session.profile && ctx.session.profile.category && ctx.session.profile.category.length > 0;

        if (introAction) {
            await introAction(ctx);
        }

        if (hasFavorites || hasCategories) {
            let buttons = [];
            if (hasFavorites) {
                buttons.push( {code: 'favorite', text: 'В избранное'});
            }

            if (hasCategories && !skipCategories) {
                buttons.push( {code: 'new', text: 'Рекомендации'});
            }

            buttons.push({code: 'list', text: 'В каталог'});

            let message = await ctx.reply('Куда дальше?', menu(buttons));
            return markMessageToDelete(ctx, message);
        }

        if (messageShown) {
            return routeToNextStep(ctx);
        }

        try {
            ctx.session.introShown = true;
            return ctx.replyWithHTML(__(disclaimer.text, disclaimer.tags), menu([{code: 'accept', text: 'Понятно'}]));
        }
        catch (e) {
        }
    });

    scene.action('accept', ctx => routeToNextStep(ctx));
    scene.action('list', ctx => routeToNextStep(ctx));
    scene.action('favorite', ctx => ctx.scene.enter('discover', {type: 'favorite'}));
    scene.action('new', async ctx => {
        let lastVisit = getLastVisit(ctx);
        await setLastVisit(ctx);
        return ctx.scene.enter('discover', {type: 'new', lastVisit});
    });

    return scene;
}