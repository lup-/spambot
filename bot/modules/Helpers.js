const { Telegraf } = require('telegraf');

function wait(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
}

module.exports = {
    md: Telegraf.Extra.markdown(),
    html: Telegraf.Extra.HTML(),
    wait
}