const {init} = require('../../managers');
const {escapeHTML} = require('../helpers/common');
const {menu} = require('../helpers/wizard');
const {__} = require('../../modules/Messages');
const moment = require('moment');

let vacancies = init('vacancies');
let periodic = init('periodic');
let profileManager = init('profile');

const hhFilter = process.env.HH_FILTER
    ? JSON.parse(process.env.HH_FILTER)
    : {};

async function showVacancy(item, ctx) {
    let fullVacancy = item;

    if (item.showType == 'hh') {
        let parsed = await vacancies.parseVacancy(item.alternate_url);
        fullVacancy = await vacancies.getVacancy(item.id);
        fullVacancy.contact = parsed.contactInfo;
    }

    let hasResume = false;
    let userId = ctx.session.userId || false;
    if (userId) {
        hasResume = await vacancies.hasResume(userId);
    }

    let resumeButton = hasResume
        ? {code: 'send_resume', text: 'Отправить резюме'}
        : {code: 'new_resume', text: 'Создать резюме'}

    let extra = menu([{code: 'continue', text: 'Продолжить поиск'}, resumeButton]);
    extra.disable_web_page_preview = true;

    return ctx.replyWithHTML( getFullItemDescription(fullVacancy), extra );
}

async function getAction() {
    return {
        button: {code: 'action', text: '👀'},
        route: showVacancy
    };
}
async function saveSettings(profile, ctx) {
    ctx.session.profile = await profileManager.saveProfile(profile);
}
function getSelectedCategoryIds(ctx) {
    return vacancies.getSelectedCategoryIds(ctx);
}
function getAllCategories() {
    return vacancies.getCatalogCategories();
}
async function getItemAtIndex(currentIndex, ctx) {
    return vacancies.discoverAtIndex(ctx, currentIndex, hhFilter);
}

function getEmptyText() {
    return `Похоже тут пока что ничего нет. 

Попробуйте задать другие специальности для поиска.`;
}
function getSettingsText() {
    return `Чтобы сделать поиск более точечным и ускорить его, выберите интересующие вас категории.

Вакансии в боте постоянно обновляются. Он собирает их сразу в момент публикации на сайтах. За счёт этого шанс отклика на ваше резюме в десятки раз выше, чем обычно`;
}

function getContacts(item) {
    if (!item.contact) {
        return `<a href="${item.apply_alternate_url}">Оставить отклик на сайте</a>`;
    }

    let phones = item.contact && item.contact.phones && item.contact.phones.phones
        ? item.contact.phones.phones.map(({country, city, number}) => `+${country} (${city}) ${number}`)
        : [];

    let contacts = [];
    if (item.contact.fio) {
        contacts.push(item.contact.fio);
    }

    if (item.contact.email) {
        contacts.push(item.contact.email);
    }

    if (phones && phones.length > 0) {
        contacts = contacts.concat(phones);
    }

    return contacts.length > 0 ? contacts.join('\n') : `<a href="${item.apply_alternate_url}">Оставить отклик на сайте</a>`;
}
function getSalary(item) {
    if (!item.salary) {
        return 'не указана';
    }

    let parts = [];
    if (item.salary.from) {
        parts.push(item.salary.from);
    }

    if (item.salary.to) {
        parts.push(item.salary.to);
    }

    return parts.join('-') + ' ' + item.salary.currency;
}
function getLocalFullItemDescription(item) {
    return __(`<b>${item.name}</b>
${item.city || ''}

<b>Оплата:</b>
${getSalary(item)}

<b>Обязанности:</b>
${item.responsibilities || 'не указаны'}

<b>Требования:</b>
${item.requirements || 'не указаны'}

<b>Условия:</b>
${item.conditions || 'не указаны'}

<b>Контакты:</b>
${item.contacts || 'не указаны'}`, ['content', 'vacancy', 'job']);
}
function getFullItemDescription(item) {
    if (item.showType === 'local') {
        return getLocalFullItemDescription(item);
    }

    let descr = escapeHTML(item.description, true) || 'не указаны';
    descr = descr
        .replace('\n<strong>', '\n\n<strong>')
        .replace(/\n+$/sg, '');

    return __(`<b>${item.name}</b>
${item.employer ? item.employer.name || '' : ''}

<b>Оплата:</b>
${getSalary(item)}

${descr}

<b>Контакты:</b>
${getContacts(item)}`, ['content', 'vacancy', 'job', 'full']);
}
function getLocalItemDescription(item) {
    return __(`<b>${item.name}</b>
${item.city || ''}

<b>Оплата:</b>
${getSalary(item)}

<b>Обязанности:</b>
${item.responsibilities || 'не указаны'}

<b>Требования:</b>
${item.requirements || 'не указаны'}`, ['content', 'vacancy', 'job']);
}
function getItemDescription(brief) {
    if (brief.showType === 'local') {
        return getLocalItemDescription(brief);
    }

    return __(`<b>${brief.name}</b>
${brief.employer.name} (${brief.area.name})

<b>Оплата:</b>
${getSalary(brief)}

<b>Обязанности:</b>
${brief.snippet.responsibility || 'не указаны'}

<b>Требования:</b>
${brief.snippet.requirement || 'не указаны'}`, ['content', 'vacancy', 'job']);
}
function getItemImage(item) {
    return false;
}

