const BaseScene = require('telegraf/scenes/base');
const Markup = require('telegraf/markup');
const moment = require('moment');

function zodiacMenu(horoscopeManager) {
    const SIGN_COLS = 2;

    let horoscopeButtons = horoscopeManager.listSigns().reduce( (rows, sign) => {
        let lastRowIndex = rows.length-1;
        let lastRow = rows[lastRowIndex];
        let button = Markup.callbackButton(sign.title, 'sign_'+sign.code);

        if (lastRow.length < SIGN_COLS) {
            lastRow.push(button)
        }
        else {
            lastRow = [button];
            rows.push(lastRow);
        }

        return rows;
    }, [[]]);

    let menuButtons = horoscopeButtons;
    menuButtons.push( [Markup.callbackButton('По дате рождения', 'birthday')] );

    return Markup.inlineKeyboard(menuButtons).extra();
}

module.exports = function (horoscopeManager) {
    const scene = new BaseScene('signsMenu');

    scene.enter(async ctx => {
        ctx.session.sign = false;
        ctx.session.messageTarget = false;
        return ctx.reply('Какой знак Зодиака интересует?', zodiacMenu(horoscopeManager));
    });

    scene.action(/sign_(.*)/, async ctx => {
        let signCode = ctx.match[1];
        ctx.session.sign = signCode;
        return ctx.scene.enter('typesMenu');
    });

    scene.action('birthday', ctx => {
        ctx.session.messageTarget = 'birthday';
        return ctx.reply('Напишите дату рождения. Например: 31.12.2020');
    });

    scene.on('message', async ctx => {
        let message = ctx && ctx.update && ctx.update.message
            ? ctx.update.message.text
            : false;

        if (ctx.session.messageTarget === 'birthday') {
            if (!message) {
                return ctx.replyWithChatAction('birthday');
            }

            let strDate = message.trim();
            try {
                let date = moment(strDate, 'DD.MM.YYYY');
                if (date.isValid()) {
                    let sign = horoscopeManager.getSignByDate(strDate);
                    if (sign) {
                        ctx.session.sign = sign.code;
                        ctx.session.birthday = strDate;
                        ctx.session.messageTarget = false;
                        await ctx.replyWithHTML('Выбран знак <b>'+sign.title+'</b>');
                        return ctx.scene.enter('typesMenu');
                    }
                    else {
                        ctx.session.messageTarget = false;
                        await ctx.reply('Не удалось определить знак Зодиака');
                        return ctx.scene.reenter();
                    }
                }
            }
            catch (e) {
                await ctx.reply('Ошибка в дате. Попробуйте еще раз');
                return ctx.replyWithChatAction('birthday');
            }
        }
        else {
            return ctx.scene.reenter();
        }
    });

    return scene;
}