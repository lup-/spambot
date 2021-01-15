const he = require('he');
const {getDb} = require('../../modules/Database');
const {init} = require('../../managers');
const moment = require('moment');

async function catchErrors(err, ctx) {
    let sendError = false;

    try {
        await ctx.reply('Похоже, что-то пошло не по плану.\nПопробуйте начать заново /start.');
    }
    catch (e) {
        sendError = e;
        if (sendError && sendError.code) {
            if (!this.id) {
                throw sendError;
            }

            if (sendError.code === 403) {
                let chat = init('chat');
                await chat.addUserBlock(ctx, 'reply');
                return false;
            }
        }
    }

    try {
        let db = await getDb();
        let {from, chat} = ctx;
        let userId = from.id || chat.id || false;
        let errorRecord = {
            date: moment().unix(),
            userId,
            error: err.toString(),
            sendError: sendError.toString()
        }

        await db.collection('errors').insertOne(errorRecord);
    }
    catch (e) {}

    return;
}
function getDomain(link) {
    if (link.indexOf('http') !== 0) {
        link = 'https://'+link;
    }

    try {
        let url = new URL(link);
        return url.hostname.toLowerCase() || false;
    }
    catch (e) {
        return  false;
    }
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

    let replaceTags = [{from: 'em', to: 'b'}];
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
function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

module.exports = {catchErrors, getDomain, escapeHTML, clone}