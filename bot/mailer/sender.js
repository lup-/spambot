const {Sender} = require('./SenderClass');

const mailingId = process.argv[2];
const botId = process.argv[3];

(async () => {
    process.send({action: 'started'});
    const sender = new Sender(mailingId, botId);
    await sender.init();

    process.on('message', async message => {
        if (message.action === 'stop') {
            await sender.stopSending();
            process.exit();
        }
    });

    await sender.startSending();
    process.exit();
})();