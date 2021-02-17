const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');
const {wait} = require('../../../modules/Helpers');

function getProductText(ctx, productItem) {
    let rawProduct = productItem.rawProduct;
    return `<b>${productItem.name}</b>
Старая цена: <del>${productItem.oldPrice}</del>
Новая цена: <b>${productItem.price}</b>
Скидка: ${productItem.discount}%

${rawProduct.categoryId}
${rawProduct.description}`;
}
function getCouponText(ctx, couponItem) {
    let rawCoupon = couponItem.rawCoupon;
    let description = rawCoupon.description;
    let name = rawCoupon.campaign.name.replace(/ +(RU|UA|KZ|BY|WW)/g, '');
    if (!description) {
        description = rawCoupon.categories ? rawCoupon.categories.map(category => category.name).join(' / ') : '';
    }

    return `<b>${name}</b>
Скидка: ${rawCoupon.discount}
Промокод: <b>${rawCoupon.promocode}</b>

${description}`;
}
function getCashbackText(ctx, cashbackItem, couponMgr) {
    let cashbackSize = couponMgr.getCashbackValue(cashbackItem);
    let description = cashbackItem.admitadCampaign.categories ? cashbackItem.admitadCampaign.categories.map(category => category.name).join(' / ') : '';
    let name = cashbackItem.name.replace(/ +(RU|UA|KZ|BY|WW)/g, '');

    return `<b>${name}</b>
Cashback: до ${cashbackSize}%

${description}`
}

async function replyWithItem(type, ctx, item, couponMgr) {
    if (!item) {
        let emptyMenu = menu([
            { code: 'dice', text: 'Бросить кости еще раз' }
        ], 1);

        return ctx.replyWithHTML(`Неужели не нашлось скдики? Вот это да...`, emptyMenu);
    }

    let image = item.image;
    let url = item.url;
    let text = '';
    switch (type) {
        case 'coupons':
            text = getCouponText(ctx, item);
            break;
        case 'products':
            text = getProductText(ctx, item);
            break;
        case 'cashback':
            text = getCashbackText(ctx, item, couponMgr);
            image = item.admitadCampaign.image;
            url = item.admitadCampaign.gotolink;
            break;
    }

    let getMenu = menu([
        { url, text: 'Получить скидку' },
        { code: 'dice', text: 'Бросить кости еще раз' },
        { code: 'back', text: 'Вернуться в меню' }
    ], 1);

    let textWithAd = __(text, ['content', 'discount', 'info'], 'photo')

    let photoExtra = getMenu;
    photoExtra.parse_mode = 'html';
    photoExtra.caption = textWithAd;
    image = image.replace('http:', 'https:');

    return ctx.safeReply(
        ctx => ctx.replyWithPhoto({url: image}, photoExtra),
        ctx => ctx.replyWithHTML(textWithAd, getMenu),
        ctx
    );
}

module.exports = function ({coupon}) {
    const scene = new BaseScene('tryLuck');
    scene.enter(async ctx => {
        let text = `Все готово. Ваш бросок`;
        let diceMenu = menu([{code: 'dice', text: 'Бросить кости'}]);
        diceMenu.parse_mode = 'html';

        return ctx.safeReply(
            ctx => ctx.editMessageText(text, diceMenu),
            ctx => ctx.replyWithHTML(text, diceMenu),
            ctx
        );
    });

    scene.action('dice', async ctx => {
        let type = ctx.scene.state.type || 'coupons';

        let diceMessage1 = await ctx.replyWithDice();
        let diceMessage2 = await ctx.replyWithDice();
        let diceValues = [ diceMessage1.dice.value, diceMessage2.dice.value ];
        let isDouble = diceValues[0] === diceValues[1];
        let totalScore = diceValues[0] + diceValues[1];

        await wait(5000);
        await ctx.replyWithHTML(`Ваш результат: <b>${diceValues[0]}</b> + <b>${diceValues[1]}</b> = <b>${totalScore}</b>`);

        let item = await coupon.getRandomItem(type, totalScore, isDouble, ctx);

        return replyWithItem(type, ctx, item, coupon);
    });
    
    scene.action('back', ctx => ctx.scene.enter('intro'));

    return scene;
}