const axios = require('axios');
const FormData = require('form-data');
const {parseStream: csvParse} = require('@fast-csv/parse');
const moment = require('moment');
const {getDb} = require('../modules/Database');

const CLIENT_ID = process.env.ADMITAD_CLIENT_ID;
const CLIENT_SECRET = process.env.ADMITAD_CLIENT_SECRET;
const PAGE_LIMIT = 50;

class AdmitadApi {
    constructor(clientId, clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.authData = false;
        this.website = false;
    }

    async auth() {
        let scopes = [
            'public_data',
            'websites',
            'coupons',
            'coupons_for_website',
            'banners',
            'banners_for_website',
            'advcampaigns', 'advcampaigns_for_website', 'manage_advcampaigns',
            'deeplink_generator'
        ];

        let authParams = new FormData;
        authParams.append('client_id', this.clientId);
        authParams.append('scope', scopes.join(' '));
        authParams.append('grant_type', 'client_credentials');

        try {
            let response = await axios.post('https://api.admitad.com/token/', authParams, {
                headers: authParams.getHeaders(),
                auth: {
                    username: this.clientId,
                    password: this.clientSecret
                }
            });
            this.authData = response.data;
        }
        catch(e) {
            return this.auth();
        }

        return this.authData;
    }
    async getToken() {
        if (!this.authData) {
            await this.auth();
        }
        return this.authData.access_token;
    }
    async getWebsite() {
        if (this.website) {
            return this.website;
        }

        let token = await this.getToken();
        let response = await axios.get('https://api.admitad.com/websites/v2/', {
            headers: {'Authorization': `Bearer ${token}`},
        });

        let activeWebsites = response.data.filter(website => website.status === 'active');
        this.website = activeWebsites.length > 0 ? activeWebsites[0] : false;
        return this.website;
    }

    async getAdvCampaigns(filter = {}, website = false, offset = 0) {
        let token = await this.getToken();

        if (!filter) {
            filter = {};
        }

        filter.limit = PAGE_LIMIT;
        filter.offset = offset;

        let baseUrl = website
            ? `https://api.admitad.com/advcampaigns/website/${website.id}/`
            : 'https://api.admitad.com/advcampaigns/';
        let {data} = await axios.get(baseUrl, {
            headers: {'Authorization': `Bearer ${token}`},
            params: filter
        });

        let campaigns = data.results;
        let isPage = offset > 0;
        if (isPage) {
            return campaigns;
        }

        let hasPages = data._meta.count > data._meta.limit;
        if (hasPages) {
            let pageCount = Math.ceil(data._meta.count / data._meta.limit);
            for (let page = 1; page < pageCount; page++) {
                let nextPageCampaigns = await this.getAdvCampaigns(filter, website, page * PAGE_LIMIT);
                campaigns = campaigns.concat(nextPageCampaigns);
            }
        }

        return campaigns;
    }
    async getConnectedCampaigns(filter = {connection_status: 'active'}) {
        let website = await this.getWebsite();
        return this.getAdvCampaigns(filter, website);
    }

    async getAllCouponCampaigns() {
        return this.getAdvCampaigns({has_tool: 'coupons'});
    }
    async getAllProductCampaigns() {
        return this.getAdvCampaigns({has_tool: 'products'});
    }
    async getNewCampaigns(excludeIds = []) {
        let couponCampaigns = await this.getAllCouponCampaigns();
        let productCampaigns = await this.getAllProductCampaigns();

        let allCampaigns = couponCampaigns.concat(productCampaigns);
        let allIds = allCampaigns.map(campaign => campaign.id);
        let uniqueCampaigns = allCampaigns.filter( (campaign, index) => allIds.indexOf(campaign.id) === index );

        let campaignsToConnect = uniqueCampaigns
            .filter( ({connected}) => !connected )
            .filter( ({id}) => excludeIds.indexOf(id) === -1 )
            .filter( ({status}) => status === 'active' )
            .filter( ({rate_of_approve}) => parseInt(rate_of_approve) > 60 )
            .filter( ({regions}) => regions.filter(region => ['ru', 'ua', 'kz', 'by'].indexOf( region.region.toLowerCase() ) !== -1).length > 0 );
        return campaignsToConnect;
    }
    async connectAdvCampaign(campaign) {
        let token = await this.getToken();
        let website = await this.getWebsite();

        let campaignId = campaign.id;
        let websiteId = website.id;

        if (campaignId && websiteId) {
            try {
                let response = await axios.post(`https://api.admitad.com/advcampaigns/${campaignId}/attach/${websiteId}/`, null,{
                    headers: {'Authorization': `Bearer ${token}`}
                });
                return response.data && response.data.success && response.data.success === 'OK';
            }
            catch (e) {
                return false;
            }
        }

        return false;
    }
    async connectManyCampaigns(campaigns) {
        let connected = [];
        let notConnected = [];
        for (const campaign of campaigns) {
            let result = await this.connectAdvCampaign(campaign);
            if (result) {
                connected.push(campaign.id);
            }
            else {
                notConnected.push(campaign.id);
            }
        }

        return {connected, notConnected};
    }

