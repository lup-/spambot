const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {getUserLinkedChats} = require('../../actions/linkProcessing');

const introMessage = `Привет!

Этот бот нужен, чтобы управляться с пригласительными ссылками в каналы и чаты.`

module.exports = function () {
    const scene = new BaseScene('intro');

    scene.enter(async ctx => {
        let messageShown = ctx.session.introShown || false;
        let user = ctx.from;
        let userChats = await getUserLinkedChats(user);
        let hasAttachedChannels = userChats.length > 0;

        if (messageShown) {
            if (hasAttachedChannels) {
                return ctx.scene.enter('channelsMenu');
            }
            else {
                return ctx.scene.enter('addChannel');
            }
        }

        try {
            ctx.session.introShown = true;
            let extra = menu([{code: 'accept', text: 'Понятно'}]);
            return ctx.replyWithDisposableHTML(introMessage, extra);
        }
        catch (e) {
        }
    });

    scene.action('accept', ctx => ctx.scene.reenter());

    return scene;
}