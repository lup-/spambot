const {getDb} = require('../modules/Database');

module.exports = function () {
    return {
        getLimbs() {
            return [
                {code: 'head', name: 'Голова'},
                {code: 'neck', name: 'Шея'},
                {code: 'hands', name: 'Руки'},
                {code: 'thorax', name: 'Грудная клетка'},
                {code: 'life', name: 'Живот и желудок'},
                {code: 'loin', name: 'Поясница'},
                {code: 'butt', name: 'Задний проход'},
                {code: 'genitals', name: 'Паховая область'},
                {code: 'legs', name: 'Ноги'},
            ]
        },
        async getLimbSymptoms(limb) {
            const db = await getDb();
            const symptoms = db.collection('symptoms');
            return symptoms.find({limb: {$in: [limb, null, false]}}).toArray();
        },
        async getSymptom(id) {
            const db = await getDb();
            const symptoms = db.collection('symptoms');
            return symptoms.findOne({id});
        },
        async getComplaint(symptomId, complaintId) {
            symptomId = parseInt(symptomId);
            let symptom = await this.getSymptom(symptomId);
            return symptom.complaintData[complaintId] || false;
        },
        async rate(botType, type, symptomId, route, diagnosis, userId) {
            const db = await getDb();
            const rates = db.collection('rate');
            return rates.insertOne({botType, type, symptomId, route, diagnosis, userId});
        },
        async searchDisease(name) {
            const db = await getDb();
            const diseases = db.collection('diseases');;

            try {
                await diseases.createIndex( { name: "name", text: "name" } );
            }
            catch (e) {}

            let foundDiseases = await diseases.find({ $text: { $search: name } }).toArray();
            return foundDiseases;
        }
    }
}