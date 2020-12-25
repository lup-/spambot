const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
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

module.exports = function ({disclaimer, getLastVisit, setLastVisit}) {
    const scene = new BaseScene('intro');

    scene.enter(async ctx => {
        let messageShown = ctx.session.introShown || false;
        let hasFavorites = ctx.session.profile && ctx.session.profile.favorite && ctx.session.profile.favorite.length > 0;
        let hasCategories = ctx.session.profile && ctx.session.profile.category && ctx.session.profile.category.length > 0;

        if (hasFavorites || hasCategories) {
            let buttons = [];
            if (hasFavorites) {
                buttons.push( {code: 'favorite', text: 'В избранное'});
            }

            if (hasCategories) {
                buttons.push( {code: 'new', text: 'Рекомендации'});
            }

            buttons.push({code: 'list', text: 'В каталог'});

            return ctx.reply('Куда дальше?', menu(buttons));
        }

        if (messageShown) {
            return routeToNextStep(ctx);
        }

        try {
            ctx.session.introShown = true;
            return ctx.reply(__(disclaimer.text, disclaimer.tags), menu([{code: 'accept', text: 'Понятно'}]));
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