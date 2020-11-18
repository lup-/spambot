const got = require('got');
const { JSDOM } = require("jsdom");
const Iconv = require('iconv').Iconv;

async function parseUrl(url, queries) {
    const response = await got(url, {responseType: 'buffer'});
    let html = response.body.toString();

    let charsetSearch = html.match(/\<meta[^>]*?charset=['"]*([a-zA-Z\-0-9]+)['"]/i);
    let charset = charsetSearch && charsetSearch[1] ? charsetSearch[1].toLowerCase() : 'utf-8';

    if (charset !== 'utf-8') {
        let conv = Iconv(charset, 'utf-8//ignore');
        html = conv.convert(response.body).toString();
    }

    const { document } = (new JSDOM(html, {contentType: 'text/html; charset=utf-8'})).window;

    let parsedData = {};

    for (const key in queries) {
        const selector = queries[key];

        if (typeof selector === 'function') {
            parsedData[key] = selector(document);
        }
        else {
            const el = document.querySelector(selector);
            parsedData[key] = el.innerHTML;
        }
    }

    return parsedData;
}

module.exports = {parseUrl}