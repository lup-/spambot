const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');

module.exports = function (business) {
    const scene = new BaseScene('menu');

    scene.enter(async ctx => {

        let hasFavorites = ctx.session.profile && ctx.session.profile.favorite && ctx.session.profile.favorite.length > 0;
        let hasCategories = ctx.session.profile && ctx.session.profile.categories;
        let hasAnyCategoriesSelected = hasCategories && (ctx.session.profile.categories.bm.length > 0 || ctx.session.profile.categories.ff.length > 0);

        let buttons = [
            {code: 'type_ff', text: 'IT-стартапы'},
            {code: 'type_bm', text: 'Бизнес-идеи'},
        ];

        if (hasFavorites) {
            buttons.push({code: 'type_favorite', text: 'Избранное'});
        }

        if (hasAnyCategoriesSelected) {
            buttons.push({code: 'type_recommendations', text: 'Рекомендации'});
        }

        return ctx.reply(
            __('Что вам интересно?', ['main', 'menu', 'start']),
            menu(buttons, 1)
        );
    });

    scene.action(/type_(.*)/, async ctx => {
        let type = ctx.match[1];
        let noCategoryType = ['bm', 'ff'].indexOf(type) === -1;
        let selectedIds = business.getSelectedCategories(ctx.session.profile, type);
        let categoriesWereShown = selectedIds !== false;

        ctx.session.nav = false;
        if (categoriesWereShown || noCategoryType) {
            return ctx.scene.enter('discover', {type});
        }
        else {
            return ctx.scene.enter('categories', {type});
        }
    });

    return scene;
}