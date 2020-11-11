const Markup = require('telegraf/markup');
const Composer = require('telegraf/composer');

function menu(buttons, column = false) {
    return Markup.inlineKeyboard(
        buttons.map(button => {
            let btn = Markup.callbackButton(button.text, button.code);
            return column
                ? [btn]
                : btn;
        })
    ).extra();
}

function urlButton(button) {
    return Markup.inlineKeyboard([
        Markup.urlButton(button.text, button.url),
    ]).extra();
}

function callbackWrapper(callback) {
    let nextStep = (ctx) => {
        ctx.wizard.next();
        return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    }

    let selectStep = (ctx, step) => {
        ctx.wizard.selectStep(step);
        return ctx.wizard.steps[step](ctx);
    }

    return ctx => callback(ctx, nextStep, selectStep);
}

function buttonStep(actions = [], events = []) {
    let handler = new Composer();
    for (const action of actions) {
        handler.action(action.code, callbackWrapper(action.callback));
    }

    for (const event of events) {
        handler.on(event.code, callbackWrapper(event.callback));
    }

    handler.use(ctx => ctx.reply('Для продолжения нужно нажать на кнопку'));

    return handler;
}

module.exports = {menu, buttonStep, urlButton};