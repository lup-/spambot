const Telegram = require('telegraf/telegram');

const {md} = require('../modules/Helpers');
const {__, __md} = require('../modules/Messages');
const {getMenu, getYesNoMenu, getCustomButtonsMenu} = require('../menus');
const {getManager, init} = require('../managers');

module.exports = {
    menu(ctx) {
        return ctx.editMessageText(__('botMenu'), getMenu('bot', ctx.session));
    },
    add(ctx) {
        ctx.session.messageTarget = 'botToken';
        return ctx.reply(__md('listenBotToken'), md);
    },
    async catchBotToken(ctx) {
        let message = ctx.update.message.text;
        let botToken = message;

        ctx.session.botToken = botToken;
        let newBotManager = await init('bot', {token: botToken});
        let botInfo = {};

        try {
            botInfo = newBotManager.getSelfInfo();
        }
        catch (e) {
            await ctx.reply(__md('botError', e), md);
            return ctx.reply(__md('listenBotToken'), md);
        }

        ctx.session.botName = botInfo.username;
        ctx.session.bot = botInfo;
        ctx.session.bot.name = botInfo.username;
        ctx.session.bot.token = botToken;
        return ctx.reply(__('botConfirm', ctx.session.bot), getYesNoMenu('bot_confirm', 'bot_reset'));
    },
    async confirm(ctx) {
        let bot = ctx.session.bot;
        let userId = ctx.session.userId;
        let botManager = await getManager('bot');
        await botManager.saveBot(bot, userId);

        ctx.session.bot = false;
        ctx.session.botToken = false;
        ctx.session.botName = false;
        ctx.session.messageTarget = false;
        return ctx.editMessageText(__('botAccepted', bot), getMenu('bot', ctx.session));
    },
    reset(ctx) {
        ctx.session.bot = false;
        ctx.session.botToken = false;
        ctx.session.botName = false;
        ctx.session.messageTarget = false;
        ctx.session.botToDelete = false;
        return ctx.reply(__('botReset'), getMenu('bot', ctx.session));
    },
    async list(ctx) {
        let botManager = await getManager('bot');
        let bots = await botManager.listBots(ctx.session.userId);

        let list = bots.map(bot => __('botListRow', bot)).join('\n');
        if (bots.length === 0) {
            list = __('noBots');
        }

        return ctx.editMessageText(__('botList', {list}), getMenu('bot', ctx.session));
    },
    async deleteList(ctx) {
        let bot = await getManager('bot');
        let bots = await bot.listBots(ctx.session.userId);

        let botButtons = (b) => {
            let buttons = bots.map(bot => {
                return [ b(bot.name, `bot_delete_${bot.id}`) ];
            });
            buttons.push([b('Назад', 'bots_menu')]);

            return buttons;
        }

        return ctx.editMessageText(__('botDeleteList'), getCustomButtonsMenu(botButtons));
    },
    async delete(ctx) {
        let botId = ctx.match[1] || null;
        let botManager = await getManager('bot');
        let bot = botManager.getBot(botId, ctx.session.userId);
        ctx.session.botToDelete = bot;

        return ctx.reply(__md('botDeleteConfirm', bot), getYesNoMenu('bot_delete_confirm', 'bot_reset'), md);
    },
    async deleteConfirm(ctx) {
        let bot = ctx.session.botToDelete;
        let botManager = await getManager('bot');

        ctx.session.botToDelete = false;
        await botManager.deleteBot(bot.id);

        return ctx.reply(__md('botDeleted', bot), getMenu('bot', ctx.session), md);
    }
}