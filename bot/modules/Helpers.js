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
function escapeHTML(html, decode = false) {
    if (decode) {
        html = he.decode(html);
    }

    let hasTags = (/\<([^ \/>]*) *[^>]*>/gi).test(html);
    let tags = hasTags ? html.match(/\<([^ \/>]*) *[^>]*>/gi).map(parsedTag => {
        let tagData = parsedTag.match(/<\/?([^ >]+)[^>]*>/i);
        if (tagData) {
            let tagName = tagData[1];
            if (tagName) {
                return tagName.toLowerCase();
            }
        }
        return null;
    }).filter(tag => tag !== null).filter((tag, index, allTags) => allTags.indexOf(tag) === index) : [];

    let replaceTags = [{from: 'em', to: 'i'}];
    replaceTags.map(replaceData => {
        html = html.replace( new RegExp('<(\/?)'+replaceData.from+'( *[^>]*)>', 'g'), '<$1'+replaceData.to+'$2>' );
    });

    html = html.replace(/<li> *<\/li>/g, '');
    html = html.replace(/<\/p> *<\/li>/gi, '\n');
    html = html.replace(/<br> *<\/p>/gi, '\n');
    html = html.replace(/<\/p>/gi, '\n');
    html = html.replace(/<br> *<\/div>/gi, '\n');
    html = html.replace(/<br>/gi, '\n');
    html = html.replace(/<\/div>/gi, '\n');
    html = html.replace(/<li>/gi, '• ');
    html = html.replace(/<\/li>/gi, '\n');
    html = html.replace(/<\/ul>/gi, '\n');

    let allowedTags = ['b', 'strong', 'em', 'i', 'u', 'ins', 's', 'strike', 'del', 'a', 'code', 'pre'];
    let removeTags = tags.filter(value => !allowedTags.includes(value));
    removeTags.map(tag => {
        html = html.replace( new RegExp('<\/?'+tag+'[^>]*>', 'g'), '');
    });

    html = html.replace(/<(\s)/g, '&lt;$1');
    html = html.replace(/^ +/gm, '');
    html = html.replace(/\n{2,}/g, '\n\n');

    return html;
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
    escapeHTML,
    truncateString,
    hashCode
}