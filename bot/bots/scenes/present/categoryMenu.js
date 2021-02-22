const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');

module.exports = function (presentManager) {
    const scene = new BaseScene('categoryMenu');

    scene.enter(async ctx => {
        ctx.session.nav = false;
        let categories = await presentManager.categoriesList();
        return ctx.replyWithHTML(
            __('Какой подарочек ищем?', ['menu', 'main', 'settings']),
            menu(
                categories.map((category, index) => {
                    return {code: 'category_'+index, text: category.title};
                }), 2
            )
        );
    });

    scene.action(/category_(.*)/, async ctx => {
        let categoryIndex = parseInt(ctx.match[1]);
        let categories = await presentManager.categoriesList();
        let category = categories[categoryIndex];

        ctx.session.category = category;
        return ctx.scene.enter('discover');
    });

    return scene;
}