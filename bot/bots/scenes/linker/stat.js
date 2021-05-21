const BaseScene = require('telegraf/scenes/base');
const {getDb} = require('../../../modules/Database');
const {menu} = require('../../helpers/wizard');
const {getChatStat} = require('../../actions/linkProcessing');

// const {clone} = require('../../helpers/common');
const {wait} = require('../../../modules/Helpers');

module.exports = function () {
    const scene = new BaseScene('stat');

    scene.enter(async ctx => {
        return ctx.reply('Напишите название поста, для которого нужна статистика', menu([{'code': 'back', text: 'Назад в меню'}]));
    });

    scene.action('back', ctx => ctx.scene.enter('menu'));

    scene.on('message', async (ctx, next) => {
        let message = ctx && ctx.update && ctx.update.message
            ? ctx.update.message
            : null;

        let itemName = message.text;
        let db = await getDb();
        let item = await db.collection('generated').findOne({title: {$regex: `.*${itemName}.*`, $options: 'i'}});
        if (!item) {
            ctx.reply('Пост не найден');
            return ctx.scene.reenter();
        }

        for (let chat of item.chats) {
            try {
                let stat = await getChatStat(chat, ctx);
            }
            catch (e) {
                ctx.reply(`Ошибка: чат "${chat.title}": ${e.toString()}`);
            }
        }

    });

    return scene;
}