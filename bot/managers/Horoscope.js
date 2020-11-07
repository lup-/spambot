const moment = require('moment');
const axios = require('axios');
const convert = require('xml-js');

module.exports = function () {
    let DAILY_URL = "https://ignio.com/r/export/utf/xml/daily/com.xml";

    return {
        async fetchDailyToDb() {
            try {
                let {data} = await axios(DAILY_URL);
                let horoscope = convert.xml2json(data, {compact: true});
                let dates = horoscope['dates'];


            }
            catch (e) {
                return false;
            }
        }
    }
}