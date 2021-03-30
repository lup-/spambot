const { Telegraf } = require('telegraf');
const setupBot = require('./helpers/setup');
const {init} = require('../managers');
const {menu} = require('./helpers/wizard');
const {__} = require('../modules/Messages');

const catalogParams = require('./actions/vacancies');

const BOT_TOKEN = process.env.BOT_TOKEN;
let app = new Telegraf(BOT_TOKEN);
let bus = init('bus');
let {periodic, vacancies, showVacancy} = catalogParams;
let profile = init('profile');

app = setupBot(app)
    .addHandleBlocks()
    .addSession()
    .addSafeReply()
    .addIdsToSession()
    .addRefSave()
    .addUserSave()
    .addProfile()
    .addSaveActivity()
    .addScenes('catalog', catalogParams, ['intro.js'])
    .addScenes('vacancies', catalogParams)
    .get();

    app.start(async ctx => {
        let ref = ctx.update.message.text.indexOf(' ') !== -1
            ? ctx.update.message.text.replace('/start ', '')
            : false;

        let hasSubrefs = ref && ref.indexOf('=') !== -1;
        if (hasSubrefs) {
            let parts = ref.split('=');
            parts.shift();
            let subref = parts.join('=');

            let vacancy = await vacancies.getVacancy(subref);
            if (vacancy) {
                return showVacancy(vacancy, ctx);
            }
        }

        return ctx.scene.enter('intro');
    });

    app.action('new_resume', ctx => ctx.scene.enter('resume'));
    app.action('send_resume', ctx => {
        return ctx.replyWithHTML(
            __('Резюме отправлено!', ['settings', 'success', 'send']),
            menu([{code: 'continue', text: 'Продолжить поиск'}])
        );
    });

    app = setupBot(app).addDefaultRoute(ctx => ctx.scene.enter('intro'), false).get();

    periodic.setTaskRunner(async task => {
        let profileData = await profile.loadProfileByUserId(task.userId);
        let {hhFilter, getFullItemDescription} = catalogParams;

        try {
            let latestVacancy = await vacancies.getLatestVacancy(profileData, hhFilter, profile.saveProfile);
            if (latestVacancy) {
                let extra = menu([{code: 'discover', text: 'Посмотреть другие'}]);
                extra.parse_mode = 'HTML';
                extra.disable_web_page_preview = true;

                let messageText = getFullItemDescription(latestVacancy);
                await app.telegram.sendMessage(task.chatId, messageText, extra);
            }

            await periodic.setTaskRemindSuccess(task.taskId);
            await periodic.setTaskTime(task.taskId, vacancies.getNextRemindDate());
        }
        catch (e) {
            if (e && e.code === 403) {
                await periodic.unsubscribe(profileData);
            }
        }
    });

app.launch();
bus.listenCommands();
//periodic.launch();
