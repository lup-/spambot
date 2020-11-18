const { Telegraf } = require('telegraf');

function wait(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function trimHTML(html) {
    return html.replace(/\<\/*[a-z]+.*?>/ig, '').replace(/ +/, ' ').trim();
}

function truncateString(str, len) {
    if (str.length > len) {
        return str.substring(0, len-3)+'...';
    }

    return str;
}

module.exports = {
    md: Telegraf.Extra.markdown(),
    html: Telegraf.Extra.HTML(),
    wait,
    capitalize,
    trimHTML,
    truncateString
}