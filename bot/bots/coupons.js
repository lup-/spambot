const axios = require('axios');
const FormData = require('form-data');

const PAGE_LIMIT = 10;

async function auth() {
    const CLIENT_ID = process.env.ADMITAD_CLIENT_ID;
    const CLIENT_SECRET = process.env.ADMITAD_CLIENT_SECRET;

    let scopes = [
        'public_data',
        'websites',
        'coupons',
        'coupons_for_website',
        'advcampaigns', 'advcampaigns_for_website', 'manage_advcampaigns',
        'deeplink_generator'
    ];

    let authParams = new FormData;
    authParams.append('client_id', CLIENT_ID);
    authParams.append('scope', scopes.join(' '));
    authParams.append('grant_type', 'client_credentials');

    let response = await axios.post('https://api.admitad.com/token/', authParams, {
        headers: authParams.getHeaders(),
        auth: {
            username: CLIENT_ID,
            password: CLIENT_SECRET
        }
    });

    return response.data;
}
async function getToken() {
    let authData = await auth();
    return authData.access_token;
}

async function getCoupons(token, region = 'ru') {
    let response = await axios.get('https://api.admitad.com/coupons/', {
        headers: { 'Authorization': `Bearer ${token}` },
        params: {
            language: region,
            order_by: '-rating',
        }
    });

    return response.data.results;
}
async function getAdvCampaigns(token, filter = {}, connected = false, offset = 0) {
    if (!filter) {
        filter = {};
    }

    filter.limit = PAGE_LIMIT;
    filter.offset = offset;

    let {data} = await axios.get('https://api.admitad.com/advcampaigns/', {
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
            let nextPageCampaigns = await getAdvCampaigns(token, filter, connected, page);
            campaigns = campaigns.concat(nextPageCampaigns);
        }
    }

    return connected ? campaigns.filter(campaign => campaign.connected) : campaigns;
}
async function getNewCouponCampaigns(token) {
    return getAdvCampaigns(token, {has_tool: 'coupons'});
}
async function connectAdvCapaign(token, campaign, website = false) {
    let campaignId = campaign.id;
    let websiteId = website.id;

    let response = await axios.get(`https://api.admitad.com/advcampaigns/${campaignId}/attach/${websiteId}/`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    return response.data && response.data.success && response.data.success === 'OK';
}
async function getWebsite(token) {
    let response = await axios.get('https://api.admitad.com/websites/v2/', {
        headers: {'Authorization': `Bearer ${token}`},
    });

    let activeWebsites = response.data.filter(website => website.status === 'active');
    return activeWebsites.length > 0 ? activeWebsites[0] : false;
}

(async () => {
    try {
        let token = await getToken();
        let website = await getWebsite(token);
        let coupons = await getCoupons(token);
        //let campaigns = await getNewCouponCampaigns(token);
        let allCampaigns = await getAdvCampaigns(token)

        console.log(coupons);
    }
    catch (e) {
        console.log(e);
    }
})();