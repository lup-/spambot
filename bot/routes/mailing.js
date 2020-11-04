const {md} = require('../modules/Helpers');
const {__, __md} = require('../modules/Messages');
const moment = require('moment');
const {getMenu, getCustomButtonsMenu} = require('../menus');
const getBot = require('../modules/Bot');

module.exports = {
    menu(ctx) {
        return ctx.editMessageText(__('mailingMenu'), getMenu('mailing', ctx.session));
    },
    async send(ctx) {
        let menu = getMenu('mailing', ctx.session);

        if (!ctx.session.bot) {
            return ctx.reply( __md('noBotSelected'), menu, md );
        }

        if (!ctx.session.message) {
            return ctx.reply( __md('noMessageSelected'), menu, md );
        }

        let mailing = {
            userId: ctx.session.userId,
            bot: ctx.session.bot,
            message: ctx.session.message,
            dateCreated: moment().unix(),
            dateStarted: ctx.session.mailingDate,
        }

        ctx.session.bot = false;
        ctx.session.message = false;
        ctx.session.mailingDate = false;

        let botManager = getBot();
        await botManager.saveMailing(mailing);

        return ctx.editMessageText( __('mailingStarted'), getMenu('root', ctx.session) );
    },
    setDate(ctx) {
        ctx.session.messageTarget = 'date';
        return ctx.reply(__md('listenDate'), md);
    },
    catchDate(ctx) {
        let dateText = ctx.update.message.text;
        let date = moment(dateText, 'DD.MM.YYYY HH:mm');

        if (date.isValid()) {
            ctx.session.mailingDate = date.unix();
            return ctx.reply(__md('dateAccepted', {date: date.toISOString()}), getMenu('mailing', ctx.session), md);
        }
        else {
            return ctx.reply(__md('invalidDate'), getMenu('mailing', ctx.session), md);
        }
    },
    resetDate(ctx) {
        ctx.session.mailingDate = false;
        return ctx.editMessageText(__md('resetDate'), getMenu('mailing', ctx.session), md);
    },
    async list(ctx) {
        let bot = getBot();
        let mailings = await bot.listMailings(ctx.session.userId);

        let mailingButtons = (b) => {
            let buttons = mailings.map(mailing => {
                let mailingDate = mailing.dateStarted || mailing.dateCreated;
                let mailingName = moment(mailingDate).toISOString();

                return [ b(mailingName, `mailing_show_${mailing.id}`) ];
            });
            buttons.push([b( 'В главное меню', 'home')]);

            return buttons;
        }

        return ctx.editMessageText(__('mailingsList'), getCustomButtonsMenu(mailingButtons));
    },
    async show(ctx) {
        let mailingId = ctx.match[1] || null;
        let botManager = getBot();

        let mailing = botManager.getMailing(mailingId, ctx.session.userId);
        for (const dateField of ['dateStarted', 'dateCreated', 'dateFinished']) {
            let date = mailing[dateField] ? moment(mailing[dateField]) : null;
            mailing[dateField + 'Text'] = date && date.isValid() ? date.toISOString() : '-';
        }

        return ctx.reply(__md('mailingData', mailing), getMenu('root', ctx.session), md);
    }
}