function getLastVisit(ctx) {
    return ctx && ctx.session && ctx.session.profile
        ? ctx.session.profile.lastVisit
        : false;
}
async function setLastVisit(ctx) {
    let profile = ctx.session.profile;
    profile.lastVisit = moment().unix();
    return saveSettings(profile, ctx);
}

async function getDisclaimer() {
    let text;

    switch (process.env.BOT_NAME) {
        case 'beembam_bot':
            text = `Добро пожаловать в бота для поиска вакансий на удалённую работу от канала @BeemBam.

Тут каждый день собираются лучшие предложения из всех возможных источников.

Чтобы использовать полный функционал бота достаточно перейти в раздел "Список вакансий". Перед этим не забудьте настроить категории поиска. 

Все вакансии обновляются каждый день. Если ничего не нашли сегодня, проверьте на следующий день.

Чтобы отправить отклик работодателю прямо из бота - создайте резюме в соответствующем разделе. Если вами заинтересуются, бот оповестит об этом.

Это системное сообщение, оно выводится один раз. Приятного пользования и удачи в поисках!`;
            break;
        case 'traineeship_bot':
            text = `Добро пожаловать в бота для поиска вакансий от канала @profinorm

Тут собраны лучшие предложения по работе. Чтобы оставлять отклики на вакансии - создайте своё резюме.

Если хотите обойти всех и быть первыми для работодателя - заходите в бота почаще чтобы проверить упущенные вакансии. База постоянно обновляется.`;
            break;
        case 'workhant_bot':
            text = `Добро пожаловать в бота для поиска вакансий

Тут собраны лучшие предложения по работе. Чтобы оставлять отклики на вакансии - создайте своё резюме.

Если хотите обойти всех и быть первыми для работодателя - заходите в бота почаще чтобы проверить упущенные вакансии. База постоянно обновляется.`;
            break;
        default:
            text = `Добро пожаловать в бота для поиска вакансий.

Тут каждый день собираются лучшие предложения из всех возможных источников.

Чтобы использовать полный функционал бота достаточно перейти в раздел "Список вакансий". Перед этим не забудьте настроить категории поиска. 

Все вакансии обновляются каждый день. Если ничего не нашли сегодня, проверьте на следующий день.

Чтобы отправить отклик работодателю прямо из бота - создайте резюме в соответствующем разделе. Если вами заинтересуются, бот оповестит об этом.

Это системное сообщение, оно выводится один раз. Приятного пользования и удачи в поисках!`;
            break;
    }

    return {text, tags: ['content', 'vacancies', 'job', 'intro']};
}

module.exports = {
    getDisclaimer,
    withPhoto: false,
    toggleFavorite: false,
    hasFavorite: false,
    hasRandom: false,
    vacancies,
    periodic,
    hhFilter,
    discoverAction(ctx) {
        return setLastVisit(ctx);
    },
    getAction,
    additionalActions: [
        {
            code: 'continue',
            callback(ctx) {
                return ctx.scene.reenter();
            }
        },
        {
            code: 'send_resume',
            callback(ctx) {
                ctx.replyWithHTML(__('Резюме отправлено!', ['settings', 'success', 'send']));
                return ctx.scene.reenter();
            }
        },
        {
            code: 'new_resume',
            callback(ctx) {
                return ctx.scene.enter('resume');
            }
        }
    ],
    showVacancy,
    saveSettings,
    getSelectedCategoryIds,
    getAllCategories,
    getItemAtIndex,
    getEmptyText,
    getSettingsText,
    getItemDescription,
    getItemImage,
    getLastVisit,
    setLastVisit,
    getFullItemDescription
}