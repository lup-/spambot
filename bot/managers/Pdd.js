const pddQuestions = require('../bots/data/pdd_questions');

module.exports = function () {
    return {
        getTopicsList() {
            return pddQuestions.map(item => {
                return {name: item.section, id: item.position};
            });
        },
        getTopicById(id) {
            return pddQuestions.find(item => item.position === id);
        },
        getRandomQuestions(count) {
            let allQuestions = pddQuestions.reduce( (result, topic) => {
                return result.concat( topic.tickets );
            }, []);

            let randomQuestions = [];
            for (let i = 0; i < count; i++) {
                let maxNum = allQuestions.length-1;
                let randomNum = Math.round( Math.random()*maxNum );

                randomQuestions.push(allQuestions[randomNum]);
            }

            return randomQuestions;
        },
        saveStat(question, answer, section) {

        }
    }
}