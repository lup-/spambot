const {Sender} = require('./SenderClass');

const [,, mailingId] = process.argv;

(async () => {
    const sender = new Sender(mailingId);
    await sender.init();

    process.on('message', async message => {
        if (message.action === 'stop') {
            await sender.stopSending();
            process.exit();
        }
    });

    await sender.startSending();
})();