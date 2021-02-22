const {getManagerSync: manager} = require('../../bot/managers');
let coupon = manager('coupon');

(async () => {
    await coupon.updateAllCampaigns();
    await coupon.updateAllCoupons();
    await coupon.connectNewCampaigns();
    await coupon.updateAllProducts();
    process.exit();
})();
