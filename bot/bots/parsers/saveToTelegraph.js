const axios = require('axios');
const qs = require('qs');
const {trimHTML, wait} = require('../../modules/Helpers');


const VALID_TAGS = [
    'a', 'aside',
    'b', 'blockquote', 'br',
    'code',
    'em',
    'figcaption', 'figure',
    'h3', 'h4', 'hr',
    'i', 'iframe', 'img',
    'li',
    'ol',
    'p', 'pre',
    's', 'strong',
    'u', 'ul',
    'video'
];

function copy(array) {
    return array.slice();
}
function blockToNodes(block) {
    let nodes = [];

    if (block.title && !block.subtitle) {
        nodes.push({tag: 'h3', children: [block.title]});
    }

    if (block.subtitle) {
        nodes.push({tag: 'h4', children: [block.subtitle]});
    }

    if (block.images && block.images.length > 0) {
        let imageTags = block.images.map(src => ({tag: 'img', attrs: {src}}));
        nodes = nodes.concat(imageTags);
    }

    if (block.videos && block.videos.length > 0) {
        for (let ytId of block.videos) {
            nodes.push({tag: 'iframe', attrs: {
                width: 560,
                height: 315,
                src: `https://www.youtube.com/embed/${ytId}`,
                frameBorder: 0,
                allowFullScreen: 1
            }});
        }
    }

    for (let text of block.text) {
        let matches = text.match(/<([a-z]+).*?>(.*)<\/[a-z]+>/ims);
        let tag;
        let innerText;
        if (matches) {
            tag = matches[1];
            innerText = matches[2];
        }
        else {
            tag = 'p';
            innerText = text;
        }
        let children = [ trimHTML(innerText) ];

        if ( !VALID_TAGS.indexOf(tag.toLowerCase()) ) {
            tag = 'p';
        }

        if (['ol', 'ul'].indexOf(tag) !== -1) {
            children = innerText.match(/<li[^>]*>(.*?)<\/li>/igms).map(liTag => {
                return {tag: 'li', children: [ trimHTML(liTag) ]}
            });
        }

        nodes.push({tag, children});
    }

    return nodes;
}
function makeContentChunks(blocks) {
    const MAX_REQUEST_SIZE = 64 * 1024;
    const EXTRA_DATA_RESERVATION = 4 * 1024;

    const MAX_CHUNK_SIZE = MAX_REQUEST_SIZE - EXTRA_DATA_RESERVATION;
    let sourceBlocks = copy(blocks);

    let chunks = [];
    let chunkNodes = [];
    while (sourceBlocks.length > 0) {
        let nextBlock = sourceBlocks.shift();
        let nextNodes = blockToNodes(nextBlock);
        let chunkCandidate = chunkNodes.concat(nextNodes);

        let approxChunkSize = encodeURIComponent(JSON.stringify({content: chunkCandidate})).length;
        if (approxChunkSize >= MAX_CHUNK_SIZE) {
            chunks.push(chunkNodes);
            chunkNodes = nextNodes;
        }
        else {
            chunkNodes = chunkCandidate;
        }
    }

    if (chunkNodes.length > 0) {
        chunks.push(chunkNodes);
    }

    return chunks;
}

async function saveArticleToTelegraph(article) {
    let access_token = process.env.TELEGRAPH_TOKEN;
    let contentChunks = makeContentChunks(article.blocks);
    let hasMultipleParts = contentChunks.length > 1;

    let publications = [];
    let nextPartLink = false;
    for (let chunkIndex = contentChunks.length - 1; chunkIndex >= 0; chunkIndex --) {
        let partNumber = chunkIndex + 1;
        let partTitle = `Часть ${partNumber}`;
        let nextPartTitle = `Часть ${partNumber+1}`;
        let content = contentChunks[chunkIndex];

        if (article.cover && chunkIndex === 0) {
            content.unshift({tag: 'img', attrs: {src: article.cover}});
        }

        if (nextPartLink) {
            content.push({tag: 'a', attrs: {href: nextPartLink}, children: [nextPartTitle]})
        }

        let titleWithDelimiter = (article.title+'.').replace(/([\?\!\.])\.$/, '$1');
        let title = hasMultipleParts
            ? `${titleWithDelimiter} ${partTitle}`
            : article.title;

        let params = {
            access_token,
            title,
            content: JSON.stringify(content)
        };

        let retries = 0;
        let MAX_RETRIES = 5;
        let saved = false;

        while (!saved && retries < MAX_RETRIES) {
            retries++;

            try {
                let response = await axios({
                    method: 'post',
                    url: 'https://api.telegra.ph/createPage',
                    data: qs.stringify(params),
                });

                if (!response.data.ok) {
                    throw new Error(response.data.error);
                }

                let publication = response.data.result;
                nextPartLink = publication.url;
                publications.unshift(publication);
                saved = true;
            }
            catch (e) {
                const EXTRA_PAUSE = 10;
                let isFlood = e.message && e.message.indexOf('FLOOD_WAIT') === 0;

                if (isFlood) {
                    let floodTimeout = parseInt(e.message.replace('FLOOD_WAIT_', ''));
                    await wait(floodTimeout * 1000);
                }

                await wait(EXTRA_PAUSE * 1000);
            }
        }

        if (!saved) {
            return false;
        }
    }

    return publications;
}

module.exports = {saveArticleToTelegraph}