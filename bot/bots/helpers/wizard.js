const Markup = require('telegraf/markup');
const Composer = require('telegraf/composer');

function getMarkupButtons(buttons, columns = false) {
    if (columns === true) {
        columns = 1;
    }

    let markupButtons = buttons.map(button => {
        if (button.url) {
            return Markup.urlButton(button.text, button.url);
        }
        else {
            return Markup.callbackButton(button.text, button.code);
        }
    });

    let columnButtons = [];
    if (columns > 0) {
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

    return columnButtons;
}
function menu(buttons, columns = false, oneTime = false) {

    let columnButtons = getMarkupButtons(buttons, columns);
    let keyboard = Markup.inlineKeyboard(columnButtons);

    if (oneTime) {
        keyboard = keyboard.oneTime(true);
    }

    return keyboard.extra();
}
function hMenu(buttonRows) {
    let keyboard = Markup.inlineKeyboard(buttonRows.map(row => getMarkupButtons(row, false)));
    return keyboard.extra();
}
function menuWithControls(buttons, buttonColumns, controls) {
    let mainButtons = getMarkupButtons(buttons, buttonColumns);
    let controlButtons = getMarkupButtons(controls, controls.length);
    let allButtons = mainButtons.concat(controlButtons);
    return Markup.inlineKeyboard(allButtons).extra();
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

module.exports = {menu, yesNoMenu, buttonStep, urlButton, menuWithControls, hMenu};