const Koa = require('koa');
const Router = require('@koa/router');
const multer = require('@koa/multer');

const bodyParser = require('koa-bodyparser');

const stats = require('./routes/stats');
const ads = require('./routes/ads');
const bots = require('./routes/bots');
const messages = require('./routes/messages');
const mailings = require('./routes/mailings');
const vacancies = require('./routes/vacancies');
const users = require('./routes/users');
const files = require('./routes/files');

const plumcoreCourses = require('./routes/plumcore/courses');
const plumcoreCategories = require('./routes/plumcore/categories');
const plumcorePayments = require('./routes/plumcore/payments');
const plumcoreSubscribers = require('./routes/plumcore/subscribers');
const plumcoreStats = require('./routes/plumcore/stats');

const PORT = 3000;
const HOST = '0.0.0.0';
const UPLOAD_DIR = process.env.UPLOAD_DIR;

const app = new Koa();
const router = new Router();
const upload = multer({dest: UPLOAD_DIR});

router
    .post('/api/stats/list', stats.general)
    .post('/api/stats/dashboard', stats.dashboard.bind(stats))
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

router
    .post('/api/file/link', upload.single('file'), files.getLink.bind(files))
    .post('/api/file/delete', files.deleteFile.bind(files));


router
    .post('/api/plumcore/course/list', plumcoreCourses.list)
    .post('/api/plumcore/course/add', plumcoreCourses.add)
    .post('/api/plumcore/course/update', plumcoreCourses.update)
    .post('/api/plumcore/course/delete', plumcoreCourses.delete);

router
    .post('/api/plumcore/category/list', plumcoreCategories.list)
    .post('/api/plumcore/category/add', plumcoreCategories.add)
    .post('/api/plumcore/category/update', plumcoreCategories.update)
    .post('/api/plumcore/category/delete', plumcoreCategories.delete);

router
    .post('/api/plumcore/subscriber/list', plumcoreSubscribers.list.bind(plumcoreSubscribers))
    .post('/api/plumcore/subscriber/update', plumcoreSubscribers.update.bind(plumcoreSubscribers));

router
    .get('/api/plumcore/stats/dashboard', plumcoreStats.dashboard.bind(plumcoreStats))
    .post('/api/plumcore/stats/sales', plumcoreStats.sales.bind(plumcoreStats));

router
    .post('/api/plumcore/payment/list', plumcorePayments.list)

app
    .use(bodyParser({
        formLimit: '50mb',
        jsonLimit: '10mb',
    }))
    .use(router.routes())
    .use(router.allowedMethods());

app.listen(PORT, HOST);
