const {parseUrl} = require('../helpers/parser');
const {getDb} = require('../../modules/Database');
const {trimHTML} = require('../../modules/Helpers');

const CATALOG_URL = 'https://health.mail.ru/disease/';
const BASE_URL = 'https://health.mail.ru';

getDb().then(async (db) => {
    const diseasesCollection = db.collection('diseases');
    const categoriesCollection = db.collection('categories');

    let savedCategories = await categoriesCollection.find({}).toArray();
    let savedDiseases = await diseasesCollection.find({}).toArray();

    const addedDiseases = savedDiseases.map(record => record.name);
    const addedCategories = savedCategories.map(record => record.title);

    let {categories, diseasesUrls} = await parseUrl(CATALOG_URL, {
        categories: document => {
            let categoryEls = document.querySelectorAll('.catalog__rubric');
            let categories = [];

            categoryEls.forEach(el => {
                let titleEl = el.querySelector('.catalog__rubric__title');
                let title = titleEl ? titleEl.innerHTML.trim() : false;

                if (title && addedCategories.indexOf(title) === -1) {
                    categories.push({
                        title,
                        url: titleEl ? BASE_URL + titleEl.getAttribute('href') : false,
                    })
                }
            });

            return categories;
        },
        diseasesUrls: document => {
            let categoryEls = document.querySelectorAll('.catalog__rubric');
            let diseases = [];

            categoryEls.forEach(categoryEl => {
                let categoryTitleEl = categoryEl.querySelector('.catalog__rubric__title');
                let categoryTitle = categoryTitleEl ? categoryTitleEl.innerHTML.trim() : false;

                let diseaseEls = categoryEl.querySelectorAll('.catalog__item');
                diseaseEls.forEach(el => {
                    let titleEl = el.querySelector('.catalog__item__title');
                    let name = titleEl ? titleEl.innerHTML.trim() : false;

                    if (name && addedDiseases.indexOf(name) === -1) {
                        diseases.push({
                            name,
                            url: titleEl ? BASE_URL+el.getAttribute('href') : false,
                            categoryTitle,
                        });
                    }
                });
            });

            return diseases;
        }
    });

    if (categories && categories.length > 0) {
        await categoriesCollection.insertMany(categories);
    }

    for (const diseaseRecord of diseasesUrls) {
        console.log(diseaseRecord.name);
        let disease = await parseUrl(diseaseRecord.url, {
            name: '.page-info__title',
            definition: '.page-info__lead',
            articleItems: document => {
                let itemEls = document.querySelectorAll('.article__item:not(.article__item_teaser)');
                let articleItems = [];

                let itemTitle = false;
                let itemText = '';

                itemEls.forEach(el => {
                    let titleEl = el.querySelector('h2');
                    if (titleEl) {
                        if (itemTitle) {
                            articleItems.push({title: itemTitle, text: itemText});
                            itemTitle = false;
                            itemText = '';
                        }

                        itemTitle = titleEl.innerHTML.trim();
                    }
                    else {
                        let html = el.innerHTML;
                        let text = trimHTML(html);

                        itemText += itemText ? '\n\n' + text : text;
                    }
                });

                if (itemTitle && itemText) {
                    articleItems.push({title: itemTitle, text: itemText});
                }

                return articleItems;
            }
        });

        disease.definition = trimHTML(disease.definition);
        disease.url = diseaseRecord.url;
        disease.category = diseaseRecord.categoryTitle;
        await diseasesCollection.findOneAndReplace({name: disease.name}, disease, {upsert: true, returnOriginal: false});
    }

});