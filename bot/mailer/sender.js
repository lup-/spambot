const {Sender} = require('./SenderClass');

const mailingId = process.argv[2];
const isTest = process.argv[3] === 'test';

(async () => {
    const sender = new Sender(mailingId, isTest);
    await sender.init();

    process.on('message', async message => {
        if (message.action === 'stop') {
            await sender.stopSending();
            process.exit();
        }
    });

    await sender.startSending();
})();