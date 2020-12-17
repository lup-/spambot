const moment = require('moment');
const {getDb} = require('../../modules/Database');
const {parseUrl} = require('../helpers/parser');
const {trimHTML} = require('../../modules/Helpers');
const {saveArticleToTelegraph} = require('./saveToTelegraph');

const BASE_URL = 'https://businessmens.ru';
const CATLOG_URL = 'https://businessmens.ru/category/idea';

async function parsePageBriefsAndNextPage(pageNum = false) {
    let url = pageNum
        ? CATLOG_URL + '?page=' + pageNum
        : CATLOG_URL;

    return parseUrl(url, {
        briefs(document) {
            let ideaEls = document.querySelectorAll('.idea-item');

            let briefs = [];
            ideaEls.forEach(ideaEl => {
                let titleLinkEl = ideaEl.querySelector('.idea-item__title');
                let descriptionEl = ideaEl.querySelector('.idea-item__preview');
                let viewsEl = ideaEl.querySelector('.idea-item__views');
                let commentsEl = ideaEl.querySelector('.idea-item__comments');
                let imgEl = ideaEl.querySelector('.idea-item__image img');
                let categoryEl = ideaEl.querySelector('.idea-item__category');

                let href = titleLinkEl.getAttribute('href').trim();
                let slug = href.replace("/article/", '').replace(/\//g, '');

                briefs.push({
                    source: 'bm',
                    title: trimHTML(titleLinkEl.innerHTML.trim()),
                    slug,
                    url: BASE_URL + href,
                    description: trimHTML(descriptionEl.innerHTML.trim()),
                    cover: imgEl.getAttribute('data-src'),
                    category: categoryEl.innerHTML.trim(),
                    views: viewsEl ? parseInt( viewsEl.innerHTML.trim().replace(/.* /, '') ) : 0,
                    comments: commentsEl ? parseInt( commentsEl.innerHTML.trim().replace(/.* /, '') ) : 0,
                })
            });

            return briefs;
        },
        nextUrl(document) {
            let nextEl = document.querySelector('.next a');
            let link = nextEl ? nextEl.getAttribute('href').trim() : false;

            if (link) {
                return BASE_URL + link;
            }

            return false;
        }
    });
}
async function parseArticleContent(url) {
    return parseUrl(url, {
        datePosted(document) {
            let dateEl = document.querySelector('.article-date');
            if (!dateEl) {
                return false;
            }

            let dateStr = dateEl.innerHTML.trim();
            let date = moment(dateStr, 'DD MMMM YYYY', 'ru');
            return date.format('DD.MM.YYYY');
        },
        blocks(document) {
            let contentEl = document.querySelector('.article-content');

            let blocks = [];
            let currentTitle = false;
            let currentSubtitle = false;
            let currentText = [];
            let currentImages = [];
            let currentVideos = [];

            for (const child of contentEl.children) {
                let tagName = child.tagName;

                switch (tagName) {
                    case 'H3':
                    case 'H2':
                        if (currentText.length !== 0) {
                            blocks.push({
                                title: currentTitle,
                                subtitle: currentSubtitle,
                                text: currentText,
                                images: currentImages,
                                videos: currentVideos,
                            });
                        }

                        if (tagName === 'H2' || !currentTitle) {
                            currentTitle = child.innerHTML.trim();
                            currentSubtitle = false;
                        }
                        else {
                            currentSubtitle = child.innerHTML.trim();
                        }

                        currentText = [];
                        currentImages = [];
                        currentVideos = [];

                        break;
                    case 'P':
                        let imgEl = child.querySelector('img');
                        let ytEl = child.querySelector('.youtube');

                        if (ytEl) {
                            currentVideos.push( ytEl.getAttribute('data-youtube') )
                        }
                        else if (imgEl) {
                            currentImages.push(imgEl.getAttribute('data-src'));
                        }
                        else {
                            currentText.push( child.outerHTML );
                        }
                        break;
                    default:
                        currentText.push( child.outerHTML );
                        break;
                }
            }

            if (currentText.length !== 0) {
                blocks.push({
                    title: currentTitle,
                    subtitle: currentSubtitle,
                    text: currentText,
                    images: currentImages,
                    videos: currentVideos,
                });
            }

            return blocks;
        }
    })
}
async function parseNewBMArticles(progress = false) {
    let db = await getDb();
    let articles = db.collection('articles');
    let savedArticles = await articles.find({}).toArray();
    let allSlugs = savedArticles.map(article => article.slug);

    let anyBriefNew;
    let nextPageUrl;
    let pageNum = false;

    do {
        let {briefs, nextUrl} = await parsePageBriefsAndNextPage(pageNum);
        let newBriefs = briefs.filter( brief => allSlugs.indexOf(brief.slug) === -1 );
        anyBriefNew = newBriefs.length > 0;

        nextPageUrl = nextUrl;
        if (nextPageUrl) {
            pageNum = nextPageUrl.replace(/.*\?page=/i,'');
        }

        for (let brief of newBriefs) {
            if (progress) {
                console.log(brief.title, brief.url);
            }
            let content = await parseArticleContent(brief.url);
            let article = Object.assign(brief, content);
            let telegraphPublications = await saveArticleToTelegraph(article);

            if (telegraphPublications) {
                article.publications = telegraphPublications;
                article.viewLink = telegraphPublications[0].url;
            }

            await articles.findOneAndReplace({slug: article.slug}, article, {upsert: true});
        }
    } while (anyBriefNew && nextPageUrl);
}

(async () => {
    if (process.env.PARSER === '1') {
        await parseNewBMArticles(true);
        console.log('Готово');
    }
})();

module.exports = {parseNewBMArticles};