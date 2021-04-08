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

module.exports = function (params) {
    const scene = new BaseScene('intro');
    const {disclaimer, getLastVisit, setLastVisit, plumcore} = params;

    const introAction = typeof (params.introAction) !== 'undefined'
        ? params.introAction
        : false;

    scene.enter(async ctx => {
        let profile = ctx.session.profile || {};
        let messageShown = ctx.session.introShown || false;
        let hasFavorites = profile && profile.favorite && profile.favorite.length > 0;
        let hasOwned = profile && profile.owned && profile.owned.length > 0;
        let hasSubscription = plumcore.hasSubscription(profile);

        if (introAction) {
            await introAction(ctx);
        }

        if (messageShown) {
            let buttons = [];
            buttons.push({code: 'list', text: 'В каталог'});

            if (!hasSubscription) {
                //buttons.push({code: 'subscribe', text: 'Подписаться'});
            }

            if (hasOwned) {
                buttons.push( {code: 'owned', text: 'Мои покупки'});
            }

            if (hasFavorites) {
                buttons.push( {code: 'favorite', text: 'В избранное'});
            }

            if (hasSubscription) {
                buttons.push({code: 'unsubscribe', text: 'Отписаться'});
            }

            return ctx.reply('Куда дальше?', menu(buttons, 1));
        }

        try {
            ctx.session.introShown = true;
            return ctx.replyWithHTML(__(disclaimer.text, disclaimer.tags), menu([{code: 'accept', text: 'Понятно'}]));
        }
        catch (e) {
        }
    });

    scene.action('subscribe', ctx => ctx.scene.enter('subscribe'));
    scene.action('unsubscribe', ctx => ctx.scene.enter('unsubscribe'));

    scene.action('accept', ctx => ctx.scene.reenter());
    scene.action('list', ctx => ctx.scene.enter('discover'));
    scene.action('owned', ctx => ctx.scene.enter('discover', {type: 'owned'}));
    scene.action('favorite', ctx => ctx.scene.enter('discover', {type: 'favorite'}));
    scene.action('new', async ctx => {
        let lastVisit = getLastVisit(ctx);
        await setLastVisit(ctx);
        return ctx.scene.enter('discover', {type: 'new', lastVisit});
    });

    return scene;
}