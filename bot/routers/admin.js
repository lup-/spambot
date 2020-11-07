const {__, __md} = require('../modules/Messages');
const {md} = require('../modules/Helpers');
const {getMenu} = require('../menus');

let messageRoutes = require('../routes/message');
let mailingRoutes = require('../routes/mailing');
let botRoutes = require('../routes/bot');
let statRoutes = require('../routes/stats');

function homeMenu(ctx) {
    return ctx.reply( __('startMessage'), getMenu('root', ctx.session) );
}

const routes = [
    { code: 'home', handler: homeMenu },

    { code: 'message_menu', handler: messageRoutes.menu },
    { code: 'bot_change', handler: messageRoutes.botList },
    { code: /^bot_select_(.+)/, handler: messageRoutes.botSelect },
    { code: 'new_message', handler: messageRoutes.new },
    { code: 'reset_message', handler: messageRoutes.reset },

    { code: 'mailing_menu', handler: mailingRoutes.menu },
    { code: 'set_mailing_date', handler: mailingRoutes.setDate },
    { code: 'reset_mailing_date', handler: mailingRoutes.resetDate },
    { code: 'send_mailing', handler: mailingRoutes.send },

    { code: 'mailing_list', handler: mailingRoutes.list },
    { code: /^mailing_show_(.+)/, handler: mailingRoutes.show },

    { code: 'bots_menu', handler: botRoutes.menu },
    { code: 'bot_list', handler: botRoutes.list },
    { code: 'bot_add', handler: botRoutes.add },
    { code: 'bot_reset', handler: botRoutes.reset },
    { code: 'bot_confirm', handler: botRoutes.confirm },
    { code: 'bot_delete', handler: botRoutes.deleteList },
    { code: /^bot_delete_(.+)/, handler: botRoutes.delete },
    { code: 'bot_delete_confirm', handler: botRoutes.deleteConfirm },

    { code: 'stat_menu', handler: statRoutes.menu },
    { code: 'stat_1d', handler: statRoutes.stat1d },
    { code: 'stat_1w', handler: statRoutes.stat1w },
    { code: 'stat_1m', handler: statRoutes.stat1m },
    { code: 'stat_1y', handler: statRoutes.stat1y },
];

const events = [
    { code: 'message', handler: (ctx) => {

        let currentTarget = ctx.session.messageTarget;
        let messageTargets = {
            'message': messageRoutes.catch,
            'date': mailingRoutes.catchDate,
            'botToken': botRoutes.catchBotToken,
        }

        if (currentTarget && messageTargets[currentTarget]) {
            const messageRoute = messageTargets[currentTarget];
            return messageRoute(ctx);
        }

        return ctx.reply(__md('unknownMessage'), md);
    }},
]

module.exports = function (app) {
    for (const route of routes) {
        app.action(route.code, route.handler);
    }

    for (const event of events) {
        app.on(event.code, event.handler);
    }

    return app;
}