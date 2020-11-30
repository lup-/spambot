const fs = require('fs');
const Markup = require('telegraf/markup');
const BaseScene = require('telegraf/scenes/base');
const {__} = require('../../../modules/Messages');

function questionMenu(question, hasPrev, hasNext, answerIndex, answerCorrect) {
    let answerButtons = question.answers.map((answerText, index) => {
        let buttonText = (index+1)+'';
        if (answerIndex > 0 && answerIndex === index+1) {
            buttonText = (answerCorrect ? '✅ ' : '❌ ') + buttonText;
        }

        return {code: 'answer_'+(index+1), text: buttonText};
    });

    let navigationButtons = [];
    if (hasPrev) {
        navigationButtons.push({code: 'go_prev', text: '◀' });
    }

    navigationButtons.push({code: 'menu', text: '↩'});

    if (hasNext) {
        navigationButtons.push({code: 'go_next', text: '▶' });
    }

    navigationButtons = navigationButtons.map( button => {
        return Markup.callbackButton(button.text, button.code);
    });

    answerButtons = answerButtons.map( button => {
        return Markup.callbackButton(button.text, button.code);
    });

    return Markup.inlineKeyboard([answerButtons, navigationButtons]).extra();
}
function getQuestionMedia(question) {
    let imageFileName = question.image.replace(/.*\//, '');
    let path = fs.realpathSync(__dirname + '/../../data/images/'+imageFileName);
    return {source: path};
}

module.exports = function (pddManager) {
    const scene = new BaseScene('question');

    scene.enter(async ctx => {
        let currentIndex = ctx.session.currentQuestion || 0;
        let questions = ctx.session.questions;
        let question = questions[currentIndex];
        let hasQuestions = questions && questions.length > 0;
        let fromNav = typeof (ctx.session.nav) === 'boolean' ? ctx.session.nav : false;
        let showNewMessage = !fromNav;

        if (!hasQuestions) {
            return ctx.scene.enter('main');
        }

        ctx.session.answers = ctx.session.answers || [];
        let answerIndex = ctx.session.answers[currentIndex] || null;
        let answerCorrect = answerIndex ? parseInt(question.correct) === answerIndex : false;

        let hasPrev = currentIndex > 0;
        let hasNext = currentIndex < questions.length - 1;

        let questionText = question.title;

        if (answerIndex && !answerCorrect) {
            questionText += `\n\n<b>Подсказка: ${question.hint}</b>`;
        }

        questionText += '\n\n' + question.answers.join('\n');
        questionText = __(questionText, ['content', 'question']);

        let photoExtra = questionMenu(question, hasPrev, hasNext, answerIndex, answerCorrect);
        photoExtra.parse_mode = 'html';
        photoExtra.caption = questionText;

        let media = getQuestionMedia(question);

        return showNewMessage
            ? ctx.replyWithPhoto(media, photoExtra)
            : ctx.editMessageMedia({type: 'photo', media, caption: questionText}, photoExtra);
    });

    scene.action('go_prev', ctx => {
        let index = ctx.session.currentQuestion || 0;
        if (index > 0) {
            index--;
        }

        ctx.session.currentQuestion = index;
        ctx.session.nav = true;
        return ctx.scene.reenter();
    });

    scene.action('go_next', ctx => {
        let questions = ctx.session.questions;
        let currentIndex = ctx.session.currentQuestion || 0;
        let hasNext = questions && currentIndex < questions.length - 1;

        let index = ctx.session.currentQuestion || 0;
        if (hasNext) {
            index++;
        }

        ctx.session.currentQuestion = index;
        ctx.session.nav = true;
        return ctx.scene.reenter();
    });

    scene.action('menu',async ctx => {
        ctx.session.nav = false;
        return ctx.scene.enter('main');
    });

    scene.action(/answer_(.*)/, async ctx => {
        let answerNum = parseInt(ctx.match[1]);
        let currentIndex = ctx.session.currentQuestion || 0;
        let question = ctx.session.questions[currentIndex];

        ctx.session.nav = true;
        ctx.session.answers[currentIndex] = answerNum;

        await pddManager.saveStat(question, answerNum, ctx.session.section);

        return ctx.scene.reenter();
    });

    return scene;
};