    async getDiscountProducts(campaign, feedIndex = 0) {
        let hasFeed = Boolean(campaign.feeds_info && campaign.feeds_info[feedIndex]);
        if (!hasFeed) {
            return [];
        }

        let csvLink = campaign.feeds_info[feedIndex].csv_link;
        if (!csvLink) {
            return [];
        }

        try {
            let productsWithDiscount = [];
            console.log(`Загрузка ${csvLink}...`);
            let {data: csvStream} = await axios.get(csvLink, {responseType: 'stream'});

            return new Promise((resolve, reject) => {
                csvParse(csvStream, {delimiter: ';', headers: true})
                    .on('error', e => false)
                    .on('data', row => {
                        if (row && row.oldprice) {
                            productsWithDiscount.push(row);
                        }
                    })
                    .on('error', e => reject(e))
                    .on('end', () => resolve(productsWithDiscount));
            });
        }
        catch (e) {
            console.log('Ошибка: ' + e.toString());
            return false;
        }
    }
    async getCoupons(offset = 0) {
        let token = await this.getToken();
        let website = await this.getWebsite();
        let limit = PAGE_LIMIT;

        let response = await axios.get(`https://api.admitad.com/coupons/website/${website.id}/`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
                order_by: '-rating',
                limit,
                offset
            }
        });

        let coupons = response.data.results;
        let isPage = offset > 0;
        if (isPage) {
            return coupons;
        }

        let hasPages = response.data._meta.count > response.data._meta.limit;
        if (hasPages) {
            let pageCount = Math.ceil(response.data._meta.count / response.data._meta.limit);
            for (let page = 1; page < pageCount; page++) {
                let nextPageCoupons = await this.getCoupons( page * PAGE_LIMIT);
                coupons = coupons.concat(nextPageCoupons);
            }
        }

        return coupons.filter(coupon => typeof(coupon) !== 'undefined');
    }

}

