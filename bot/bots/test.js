const fs = require('fs');
const getParser = require('./parsers/sound/apple');


(async () => {
    let parser = getParser();
    let issues = await parser.parseVolumes('https://podcasts.apple.com/ru/podcast/id1502212552');
    let mp3 = await parser.getTrackMp3(issues[0].pageUrl);

    let stream = fs.createWriteStream('./apple.mp3');
    await mp3.pipe(stream);
})();
