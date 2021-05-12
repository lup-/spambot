import { Airgram, Auth } from 'airgram';
import HttpInterface from "./httpInterface.mjs";

const DEBUG = process.env.DEBUG === '1' || false;

const airgram = new Airgram({
    apiId: process.env.API_ID,
    apiHash: process.env.API_HASH,
    command: process.env.TDJSONLIB_PATH,
    logVerbosityLevel: 0,
});
const httpIO = new HttpInterface(airgram);

airgram.use(new Auth({
    code: () => {
        return new Promise(resolve => {
            console.log('Waiting for code...');
            httpIO.setCodeRecieveHandler(resolve);
        });
    },
    phoneNumber: () => process.env.AUTH_PHONE
}));

airgram.use((ctx, next) => {
    if ('update' in ctx) {
        httpIO.triggerCallbacks(ctx._, ctx);
    }
    return next()
});

httpIO.launch();

if (DEBUG) {
    (async () => {
        await airgram.api.setLogVerbosityLevel({newVerbosityLevel: 10});
        await airgram.api.setLogStream({logStream: {path: "/var/bot/log.txt", redirectStderr: true}});
    })();
}
