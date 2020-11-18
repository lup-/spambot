const {getDb} = require('../../modules/Database');
const got = require('got');

const BASE_URL = "https://health.mail.ru";

let symptomsData = [
    {"id": 1, "limb": "head", "url": "/json/symptoms/complaint/1/", "text": "Боль в области лица"},
    {"id": 2, "limb": "neck", "url": "/json/symptoms/complaint/2/", "text": "Боль в шее"},
    {"id": 3, "limb": "hands", "url": "/json/symptoms/complaint/3/", "text": "Боль в руке"},
    {"id": 4, "limb": "legs", "url": "/json/symptoms/complaint/4/", "text": "Боль в ноге"},
    {"id": 5, "limb": "head", "url": "/json/symptoms/complaint/5/", "text": "Головная боль"},
    {"id": 6, "limb": "neck", "url": "/json/symptoms/complaint/6/", "text": "Боль в горле"},
    {"id": 7, "limb": "head", "url": "/json/symptoms/complaint/7/", "text": "Боль в ухе"},
    {"id": 8, "limb": "thorax", "url": "/json/symptoms/complaint/8/", "text": "Боль в груди"},
    {"id": 9, "limb": "life", "url": "/json/symptoms/complaint/9/", "text": "Боль в животе"},
    {"id": 10, "limb": "loin", "url": "/json/symptoms/complaint/10/", "text": "Боль в пояснице"},
    {"id": 11, "url": "/json/symptoms/complaint/11/", "text": "Кровотечения"},
    {"id": 12, "limb": "head", "url": "/json/symptoms/complaint/12/", "text": "Нарушение мозгового кровообращения"},
    {"id": 13, "gender": "female", "limb": "genitals", "url": "/json/symptoms/complaint/13/", "text": "Нарушения менструального цикла"},
    {"id": 14, "limb": "butt", "url": "/json/symptoms/complaint/14/", "text": "Боль в заднем проходе"},
    {"id": 15, "limb": "genitals", "url": "/json/symptoms/complaint/15/", "text": "Боль при мочеиспускании"},
    {"id": 17, "url": "/json/symptoms/complaint/17/", "text": "Остановка дыхания (апноэ)"},
    {"id": 18, "url": "/json/symptoms/complaint/18/", "text": "Изменения лимфатических узлов"},
    {"id": 19, "limb": "butt", "url": "/json/symptoms/complaint/19/", "text": "Изменения кала"},
    {"id": 20, "limb": "genitals", "url": "/json/symptoms/complaint/20/", "text": "Изменения мочи"},
    {"id": 21, "url": "/json/symptoms/complaint/21/", "text": "Психические расстройства"},
    {"id": 22, "url": "/json/symptoms/complaint/22/", "text": "Судороги"},
    {"id": 23, "url": "/json/symptoms/complaint/23/", "text": "Высокая температура"},
    {"id": 24, "limb": "thorax", "url": "/json/symptoms/complaint/24/", "text": "Кашель"},
    {"id": 25, "limb": "thorax", "url": "/json/symptoms/complaint/25/", "text": "Одышка"},
    {"id": 26, "limb": "life", "url": "/json/symptoms/complaint/26/", "text": "Нарушения пищеварения"},
    {"id": 27, "url": "/json/symptoms/complaint/27/", "text": "Высыпания на коже"},
    {"id": 28, "url": "/json/symptoms/complaint/28/", "text": "Нарушения кровообращения"},
    {"id": 29, "limb": "head", "url": "/json/symptoms/complaint/29/", "text": "Нарушения зрения и болезни глаз"},
];

getDb().then(async () => {
    const db = await getDb();
    const symptoms = db.collection('symptoms');

    for (let symptom of symptomsData) {
        symptom.url = BASE_URL+symptom.url;
        const response = await got(symptom.url, {responseType: 'buffer'});
        let json = JSON.parse(response.body.toString());

        symptom.complaintData = Object.keys(json.complaintData).reduce( (complaints, key) => {
            let question = json.complaintData[key];

            if (question.askUrl) {
                question.askUrl = BASE_URL+question.askUrl;
            }

            if (question.diseaseUrl) {
                question.diseaseUrl = BASE_URL+question.diseaseUrl;
            }

            if (question.diseaseDataUrl) {
                question.diseaseDataUrl = BASE_URL+question.diseaseDataUrl;
            }

            if (question.text) {
                question.text = question.text.replace(/\<\/*a[^\>]*?\>/gi, '');
            }

            complaints[key] = question;
            return complaints;
        }, {});

        await symptoms.findOneAndReplace({id: symptom.id}, symptom, {upsert: true, returnOriginal: false});
    }
});