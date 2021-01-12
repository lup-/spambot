const axios = require('axios');
const BaseScene = require('telegraf/scenes/base');
const {parseFile, extractContacts, splitFio, extractSalary} = require('../../parsers/resume');
const {menu} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');

function getContacts(candidate) {
    let contacts = candidate.contacts;
    if (!contacts) {
        return false;
    }

    let cardContacts = [];
    if (candidate.contacts.phone) {
        cardContacts = cardContacts.concat(candidate.contacts.phone);
    }

    if (candidate.contacts.email) {
        cardContacts.push(candidate.contacts.email);
    }

    if (candidate.contacts.telegram) {
        cardContacts.push(candidate.contacts.telegram);
    }

    return cardContacts.join('\n');
}

function getResumeCard(candidate) {
    return `<b>${candidate.name || 'Имя не указано'}</b>

<b>Город:</b>
${candidate.city || 'не указан'}

<b>Желаемая позиция:</b>
${candidate.position || 'не указана'}

<b>Пожелания по зарплате:</b>
${candidate.salary ? candidate.salary.value + ' ' + (candidate.salary.currency ? candidate.salary.currency : '') : 'не указаны'}

<b>Контакты:</b>
${getContacts(candidate) || 'не указаны'}
`;
}

function editMenu(ctx) {
    return menu([
        {code: 'save', text: 'Опубликовать 👍'},
        {code: 'name', text: 'Редактировать имя'},
        {code: 'city', text: 'Редактировать город'},
        {code: 'position', text: 'Редактировать позицию'},
        {code: 'salary', text: 'Редактировать зарплату'},
        {code: 'contacts', text: 'Редактировать контакты'},
        {code: 'upload', text: ctx.scene.state.document ? 'Загрузить другое' : 'Загрузить файл'},
        {code: 'cancel', text: 'Отмена'},
    ], 1);
}

module.exports = function ({vacancies}) {
    const scene = new BaseScene('resume');

    scene.enter(async ctx => {
        return ctx.reply(`Пожалуйста пришлите файл со своим резюме или заполните поля. Это необходимо для того, чтобы отправлять отклики под вакансиями и рекрутер мог сразу узнать о вас всю необходимую информацию.

Для загрузки поддерживаются форматы: pdf, docx, doc, odt, rtf, txt`, menu([{code: 'no_file', text: 'У меня нет файла'}]));
    });

    scene.on('document', async ctx => {
        let document = ctx.update.message && ctx.update.message.document
            ? ctx.update.message.document
            : false;

        if (!document) {
            return ctx.scene.reenter();
        }

        ctx.reply('Файл получен, идет обработка');

        let fileId = document.file_id;
        let fileLink = await ctx.tg.getFileLink(fileId);
        let response = await axios.get(fileLink, {responseType: 'arraybuffer'});
        let buffer = response.data;
        let name = document.file_name;
        let type = document.mime_type;

        let {candidate, docText} = await parseFile({name, type, buffer});
        ctx.scene.state.candidate = candidate;
        ctx.scene.state.docText = docText;
        ctx.scene.state.document = document;

        let extra = editMenu(ctx);
        extra.caption = getResumeCard(candidate);
        extra.parse_mode = 'HTML';

        return ctx.replyWithDocument(fileId, extra);
    });
    scene.on('text', async ctx => {
        let text = ctx.update.message.text.trim();
        let target = ctx.scene.state.messageTarget;

        switch (target) {
            case 'name':
                ctx.scene.state.candidate.name = text;
                ctx.scene.state.candidate.nameParts = splitFio(text);
                break;
            case 'city':
                ctx.scene.state.candidate.city = text;
                break;
            case 'position':
                ctx.scene.state.candidate.position = text;
                break;
            case 'salary':
                ctx.scene.state.candidate.salary = extractSalary(text);
                break;
            case 'contacts':
                ctx.scene.state.candidate.contacts = extractContacts(text);
                break;
        }

        let candidate = ctx.scene.state.candidate;

        if (ctx.scene.state.document) {
            let fileId = ctx.scene.state.document.file_id;

            let extra = editMenu(ctx);
            extra.caption = getResumeCard(candidate);
            extra.parse_mode = 'HTML';

            return ctx.replyWithDocument(fileId, extra);
        }
        else {
            ctx.replyWithHTML(getResumeCard(candidate), editMenu(ctx));
        }
    });

    scene.action('upload', ctx => ctx.scene.reenter());
    scene.action('cancel', ctx => ctx.scene.enter('intro'));

    scene.action('name', ctx => {
        ctx.scene.state.messageTarget = 'name';
        return ctx.reply('Напиши свое полное имя.\n\nНапример: Тучкин Лев Константинович');
    });
    scene.action('city', ctx => {
        ctx.scene.state.messageTarget = 'city';
        return ctx.reply('Напиши свой город.\n\nНапример: Дудинка');
    });
    scene.action('position', ctx => {
        ctx.scene.state.messageTarget = 'position';
        return ctx.reply('Напиши желаемую позицию.\n\nНапример: Садовник');
    });
    scene.action('salary', ctx => {
        ctx.scene.state.messageTarget = 'salary';
        return ctx.reply('Напиши пожелания по зарплате.\n\nНапример: 980000 руб или 100 usd');
    });
    scene.action('contacts', ctx => {
        ctx.scene.state.messageTarget = 'contacts';
        return ctx.reply('Напиши свои контакты. Хотя-бы почту и телефон.\n\nНапример:\nnoop@hello.com\n+7 (999) 123-45-56\n Telegram: @BeemBam_bot');
    });
    scene.action('no_file', ctx => {
        ctx.scene.state.candidate = {};
        ctx.scene.state.docText = false;
        ctx.scene.state.document = false;
        return ctx.replyWithHTML(getResumeCard(ctx.scene.state.candidate), editMenu(ctx));
    });

    scene.action('save', async ctx => {
        let candidate = ctx.scene.state.candidate;
        let userId = ctx.session.profile.userId;
        let text = ctx.scene.state.docText ? ctx.scene.state.docText : false;
        let fileId = ctx.scene.state.document ? ctx.scene.state.document.file_id : false;

        await vacancies.saveResume(candidate, fileId, text, userId);
        ctx.replyWithHTML(__('Резюме опубликовано!', ['settings', 'success', 'saved']));
        return ctx.scene.enter('intro');
    });

    return scene;
}