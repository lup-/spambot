const {md} = require('../modules/Helpers');
const {__, __md} = require('../modules/Messages');
const {getMenu, getCustomButtonsMenu} = require('../menus');
const getBot = require('../modules/Bot');

module.exports = {
    menu(ctx) {
        return ctx.editMessageText(__('messageMenu'), getMenu('message', ctx.session));
    },
    new(ctx) {
        ctx.session.messageTarget = 'message';
        return ctx.reply(__md('listenMessage'), md);
    },
    catch(ctx) {
        ctx.session.message = ctx.update.message;
        ctx.session.messageTarget = false;

        return ctx.reply( __md('messageAccepted'), getMenu('message', ctx.session), md );
    },
    async botList(ctx) {
        let bot = getBot();
        let bots = await bot.listBots();

        let botButtons = (b) => {
            let buttons = bots.map(bot => {
                return [ b(bot.name, `bot_select_${bot.id}`) ];
            });
            buttons.push([b('Назад', 'message_menu')]);

            return buttons;
        }

        return ctx.editMessageText(__('botSelectList'), getCustomButtonsMenu(botButtons));
    },
    async botSelect(ctx) {
        let botId = ctx.match[1] || null;
        let bot = getBot();
        let selectedBot = await bot.getBot(botId);
        ctx.session.bot = selectedBot;

        return ctx.editMessageText(__('botSelected', selectedBot), getMenu('message', ctx.session));
    },
    reset(ctx) {
        ctx.session.bot = false;
        ctx.session.message = false;
        ctx.session.messageTarget = false;

        return ctx.editMessageText( __('resetMessage'), getMenu('message', ctx.session) );
    }
}