module.exports = function () {
    const admitad = new AdmitadApi(CLIENT_ID, CLIENT_SECRET);

    return {
        async saveCampaign(admitadCampaign) {
            let db = await getDb();

            let savedCampaign = {
                id: admitadCampaign.id,
                name: admitadCampaign.name,
                lastRefresh: moment().unix(),
                active: admitadCampaign.status === 'active' && admitadCampaign.connection_status === 'active',
                pending: admitadCampaign.status === 'active' && admitadCampaign.connection_status === 'pending',
                declined: admitadCampaign.status === 'active' && admitadCampaign.connection_status === 'declined',
                expired: admitadCampaign.status !== 'active',
                hasProducts: admitadCampaign && admitadCampaign.products_csv_link  && admitadCampaign.products_csv_link.length > 0,
                admitadCampaign
            }

            return db.collection('campaigns').updateOne({id: savedCampaign.id}, {
                $set: savedCampaign,
                $setOnInsert: {created: moment().unix()}
            }, {upsert: true});
        },
        async updateAllCampaigns() {
            console.log('Обновление списка кампаний...');
            let connectedCampaigns = await admitad.getConnectedCampaigns({});
            for (const admitadCampaign of connectedCampaigns) {
                await this.saveCampaign(admitadCampaign);
            }
        },
        async connectNewCampaigns() {
            console.log('Поиск новых кампаний...');
            let db = await getDb();
            let savedCampaigns = await db.collection('campaigns').find({}).toArray();
            let excludeIds = savedCampaigns.map(campaign => campaign.id);

            let newCampaigns = await admitad.getNewCampaigns(excludeIds);
            if (newCampaigns && newCampaigns.length > 0) {
                console.log('Найдено новых кампаний: ', newCampaigns.length);
                return admitad.connectManyCampaigns(newCampaigns);
            }

            return false;
        },
        async updateCampaignProducts(campaign, lastSavedUpdate = 0) {
            let csvLink = campaign.products_csv_link;
            let feedIndex = campaign.feeds_info
                ? campaign.feeds_info.findIndex(feed => feed.csv_link === csvLink)
                : -1;

            if (feedIndex === -1) {
                return false;
            }

            let feed = campaign.feeds_info[feedIndex];
            let lastFeedUpdate = moment(feed.advertiser_last_update).unix();
            let needsUpdate = lastSavedUpdate === 0 || lastFeedUpdate < lastSavedUpdate;
            if (!needsUpdate) {
                return false;
            }

            try {
                let products = await admitad.getDiscountProducts(campaign, feedIndex);
                if (!products) {
                    return false;
                }

                let transformedProducts = products.map(rawProduct => {
                    let price = parseFloat(rawProduct.price);
                    let oldPrice = parseFloat(rawProduct.oldprice);
                    return {
                        id: rawProduct.id,
                        name: rawProduct.name,
                        campaignId: campaign.id,
                        available: rawProduct.available === 'true',
                        lastUpdated: moment().unix(),
                        price,
                        oldPrice,
                        delivery: rawProduct.local_delivery_cost ? parseFloat(rawProduct.local_delivery_cost) : 0,
                        discount: Math.round( (oldPrice-price)/oldPrice * 100 ),
                        image: rawProduct.picture,
                        url: rawProduct.url,
                        rawProduct
                    };
                });

                console.log('Продукты загружены: ', products !== false);
                if (products && products.length > 0) {
                    console.log(`Продуктов загружено: ${products.length}`);
                    let db = await getDb();
                    await db.collection('products').createIndex({id: 1, available: 1, campaignId: 1, discount: 1});
                    await db.collection('products').updateMany({campaignId: campaign.id}, {$set: {available: false}});
                    let bulkOperations = transformedProducts.map(product => ({
                        updateOne: {
                            filter: {campaignId: campaign.id, id: product.id},
                            update: {
                                $set: product,
                                $setOnInsert: {created: moment().unix()}
                            },
                            upsert: true,
                        }
                    }));
                    let result = await db.collection('products').bulkWrite(bulkOperations);
                    console.log(`Продукты сохраненты: `, result && result.result && result.result.ok === 1);
                    return result && result.result && result.result.ok === 1;
                }

                return products !== false;
            }
            catch (e) {
                console.error('Ошибка: ', e.toString());
                return false;
            }
        },
        async updateAllProducts() {
            return new Promise(async (resolve) => {
                setTimeout(async () => {

                    let db = await getDb();
                    let savedCampaigns = await db.collection('campaigns').find({}).toArray();

                    for (let campaign of savedCampaigns) {
                        if (!campaign.hasProducts) {
                            continue;
                        }

                        try {
                            let lastSavedUpdate = campaign.lastProductsUpdate || 0;
                            let updateSuccessful = await this.updateCampaignProducts(campaign.admitadCampaign, lastSavedUpdate);
                            if (updateSuccessful) {
                                await db.collection('campaigns').updateOne({id: campaign.id}, {$set: {lastProductsUpdate: moment().unix()}});
                            }
                        }
                        catch (e) {}
                    }

                    resolve();
                }, 0);
            });
        },
        async updateAllCoupons() {
            console.log('Обновление купонов...');
            let db = await getDb();
            let coupons = await admitad.getCoupons();
            let transformedCoupons = coupons.map(rawCoupon => ({
                id: rawCoupon.id,
                active: rawCoupon.status === 'active',
                lastUpdated: moment().unix(),
                campaignId: rawCoupon.campaign.id,
                start: rawCoupon.date_start ? moment(rawCoupon.date_start).unix() : null,
                end: rawCoupon.date_end ? moment(rawCoupon.date_end).unix() : null,
                discount: rawCoupon.discount && rawCoupon.discount.indexOf('%') !== -1 ? parseInt(rawCoupon.discount.replace(/[^\d]/gi, '')) : null,
                image: rawCoupon.image,
                url: rawCoupon.goto_link,
                rawCoupon
            }));

            let bulkOperations = transformedCoupons.map(coupon => ({
                updateOne: {
                    filter: {id: coupon.id},
                    update: {
                        $set: coupon,
                        $setOnInsert: {created: moment().unix()}
                    },
                    upsert: true,
                }
            }));
            await db.collection('coupons').updateMany({}, {$set: {active: false}});
            let result = await db.collection('coupons').bulkWrite(bulkOperations);
            console.log('Обновлено купонов: ', transformedCoupons.length, result && result.result && result.result.ok === 1);
            return result && result.result && result.result.ok === 1;
        },
        async getCatalogCategories() {
            let db = await getDb();
            let rawCategories = await db.collection('campaigns').aggregate([
                { $unwind: "$admitadCampaign.categories" },
                { $replaceRoot: {newRoot: "$admitadCampaign.categories"} },
                { $group: {"_id": "$id", "parent": {$first: "$parent.id"}, "name": {$first: "$name"}, "language": {$first: "$language"}, "count": {$sum: 1}} },
                { $sort: {"_id": 1} }
            ]).toArray();

            let topLevel = rawCategories
                .filter(category => category.parent === null)
                .map(topCategory => {
                    let children = rawCategories
                        .filter(category => category.parent === topCategory._id)
                        .map(child => ({id: child._id.toString(), title: child.name}));

                    return children && children.length > 0
                        ? {id: topCategory._id.toString(), title: topCategory.name, children}
                        : {id: topCategory._id.toString(), title: topCategory.name};
                });

            return topLevel;
        },
        async getSuitableCampaigns(categories, region = 'ru', queryExtra = {}) {
            let categoryIds = categories.map(id => parseInt(id));
            let query = {
                active: true,
                "admitadCampaign.regions.region": region.toUpperCase(),
            };

            if (categories && categories.length > 0) {
                query["admitadCampaign.categories.id"] = {$in: categoryIds};
            }

            query = Object.assign(query, queryExtra);

            let db = await getDb();
            return db.collection('campaigns').find(query).toArray();
        },
        getMaxDiscountRange(min, max, totalScore, isDouble) {
            if (!min) {
                min = 0;
            }

            if (!max) {
                max = 100;
            }

            let avg = (min + max)/2;
            if (isDouble) {
                min = avg;
            }
            else {
                max = avg;
            }

            let maxTotalScore = 12;
            let maxScore = min + ( (max-min)/maxTotalScore * totalScore );
            let minScore = min + ( (max-min)/maxTotalScore * (totalScore-1) );
            return {maxScore, minScore};
        },
        getMaxDiscountRangeEqualDistribution(allValues, totalScore, isDouble) {
            let scoreCount = (12 - 2) + 1;
            let doublesCount = 6;
            let intervalsCount = scoreCount + doublesCount;
            let minNumber = Math.min.apply(null, allValues);
            let maxNumber = Math.max.apply(null, allValues);

            let numbersPerInterval = Math.floor(allValues.length / intervalsCount);
            let fromNumber = minNumber;
            let totalNumbersInAllPreviousIntervals = 0;
            let intervals = [];

            for (let currentNumber = minNumber; currentNumber <= maxNumber; currentNumber += 0.1) {
                let countNumbersLessThanValue = allValues.filter(value => value <= currentNumber).length;
                let numbersInInterval = countNumbersLessThanValue - totalNumbersInAllPreviousIntervals;
                if (numbersInInterval >= numbersPerInterval) {
                    intervals.push({from: fromNumber, to: currentNumber, count: numbersInInterval});
                    totalNumbersInAllPreviousIntervals += numbersInInterval;
                    fromNumber = currentNumber;
                }
            }

            intervals.push({from: fromNumber, to: maxNumber, count: allValues.length-totalNumbersInAllPreviousIntervals});

            let index = 0;
            if (isDouble) {
                let indexFrom = scoreCount;
                let relativeIndex = totalScore/2-1;
                index = indexFrom + relativeIndex;
            }
            else {
                index = totalScore - 2;
            }

            let realIntervalCount = intervals.length;
            let realIndex = Math.floor(realIntervalCount / intervalsCount * index);
            if (realIndex > intervals.length - 1) {
                realIndex = intervals.length - 1;
            }

            let interval = intervals[realIndex];

            return {maxScore: interval.to, minScore: interval.from};
        },
        getCashbackValue(campaign) {
            let actionsDetails = campaign.admitadCampaign.actions_detail;
            let tariffs = actionsDetails.reduce( (aggregate, actionDetails) => aggregate.concat(actionDetails.tariffs), []);
            let rates = tariffs.reduce( (aggregate, tariff) => aggregate.concat(tariff.rates), []);
            let percentRateValues = rates
                    .filter(rate => rate.is_percentage)
                    .map(rate => rate.size);
            let maxRate = Math.max.apply(null, percentRateValues);
            return maxRate > 0 && maxRate <= 100 ? maxRate : null;
        },
        async getRandomProduct(totalScore, isDouble, categories = [], region = 'ru') {
            let db = await getDb();
            let campaigns = await this.getSuitableCampaigns(categories, region);
            let hasCampaigns = campaigns && campaigns.length > 0;
            if (!hasCampaigns) {
                return false;
            }

            let campaignIds = campaigns.map(campaign => campaign.id);
            let campaignsWithProducts = await db.collection('products').aggregate([
                { $match: {"campaignId": {$in: campaignIds}} },
                { $group: {"_id": "$campaignId", maxDiscount: {$max: "$discount"}, minDiscount: {$min: "$discount"}} }
            ]).toArray();
            let hasCampaignsWithProducts = campaignsWithProducts && campaignsWithProducts.length > 0;
            if (!hasCampaignsWithProducts) {
                return false;
            }

            let randomIndex = Math.floor( Math.random() * campaignsWithProducts.length );
            let randomCampaign = campaignsWithProducts[randomIndex];
            let {maxScore, minScore} = this.getMaxDiscountRange(randomCampaign.minDiscount, randomCampaign.maxDiscount, totalScore, isDouble);

            let products = await db.collection('products').aggregate([
                { $match: {
                    campaignId: {$in: campaignIds},
                    discount: {$gte: minScore}
                  }
                },
                { $sample: {size: 100} }
            ]).toArray();

            let hasProducts = products && products.length > 0;
            if (!hasProducts) {
                return false;
            }

            let noMaxDiscountProducts = products.filter(({discount}) => discount <= maxScore);
            if (noMaxDiscountProducts.length === 0) {
                noMaxDiscountProducts = products;
            }

            let randomProductIndex = Math.floor( Math.random() * noMaxDiscountProducts.length );

            return noMaxDiscountProducts[randomProductIndex];
        },
        async getRandomCoupon(totalScore, isDouble, categories, region = 'ru') {
            let db = await getDb();
            let categoryIds = categories.map(id => parseInt(id));
            let query = {
                active: true,
                start: {$lte: moment().unix()},
                "rawCoupon.regions": region.toUpperCase(),
                $or: [{end: null}, {end: {$gte: moment().unix()}}]
            }

            if (categories && categories.length > 0) {
                query["rawCoupon.categories.id"] = {$in: categoryIds};
            }

            let categoryCoupons = await db.collection('coupons').find(query).toArray();
            let hasCoupons = categoryCoupons && categoryCoupons.length > 0;
            if (!hasCoupons) {
                return false;
            }

            let discounts = categoryCoupons.map(coupon => coupon.discount);
            let {maxScore, minScore} = this.getMaxDiscountRangeEqualDistribution(discounts, totalScore, isDouble);

            let minLimitCoupons = categoryCoupons.filter(coupon => coupon.discount >= minScore);
            let maxLimitCoupons = minLimitCoupons.filter(coupon => coupon.discount <= maxScore);

            let searchCoupons = maxLimitCoupons.length > 0
                ? maxLimitCoupons
                : minLimitCoupons;

            let randomIndex = Math.floor( Math.random() * searchCoupons.length );

            return searchCoupons[randomIndex];
        },
        async getRandomCashback(totalScore, isDouble, categories, region = 'ru') {
            let campaigns = await this.getSuitableCampaigns(categories, region, {"admitadCampaign.traffics.name": "Cashback"});
            let cashbacks = campaigns.map(this.getCashbackValue).filter(rate => rate !== null);
            let {maxScore, minScore} = this.getMaxDiscountRangeEqualDistribution(cashbacks, totalScore, isDouble);

            let minLimitCampaigns = campaigns.filter(campaign => this.getCashbackValue(campaign) >= minScore);
            let maxLimitCampaigns = minLimitCampaigns.filter(campaign => this.getCashbackValue(campaign) <= maxScore);

            let searchCampaigns = maxLimitCampaigns.length > 0
                ? maxLimitCampaigns
                : minLimitCampaigns;

            let randomIndex = Math.floor( Math.random() * searchCampaigns.length );

            return searchCampaigns[randomIndex];
        },

        async getRandomItem(type, totalScore, isDouble, ctx) {
            let profile = ctx.session.profile;
            let categories = profile.category || [];
            let region = ctx.from.language_code || false;

            switch (type) {
                case 'coupons':
                    return this.getRandomCoupon(totalScore, isDouble, categories, region);
                case 'products':
                    return this.getRandomProduct(totalScore, isDouble, categories, region);
                case 'cashback':
                    return this.getRandomCashback(totalScore, isDouble, categories, region);
            }

            return false;
        }
    }
}