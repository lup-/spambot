const Horoscope = require('../managers/Horoscope');

let hor = new Horoscope();
hor.fetchDailyToDb().then((res) => {
    console.log(res);
});

