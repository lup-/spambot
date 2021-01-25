const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');

const stats = require('./routes/stats');
const ads = require('./routes/ads');
const bots = require('./routes/bots');
const messages = require('./routes/messages');
const mailings = require('./routes/mailings');
const vacancies = require('./routes/vacancies');
const users = require('./routes/users');

const PORT = 3000;
const HOST = '0.0.0.0';

const app = new Koa();
const router = new Router();

router
    .post('/api/stats/list', stats.general)
    .post('/api/stats/details', stats.details);

router
    .post('/api/stats/refUsers', stats.refUsers)
    .post('/api/stats/refList', stats.refList)
    .post('/api/stats/updateRefUser', stats.updateRefUser);

router
    .post('/api/amsg/list', ads.list)
    .post('/api/amsg/add', ads.add)
    .post('/api/amsg/update', ads.update)
    .post('/api/amsg/delete', ads.delete);

router
    .post('/api/mailing/list', mailings.list)
    .post('/api/mailing/add', mailings.add)
    .post('/api/mailing/update', mailings.update)
    .post('/api/mailing/delete', mailings.delete)
    .post('/api/mailing/archive', mailings.archive)
    .post('/api/mailing/archiveStats', mailings.archiveStats)
    .post('/api/mailing/play', mailings.start)
    .post('/api/mailing/pause', mailings.pause)
    .post('/api/mailing/testUsers', mailings.testUsers)
    .post('/api/mailing/predictUsers', mailings.predictUsers)
    .post('/api/mailing/preview', mailings.preview);

router
    .post('/api/bots/list', bots.list)
    .post('/api/bots/restart', bots.restart)
    .post('/api/bots/reloadAds', bots.reloadAds)
    .post('/api/bots/reloadMessages', bots.reloadMessages)
    .post('/api/bots/getSettings', bots.getSettings)
    .post('/api/bots/saveSettings', bots.saveSettings)
    .post('/api/bots/reloadAds', bots.reloadAds);

router
    .post('/api/messages/list', messages.list);

router
    .post('/api/vacancy/list', vacancies.list)
    .post('/api/vacancy/add', vacancies.add)
    .post('/api/vacancy/update', vacancies.update)
    .post('/api/vacancy/delete', vacancies.delete)
    .post('/api/vacancy/categories', vacancies.categories);

router
    .post('/api/user/list', users.list)
    .post('/api/user/add', users.add)
    .post('/api/user/update', users.update)
    .post('/api/user/delete', users.delete)
    .post('/api/user/check', users.check)
    .post('/api/user/login', users.login);

app
    .use(bodyParser({
        formLimit: '50mb',
        jsonLimit: '1mb',
    }))
    .use(router.routes())
    .use(router.allowedMethods());

app.listen(PORT, HOST);