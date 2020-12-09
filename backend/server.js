const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');

const stats = require('./routes/stats');
const ads = require('./routes/ads');
const bots = require('./routes/bots');
const messages = require('./routes/messages');

const PORT = 3000;
const HOST = '0.0.0.0';

const app = new Koa();
const router = new Router();

router
    .post('/api/stats/list', stats.general)
    .post('/api/stats/details', stats.details);

router
    .post('/api/amsg/list', ads.list)
    .post('/api/amsg/add', ads.add)
    .post('/api/amsg/update', ads.update)
    .post('/api/amsg/delete', ads.delete);

router
    .post('/api/bots/list', bots.list)
    .post('/api/bots/restart', bots.restart)
    .post('/api/bots/reloadAds', bots.reloadAds)
    .post('/api/bots/reloadMessages', bots.reloadMessages);

router
    .post('/api/messages/list', messages.list);

app
    .use(bodyParser({
        formLimit: '50mb',
        jsonLimit: '1mb',
    }))
    .use(router.routes())
    .use(router.allowedMethods());

app.listen(PORT, HOST);