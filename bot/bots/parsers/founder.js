const got = require('got');
const https = require('https');
const fs = require('fs');
const { JSDOM } = require("jsdom");
const {CookieJar} = require('tough-cookie');
const FormData = require('form-data');

const cookieJar = new CookieJar();
const FF_LOGIN = 'daderanetive@gmail.com';
const FF_PASSWORD = '123456789d';

const FF_LOGIN_URL = 'https://fastfounder.ru/wp-login.php';
const FF_ARTICLES_URL = 'https://fastfounder.ru/news'
const FF_PAGE_TEMPLATE_URL = 'https://fastfounder.ru/news/page/%num%/';

https.globalAgent.options.secureProtocol = 'TLSv1_2_method';
https.globalAgent.on('keylog', (line, tlsSocket) => {
    fs.appendFileSync(__dirname+'/ssl-keys.log', line);
});

async function auth() {
    const form = new FormData();
    form.append('log', FF_LOGIN);
    form.append('pwd', FF_PASSWORD);
    form.append('wp-submit', 'Войти');
    form.append('redirect_to', FF_ARTICLES_URL);

    try {
        let response = await got.post(FF_LOGIN_URL, {
            body: form,
            https: { rejectUnauthorized: false },
            headers: {'user-agent': `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.66 Safari/537.36`},
            cookieJar
        });
    }
    catch (e) {
        console.log(e);
    }

    return response;
}

async function fetchPage(pageNum) {
    let url = FF_PAGE_TEMPLATE_URL.replace('%num%', pageNum);

    const response = await got(url, {responseType: 'buffer'});
    let html = response.body.toString();

    const { document } = (new JSDOM(html, {contentType: 'text/html; charset=utf-8'})).window;
    return document;
}

(async () => {
    await auth();
    await fetchPage(1);
})();