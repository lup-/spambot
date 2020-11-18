const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');

function topicsMenu(pddManager) {
    let topics = pddManager.getTopicsList();

    let buttons = topics.map( topic => {
        return {code: 'topic_'+topic.id, text: topic.name};
    });

    return menu(buttons, 1);
}

module.exports = function (pddManager) {
    const scene = new BaseScene('topics');

    scene.enter(async ctx => {
        return ctx.reply('Укажите тему для тренировки', topicsMenu(pddManager));
    });

    scene.action(/topic_(.*)/, async ctx => {
        let topicId = parseInt(ctx.match[1]);
        let topic = pddManager.getTopicById(topicId);

        if (!topic) {
            return ctx.scene.reenter();
        }

        ctx.session.section = topic;
        ctx.session.questions = topic.tickets;
        ctx.session.nav = false;
        ctx.session.answers = [];
        ctx.scene.enter('question');
    });

    return scene;
};
