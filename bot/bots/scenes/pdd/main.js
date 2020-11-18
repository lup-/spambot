const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');

module.exports = function (pddManager) {
    const scene = new BaseScene('main');

    scene.enter(async ctx => {
        return ctx.reply('Потренируемся, или сразу экзамен?', menu([
            {code: 'exam', text: 'Экзамен'},
            {code: 'train', text: 'Потренируемся'},
        ]));
    });

    scene.action('exam',async ctx => {
        return ctx.scene.enter('exam');
    });

    scene.action('train',async ctx => {
        return ctx.scene.enter('topics');
    });

    return scene;
};
