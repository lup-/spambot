const {parseUrl} = require('../helpers/parser');
const {getDb} = require('../../modules/Database');
const {trimHTML} = require('../../modules/Helpers');
const shortid = require('shortid');
const inquirer = require('inquirer');

const BASE_URL = 'https://journal.tinkoff.ru';
const CATALOG_URL = 'https://journal.tinkoff.ru/selected/';

function getTags() {
    return ['Про быт', 'Для бизнеса', 'Про работу', 'Про накопления', 'Больше получать', 'Меньше тратить'];
}
async function parseCategories() {
    let {categories} = await parseUrl(CATALOG_URL, {
        categories(document) {
            let categoryEls = document.querySelectorAll('article.card');
            let categories = [];

            categoryEls.forEach(categoryEl => {
                let linkEl = categoryEl.querySelector('a.card__link');
                let imgEl = categoryEl.querySelector('.card__image img');

                categories.push({
                    title: trimHTML(linkEl.innerHTML),
                    link: BASE_URL+linkEl.getAttribute('href'),
                    image: imgEl ? imgEl.getAttribute('data-src') : false,
                });
            });

            return categories;
        }
    });

    return categories;
}
async function parseCategoriesWithTags() {
    let categories = await parseCategories();
    let tags = getTags();
    let db = await getDb();
    let categoryCollection = db.collection('categories');

    for (let category of categories) {
        let question = {
            name: 'tags',
            type: 'checkbox',
            message: category.title,
            choices: tags
        };

        let answer = await inquirer.prompt([question]);
        category.tags = answer.tags;
        await categoryCollection.insertOne(category);
    }
}
async function loadCategories() {
    let db = await getDb();
    let categories = db.collection('categories');
    return categories.find({tags: { $exists: true, $not: {$size: 0} } }).toArray();
}
async function parseArticleLinks(listUrl) {
    let {list} = await parseUrl(listUrl, {
        list(document) {
            let articleEls = document.querySelectorAll('a.serp-item__link');

            let articles = [];
            articleEls.forEach(articleEl => {
                articles.push({
                    title: trimHTML(articleEl.innerHTML.trim()),
                    link: BASE_URL+articleEl.getAttribute('href')
                });
            });

            return articles;
        }
    });

    return list;
}
async function parseArticle(articleUrl) {
    let {params, title, subtitle, image, description} = await parseUrl(articleUrl, {
        params(document) {
            let paramsEl = document.querySelector('.article-header__meta [data-component-name]');
            if (paramsEl) {
                let jsonParams = paramsEl.getAttribute('data-component-data');
                return JSON.parse(jsonParams);
            }

            return false;
        },
        title(document) {
            let titleEl = document.querySelector('.article-header__title');
            if (titleEl) {
                return trimHTML(titleEl.innerHTML);
            }

            return false;
        },
        subtitle(document) {
            let subtitleEl = document.querySelector('.article-header__subtitle');
            if (subtitleEl) {
                return trimHTML(subtitleEl.innerHTML);
            }

            return false;
        },
        image(document) {
            let imageEl = document.querySelector('meta[property="og:image"]');
            if (imageEl) {
                return imageEl.getAttribute('content');
            }

            return false;
        },
        description(document) {
            let descrEl = document.querySelector('meta[name="description"]');
            if (descrEl) {
                return descrEl.getAttribute('content');
            }

            return false;
        },
    });

    return {title, subtitle, date: params.date, image, description, stats: params.stats, slug: params.slug, link: articleUrl};
}
async function parseAllArticles() {
    let db = await getDb();
    let articles = db.collection('articles');

    let categories = await loadCategories();
    for (const category of categories) {
        let articleLinks = await parseArticleLinks(category.link);
        for (const articleLink of articleLinks) {
            console.log(articleLink.title);
            let savedArticle = await articles.findOne({link: articleLink});

            if (savedArticle) {
                delete savedArticle._id;
                savedArticle.categories.push(category);
                savedArticle.tags = savedArticle.tags.concat(category.tags).filter((tag, index, tags) => tags.indexOf(tag) === index);
                await articles.findOneAndReplace({id: savedArticle.id}, savedArticle);
            }
            else {
                let article = await parseArticle(articleLink.link);
                article.id = shortid();
                article.tags = category.tags
                article.categories = [category];
                await articles.insertOne(article);
            }

        }
    }
}
async function parseNewArticles() {
    let db = await getDb();
    let articles = db.collection('articles');
    let allArticles = await articles.find({}).toArray();
    let categories = await loadCategories();

    let newArticles = [];
    for (const category of categories) {
        let articleLinks = await parseArticleLinks(category.link);
        let newArticleLinks = articleLinks.filter( articleLink => allArticles.findIndex(article => article.link === articleLink.link) === -1 );
        for (const articleLink of newArticleLinks) {
            let alreadyParsedArticle = newArticles.find(article => article.link === articleLink.link);

            if (alreadyParsedArticle) {
                let articleIndex = newArticles.findIndex(article => article.link === articleLink.link);
                delete alreadyParsedArticle._id;
                alreadyParsedArticle.categories.push(category);
                alreadyParsedArticle.tags = alreadyParsedArticle.tags.concat(category.tags).filter((tag, index, tags) => tags.indexOf(tag) === index);
                let updateResult = await articles.findOneAndReplace({id: alreadyParsedArticle.id}, alreadyParsedArticle);
                newArticles[articleIndex] = updateResult.value;
            }
            else {
                let article = await parseArticle(articleLink.link);
                article.id = shortid();
                article.tags = category.tags
                article.categories = [category];
                let insertResult = await articles.insertOne(article);
                newArticles.push(insertResult.ops[0]);
            }
        }
    }

    return newArticles;
}

// (async () => {
//     let newArticles = await parseNewArticles();
// })();

module.exports = {parseNewArticles, parseAllArticles, getTags};