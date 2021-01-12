const axios = require('axios');
const FormData = require('form-data');

async function auth() {
    const CLIENT_ID = process.env.ADMITAD_CLIENT_ID;
    const CLIENT_SECRET = process.env.ADMITAD_CLIENT_SECRET;

    let scopes = ['public_data', 'websites', 'coupons', 'coupons_for_website', 'advcampaigns', 'advcampaigns_for_website', 'deeplink_generator'];
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

async function getAdvCampaigns(token, connected = true) {
    let response = await axios.get('https://api.admitad.com/advcampaigns/', {
        headers: {'Authorization': `Bearer ${token}`},
    });

    let campaigns = response.data.results;
    return connected ? campaigns.filter(campaign => campaign.connected) : campaigns;
}

(async () => {
    try {
        let token = await getToken();
        let coupons = await getCoupons(token);
        let campaigns = await getAdvCampaigns(token);

        console.log(coupons, campaigns);
    }
    catch (e) {
        console.log(e);
    }

})();