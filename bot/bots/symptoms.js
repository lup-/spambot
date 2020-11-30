const { Telegraf } = require('telegraf');
const {initManagers} = require('../managers');
const {catchErrors} = require('./helpers/common');
const {menu} = require('./helpers/wizard');
const {trimHTML} = require('../modules/Helpers');
const {__} = require('../modules/Messages');

const session = require('telegraf/session');
const store = new Map();

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);

function limbsMenu(diseases) {
    return menu(
        diseases.getLimbs().map(limb => {
            return {code: `limb_${limb.code}`, text: limb.name};
        }), 2
    )
}

async function startDialog(ctx, diseases) {
    try {
        ctx.session.started = true;
        return ctx.reply(
            __('Здравствуйте! На что жалуетесь?', ['menu', 'main', 'start']),
            limbsMenu(diseases)
        );
    }
    catch (e) {}
}

function rateMenu() {
    return menu([
        {code: 'rate_good', text: '👍'},
        {code: 'rate_bad', text: '👎'},
    ]);
}

function replyWithRestart(text, ctx) {
    text = __(text, ['menu', 'restart']);
    return ctx.reply(text, menu([{code: 'restart', text: 'Главное меню'}]));
}

initManagers(['chat', 'diseases', 'bus']).then(async ({chat, diseases, bus}) => {
    app.catch(catchErrors);

    app.use(session({store}));
    app.use(chat.initIdsMiddleware());
    app.use(chat.saveRefMiddleware());
    app.use(chat.saveUserMiddleware());

    app.start(ctx => {
        return ctx.reply(
            __(`Этот бот несет строго ознакомительный характер и не является руководством к действию/лечению.

Точную информацию можно получить только при консультации у врача.`, ['content', 'start', 'disclaimer']),
            menu([
                {code: 'accept', text: 'Понятно'}
            ])
        )
    })

    app.action('accept', ctx => startDialog(ctx, diseases))

    app.action(/limb_(.*)/, async ctx => {
        if (!ctx.session.started) {
            return startDialog(ctx, diseases);
        }

        let [,limb] = ctx.match;
        let symptoms = await diseases.getLimbSymptoms(limb);
        let symptomMenu = menu( symptoms.map( symptom => {
            return {code: `complain_${symptom.id}_initial`, text: symptom.text}
        }), 1)
        return ctx.editMessageText('Теперь укажите основную проблему', symptomMenu);
    });

    app.action(/complain_(\d+)_(.*)/, async ctx => {
        if (!ctx.session.started) {
            return startDialog(ctx, diseases);
        }

        let [, symptomId, complainId] = ctx.match;
        if (ctx.session.symptomId !== symptomId) {
            ctx.session.symptomId = symptomId;
            ctx.session.route = [];
        }

        let isPassed = ctx.session.route.indexOf(complainId) !== -1;
        if (isPassed) {
            return;
        }

        let complain = await diseases.getComplaint(symptomId, complainId);
        ctx.session.route.push(complainId);

        if (complain.roundType === 'question') {
            let complainButtons = [
                {code: `complain_${symptomId}_${complain.yesId}`, text: 'Да'},
                {code: `complain_${symptomId}_${complain.noId}`, text: 'Нет'},
            ];

            if (complain.unknownId) {
                complainButtons.push(
                    {code: `complain_${symptomId}_${complain.unknownId}`, text: 'Не ясно'}
                );
            }

            let questionMenu = menu(complainButtons, false, true);
            return ctx.reply(complain.title, questionMenu);
        }
        else {
            ctx.session.diagnosis = complain;
            let text = trimHTML(complain.text.replace(/\<\/p\>/g, '</p>\n'));
            let diagnosis = `<b>${complain.title}</b>\n\n${text}`;
            await ctx.replyWithHTML(
                __(diagnosis, ['content', 'diagnosis', 'info']),
                rateMenu()
            );
            return replyWithRestart('Еще раз?', ctx);
        }
    });

    app.action(/rate_(.*)/, async ctx => {
        if (!ctx.session.started) {
            return startDialog(ctx, diseases);
        }

        let rateType = ctx.match[1];
        let {symptomId, route, diagnosis, userId} = ctx.session;
        await diseases.rate("symptoms", rateType, symptomId, route, diagnosis, userId);
        return replyWithRestart('Спасибо за отзыв!', ctx);
    });

    app.action(/.*/, ctx => startDialog(ctx, diseases));
    app.on('message', ctx => startDialog(ctx, diseases));

    app.launch();
    bus.listenCommands();
});