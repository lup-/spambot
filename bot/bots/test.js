const fs = require('fs');
const getParser = require('./parsers/sound/soundcloud');


(async () => {
    let parser = getParser();
    let issues = await parser.parseVolumes('https://soundcloud.com/mavr-agency');
    let mp3 = await parser.getTrackMp3(issues[0].pageUrl);

    //let stream = fs.createWriteStream('./output.mp3');
    //await mp3.pipe(stream);
})();
