//require('debugging-aid/network');

const got = require('got');
const {getDb} = require('../../modules/Database');
const { JSDOM } = require("jsdom");
const {CookieJar} = require('tough-cookie');
const FormData = require('form-data');

const FF_LOGIN = 'daderanetive@gmail.com';
const FF_PASSWORD = '123456789d';

const FF_BASE = 'https://fastfounder.ru';
const FF_LOGIN_URL = 'https://fastfounder.ru/wp-login.php';
const FF_ARTICLES_URL = 'https://fastfounder.ru/news'
const FF_PAGE_TEMPLATE_URL = 'https://fastfounder.ru/news/page/%num%/';

const cookieJar = new CookieJar();

async function auth() {
    const form = new FormData();
    form.append('log', FF_LOGIN);
    form.append('pwd', FF_PASSWORD);
    form.append('wp-submit', 'Войти');
    form.append('redirect_to', FF_ARTICLES_URL);
    form.append('testcookie', '1');

    let response;
    try {
        response = await got(FF_LOGIN_URL, {cookieJar});
        response = await got.post(FF_LOGIN_URL, {
            body: form,
            followRedirect: false,
            cookieJar
        });
    }
    catch (e) {
        console.log(e);
    }

    return response;
}
async function fetchUrl(url) {
    const response = await got(url, {
        responseType: 'buffer',
        cookieJar
    });
    let html = response.body.toString();

    const { document } = (new JSDOM(html, {contentType: 'text/html; charset=utf-8'})).window;
    return document;
}
async function fetchPage(pageNum = false) {
    let url = pageNum
        ? FF_PAGE_TEMPLATE_URL.replace('%num%', pageNum)
        : FF_ARTICLES_URL;
    return fetchUrl(url);
}

function parseArticles(document) {
    let articlesEls = document.querySelectorAll('.article');
    let articles = [];

    for (const articleEl of articlesEls) {
        let headerEl = articleEl.querySelector('.entry-title');
        let coverImgEl = articleEl.querySelector('.coverimg img');
        let badgeSumEl = articleEl.querySelector('.badge .fst');
        let badgeTypeEl = articleEl.querySelector('.badgetype');
        let articleUrlEl = articleEl.querySelector('.post-thumbnail a');
        let dateEl = articleEl.querySelector('.after-entry .post_date');
        let categoryUrlEl = articleEl.querySelector('a[href*="category"]');
        let tagEls = articleEl.querySelectorAll('a[rel="tag"]');

        let coverUrl = coverImgEl ? coverImgEl.getAttribute('src') : null;
        if (coverUrl.indexOf('http') !== 0) {
            coverUrl = FF_BASE + coverUrl;
        }

        let articleUrl = articleUrlEl ? articleUrlEl.getAttribute('href') : null;
        if (articleUrl.indexOf('http') !== 0) {
            articleUrl = FF_BASE + articleUrl;
        }

        let [,slug] = articleUrl.match(/.*\/([^\/]+)\/*$/i);

        let tags = [];
        tagEls.forEach(tagEl => tags.push(tagEl.innerHTML));

        let article = {
            slug,
            datePosted: dateEl ? dateEl.innerHTML.trim() : null,
            title: headerEl ? headerEl.innerHTML.trim() : null,
            cover: coverUrl,
            actionSum: badgeSumEl ? badgeSumEl.innerHTML.trim() : null,
            actionType: badgeTypeEl ? badgeTypeEl.innerHTML.trim() : null,
            url: articleUrl,
            category: categoryUrlEl ? categoryUrlEl.innerHTML.trim() : null,
            tags
        }

        articles.push(article);
    }

    return articles;
}
async function getPageCountAndLastArticles() {
    let document = await fetchPage();
    let lastPageLink = document.querySelector('.dots + a.page-numbers');
    let totalPages = parseInt( lastPageLink.innerHTML.replace(/.*>/, '') );
    let articles = parseArticles(document);
    return {totalPages, articles};
}
async function parseArticleContent(articleUrl) {
    let document = await fetchUrl(articleUrl);
    let contentEl = document.querySelector('.entry-content');

    let blocks = [];
    let currentTitle = false;
    let facts;
    let currentText = [];
    let currentImages = [];

    for (const child of contentEl.children) {
        let tagName = child.tagName;

        switch (tagName) {
            case 'H2':
                if (currentText.length !== 0) {
                    blocks.push({
                        title: currentTitle,
                        text: currentText,
                        images: currentImages,
                    });
                }

                currentTitle = child.innerHTML.trim();
                currentText = [];
                currentImages = [];
                break;
            case 'FIGURE':
                let imgEl = child.querySelector('img');
                if (imgEl) {
                    currentImages.push(imgEl.getAttribute('src'));
                }
                break;
            case 'UL':
                let factEls = child.querySelectorAll('li');
                facts = [];
                factEls.forEach(factEl => facts.push( factEl.innerHTML.trim() ));
            case 'BUTTON':
            case 'NAV':
            case 'DIV':
                break;
            default:
                currentText.push( child.outerHTML );
                break;
        }
    }

    if (currentText.length !== 0) {
        blocks.push({
            title: currentTitle,
            text: currentText,
            images: currentImages,
        });
    }

    let stopwords = ['fastfounder', 'mailto', 'javascript', 'temnografika', '#respond', '#comment'];
    let linkEls = contentEl.querySelectorAll('a');
    let links = [];
    linkEls.forEach(linkEl => links.push( linkEl.getAttribute('href').toLowerCase().trim() ));
    links = links
        .filter((link, index, links) => links.indexOf(link) === index && link.length > 0)
        .filter(link => stopwords.reduce((result, word) => result && link.indexOf(word) === -1, true));

    return {blocks, facts, links};
}
async function parseAllBriefs() {
    let {totalPages, articles} = await getPageCountAndLastArticles();

    for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
        let page = await fetchPage(pageNum);
        let pageArticles = parseArticles(page);
        articles = articles.concat(pageArticles);
    }

    return articles;
}

getDb().then(async (db) => {
    let articleCollection = db.collection('articles');
    let savedArticles = await articleCollection.find({}).toArray();

    if (savedArticles.length === 0) {
        let allArticles = await parseAllBriefs();
        await articleCollection.insert(allArticles);
        savedArticles = await articleCollection.find({}).toArray();
    }

    let allFullSlugs = savedArticles.filter(article => article.blocks && article.blocks.length > 0).map(article => article.slug);
    let {totalPages, articles} = await getPageCountAndLastArticles();
    let newArticles;
    let pageNum = 1;
    let allArticlesNew;
    let anyArticleNew;

    await auth();
    do {
        newArticles = articles.filter( article => allFullSlugs.indexOf(article.slug) === -1 );
        anyArticleNew = newArticles.length > 0;
        allArticlesNew = newArticles.length === articles.length;
        for (let newArticle of newArticles) {
            console.log(newArticle.title, newArticle.url);
            let extra = await parseArticleContent(newArticle.url);
            newArticle = Object.assign(newArticle, extra);
            await articleCollection.findOneAndReplace({slug: newArticle.slug}, newArticle);
        }
        pageNum++;
        if (pageNum < totalPages) {
            let page = await fetchPage(pageNum);
            articles = parseArticles(page);
        }
    } while (anyArticleNew && pageNum <= totalPages);
});