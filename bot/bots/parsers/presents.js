const {parseUrl} = require('../helpers/parser');
const {getDb} = require('../../modules/Database');
const {capitalize} = require('../../modules/Helpers');
const moment = require('moment');

const CATALOG_URL = 'https://www.pichshop.ru/catalog/gift/';
const BASE_URL = 'https://www.pichshop.ru';
const NOW = moment().unix();

getDb().then(async () => {
    const db = await getDb();
    const presentsCollection = db.collection('presents');
    const categoriesCollection = db.collection('categories');

    let savedPresents = await presentsCollection.find({}).toArray();
    const addedIds = savedPresents.map(record => record.id);

    let {categories} = await parseUrl(CATALOG_URL, {
        categories: document => {
            let categoryEls = document.querySelectorAll('.catalog-categories li a');
            let categories = [];

            categoryEls.forEach(el => {
                categories.push({
                    title: capitalize(el.innerHTML.trim()),
                    url: BASE_URL+el.getAttribute('href'),
                })
            });

            return categories;
        }
    });

    let categoryTitles = categories.map(category => category.title);
    await db.collection('presents').updateMany({title: {$nin: categoryTitles}}, {$set: {disabled: NOW}});
    for (const category of categories) {
        await categoriesCollection.updateOne({title: category.title}, {$set: category}, {upsert: true});
    }

    /*let startFromCategory = '14 февраля';
    let categoryIndex = categories.findIndex(item => item.title === startFromCategory);
    categories.splice(0, categoryIndex);*/

    let allPresents = [];
    for (const category of categories) {
        console.log(category.title);
        let {lastUrl} = await parseUrl(category.url, {
            lastUrl: (document) => {
                let lastLink = document.querySelector('a.page-dots');
                if (!lastLink) {
                    let pageLinks = document.querySelectorAll('.pagin a[class=""]');
                    lastLink = pageLinks ? pageLinks[pageLinks.length-1] : false;
                }
                let lastUrl = lastLink ? BASE_URL+lastLink.getAttribute('href') : false;

                return lastUrl;
            }
        });

        let pageUrls = [category.url];
        if (lastUrl) {
            let [, maxPageNum] = lastUrl.match(/=(\d+)/i);
            let urlTemplate = lastUrl.replace(/=(\d+)/i, '=:page:');

            pageUrls = Array( parseInt(maxPageNum) ).fill(urlTemplate).map((url, index) => url.replace(':page:', index+1));
        }

        for (const pageUrl of pageUrls) {
            console.log(pageUrl);
            let {presents} = await parseUrl(pageUrl, {
                presents: document => {
                    let presentEls = document.querySelectorAll('div.product-card');
                    let presents = [];

                    presentEls.forEach(el => {
                        let descriptionEl = el.querySelector('meta[itemprop="description"]');
                        let description = descriptionEl ? descriptionEl.getAttribute('content') : false;
                        let id = el.getAttribute('scrollid');

                        if (addedIds.indexOf(id) === -1) {
                            let url = el.getAttribute('data-href');
                            if (url.indexOf('http') !== 0) {
                                url = BASE_URL + url;
                            }
                            url = url.replace(/^http:/i, 'https:');

                            presents.push({
                                id,
                                name: el.getAttribute('name'),
                                price: parseFloat(el.getAttribute('price')),
                                brand: el.getAttribute('brand'),
                                category: el.getAttribute('category').split('/').map(capitalize),
                                url,
                                image: el.getAttribute('data-image').replace(/^\/\//, 'https://').replace(/^http:/i, 'https:'),
                                description
                            });

                            addedIds.push(id);
                        }
                    });

                    return presents;
                }
            });

            if (presents && presents.length > 0) {
                allPresents = allPresents.concat(presents);
            }
        }

    }

    if (allPresents && allPresents.length > 0) {
        let presentIds = allPresents.map(present => present.id);
        await db.collection('presents').updateMany({id: {$nin: presentIds}}, {$set: {disabled: NOW}});
        for (const present of allPresents) {
            await db.collection('presents').updateOne({id: present.id}, {$set: present});
        }
    }

});