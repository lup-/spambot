async function catchErrors(err, ctx) {
    console.log(err);
    try {
        await ctx.reply('Похоже, что-то пошло не по плану.\nПопробуйте начать заново /start.');
    }
    catch (e) {
    }

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

function escapeHTML(html) {
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

    html = html.replace(/<\/p>/gi, '\n');
    html = html.replace(/<br><\/div>/gi, '\n');
    html = html.replace(/<br>/gi, '\n');
    html = html.replace(/<\/div>/gi, '\n');

    let allowedTags = ['b', 'strong', 'em', 'i', 'u', 'ins', 's', 'strike', 'del', 'a', 'code', 'pre'];
    let removeTags = tags.filter(value => !allowedTags.includes(value));
    removeTags.map(tag => {
        html = html.replace( new RegExp('<\/?'+tag+'[^>]*>', 'g'), '');
    });

    html = html.replace(/<(\s)/g, '&lt;$1');

    return html;
}
module.exports = {catchErrors, getDomain, escapeHTML}