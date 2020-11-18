const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');

module.exports = function (pddManager) {
    const scene = new BaseScene('exam');

    scene.enter(async ctx => {
        return ctx.reply('Нажмите кнопку, когда будете готовы', menu([{code: 'go', text: 'Поехали'}]));
    });

    scene.action('go',async ctx => {
        ctx.session.section = null;
        ctx.session.answers = [];
        ctx.session.nav = false;
        ctx.session.questions = pddManager.getRandomQuestions(20);
        return ctx.scene.enter('question');
    });

    return scene;
};
