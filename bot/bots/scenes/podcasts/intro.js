const BaseScene = require('telegraf/scenes/base');
const {menu, menuWithControls} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');

function routeToNextStep(ctx) {
    try {
        let hasPassedSettings = ctx.session && ctx.session.profile && ctx.session.profile.category;
        if (hasPassedSettings) {
            return ctx.scene.enter('discover', {type: 'search'});
        }
        else {
            return ctx.scene.enter('settings');
        }
    }
    catch (e) {}
}

module.exports = function () {
    const scene = new BaseScene('intro');

    scene.enter(async ctx => {
        let messageShown = ctx.session.introShown || false;
        let hasFavorites = ctx.session.profile && ctx.session.profile.favorite && ctx.session.profile.favorite.length > 0;

        if (hasFavorites) {
            return ctx.reply('Куда дальше?', menu([
                {code: 'favorite', text: 'В избранное'},
                {code: 'list', text: 'В каталог'},
            ]));
        }

        if (messageShown) {
            return routeToNextStep(ctx);
        }

        try {
            ctx.session.introShown = true;
            return ctx.replyWithHTML(__(`Привет! Этот бот содержит в себе топ лучших подкастов за всё время. Он поможет найти наиболее релевантные вашим пожеланиям варианты и выдаст аудиофайл для прослушивания из телеграм. 

Берегите уши и приятного пользования!`, ['content', 'intro', 'start', 'disclaimer']), menu([{code: 'accept', text: 'Понятно'}]));
        }
        catch (e) {
            console.log(e);
        }
    });

    scene.action('accept', ctx => routeToNextStep(ctx));
    scene.action('list', ctx => routeToNextStep(ctx));
    scene.action('favorite', ctx => ctx.scene.enter('discover', {type: 'favorite'}));

    return scene;
}