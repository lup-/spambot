const Markup = require('telegraf/markup');
const Composer = require('telegraf/composer');

function menu(buttons, columns = false, oneTime = false) {
    if (columns === true) {
        columns = 1;
    }

    let markupButtons = buttons.map(button => {
        let btn = Markup.callbackButton(button.text, button.code);
        if (button.type === 'location') {
            btn = Markup.locationRequestButton(button.text);
        }

        return btn;
    });

    let columnButtons = [];
    if (columns !== false) {
        let row = [];
        for (const button of markupButtons) {

            if (row.length === columns) {
                columnButtons.push(row);
                row = [];
            }

            row.push(button);
        }

        if (row.length > 0) {
            columnButtons.push(row);
        }
    }
    else {
        columnButtons = markupButtons;
    }

    let keyboard = Markup.inlineKeyboard(columnButtons);

    if (oneTime) {
        keyboard = keyboard.oneTime(true);
    }

    return keyboard.extra();
}

function yesNoMenu() {
    return menu([
        {code: 'menu_yes', text: 'Да'},
        {code: 'menu_no', text: 'Нет'},
    ]);
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

module.exports = {menu, yesNoMenu, buttonStep, urlButton};