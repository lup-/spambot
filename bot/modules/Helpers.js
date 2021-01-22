const { Telegraf } = require('telegraf');
const he = require('he');

function wait(msec) {
    return new Promise(resolve => setTimeout(resolve, msec));
}

const eventLoopQueue = () => {
    return new Promise(resolve =>
        setImmediate(resolve)
    );
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
function trimHTML(html) {
    return he.decode(html)
        .replace(/<!\-\-.*?\-\->/ig, '')
        .replace(/<\/*[a-z]+.*?>/ig, '')
        .replace(/ +/, ' ')
        .trim();
}

function truncateString(str, len) {
    if (str.length > len) {
        return str.substring(0, len-3)+'...';
    }

    return str;
}

function hashCode(str) {
    let hash = 0;

    if (str.length === 0) {
        return hash;
    }

    for (let i = 0; i < str.length; i++) {
        let char = str.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash;
    }

    return hash.toString();
}

module.exports = {
    md: Telegraf.Extra.markdown(),
    html: Telegraf.Extra.HTML(),
    wait,
    eventLoopQueue,
    capitalize,
    trimHTML,
    truncateString,
    hashCode
}