const Telegram = require('telegraf/telegram');
const Markup = require('telegraf/markup');
const imgbbUploader = require('imgbb-uploader');
const tempWrite = require('temp-write');
const fs = require('fs');

const {wait} = require('../modules/Helpers');
const {getDb} = require('../modules/Database');
const {escapeHTML} = require('../bots/helpers/common');
const config = require('../../backend/config');
const moment = require('moment');

const MAILING_DB_NAME = 'botofarmer';

const TEST_QUEUE_SIZE = 100;
const TEST_BOT_ID = 'mailer_bot';
const MAILER_BOT_ID = TEST_BOT_ID;
const TEST_CHAT_ID = 483896081;
const TEST_USER_ID = 483896081;

const STATUS_NEW = 'new';
const STATUS_BLOCKED = 'blocked';
const STATUS_FAILED = 'failed';
const STATUS_FINISHED = 'sent';
const STATUS_VIEWED = 'read';
const STATUSES_SUCCESS = [STATUS_FINISHED, STATUS_VIEWED];
const STATUSES_FAILED = [STATUS_BLOCKED, STATUS_FAILED];
const STATUSES_PROCESSED = [STATUS_FINISHED, STATUS_VIEWED, STATUS_BLOCKED, STATUS_FAILED];

const MAILING_STATUS_NEW = 'new';
const MAILING_STATUS_PROCESSING = 'processing';
const MAILING_STATUS_PAUSED = 'paused';
const MAILING_STATUS_FINISHED = 'finished';

const IMGBB_TOKEN = process.env.IMGBB_TOKEN;

const API_ROOT = process.env.TGAPI_ROOT || 'https://api.telegram.org'
const SIG_STOPPED = 10;

class Sender {
    constructor(mailingId = false, botId = false) {
        this.id = mailingId;
        this.botId = botId;
        this.chunkSize = 5;
        this.bots = false;
        this.stop = false;
        this.stopResolve = false;
    }

    async init(mailing = false) {
        if (mailing) {
            this.mailing = mailing;
        }
        else {
            await this.loadMailing();
        }
        return this;
    }

    getTelegram(token) {
        return new Telegram(token, {apiRoot: API_ROOT});
    }

    async loadMailing() {
        let db = await getDb(MAILING_DB_NAME);
        this.mailing = await db.collection('mailings').findOne({id: this.id});
    }

    async getBots() {
        if (this.bots) {
            return this.bots;
        }

        this.bots = await config.botList();
        return this.bots;
    }

    async getBot(botId) {
        let bots = await this.getBots();
        return bots.find(bot => bot.id === botId);
    }

    async getNextChats(chunkSize = false) {
        if (!chunkSize) {
            chunkSize = this.chunkSize;
        }
        let db = await getDb(MAILING_DB_NAME);
        let chats = await db.collection('mailingQueue').find({
            mailing: this.id,
            bot: this.botId,
            status: STATUS_NEW,
        }).limit(chunkSize).toArray();
        return chats;
    }

    getMessage() {
        let rawHTML = this.mailing.text;
        return escapeHTML(rawHTML);
    }

    getExtra() {
        let extra = {};
        if (this.mailing.buttons && this.mailing.buttons.length > 0) {
            let buttons = this.mailing.buttons.map(button => Markup.urlButton(button.text, button.link));
            extra = Markup.inlineKeyboard(buttons).extra();
        }

        if (this.mailing.disablePreview) {
            extra.disable_web_page_preview = true;
        }

        if (this.mailing.disableNotification) {
            extra.disable_notification = true;
        }

        extra.parse_mode = 'HTML';
        return extra;
    }

    async sendNextChunk(chunkSize = false) {
        let chats = await this.getNextChats(chunkSize);
        let sendPromises = chats.map( chat => this.sendMailingToChat(chat) );
        return Promise.all(sendPromises);
    }

    async setChatBlock(chat) {
        if (!chat._id) {
            return false;
        }

        let db = await getDb(MAILING_DB_NAME);
        await db.collection('mailingQueue').updateOne({_id: chat._id}, {$set: {status: STATUS_BLOCKED}});
        return this.updateCounters('blocks');
    }

    async setChatFailed(chat, error) {
        if (!chat._id) {
            return false;
        }

        let db = await getDb(MAILING_DB_NAME);
        await db.collection('mailingQueue').updateOne({_id: chat._id}, {$set: {status: STATUS_FAILED, error}});
        return this.updateCounters('errors');
    }

    async setChatFinished(chat, messageId) {
        if (!chat._id) {
            return false;
        }

        let db = await getDb(MAILING_DB_NAME);
        await db.collection('mailingQueue').updateOne({_id: chat._id}, {$set: {status: STATUS_FINISHED, messageId}});
        return this.updateCounters('success');
    }

    async updateCounters(counterCode) {
        let query = {processed: 1};
        query[counterCode] = 1;

        let mailingDb = await getDb(MAILING_DB_NAME);
        return mailingDb.collection('mailings').updateOne({id: this.id}, {$inc: query});
    }

    dataUriToBuffer(uri) {
        let data = uri.split(',')[1];
        return Buffer.from(data,'base64');
    }

    async uploadImage(imageBuffer) {
        let uploadedImage = false;

        try {
            const imagePath = tempWrite.sync(imageBuffer);
            uploadedImage = await imgbbUploader(IMGBB_TOKEN, imagePath);
            fs.unlinkSync(imagePath);
        }
        catch (e) {
            throw e;
        }

        return uploadedImage;
    }

    getBestPhoto(photos) {
        let widths = photos.map(photo => photo.width);
        let maxWidth = Math.max.apply(null, widths);

        return photos.find(photo => photo.width === maxWidth);
    }

    async checkIsNew(chat) {
        let db = await getDb(MAILING_DB_NAME);
        let freshChat = await db.collection('mailingQueue').findOne({_id: chat._id});
        return freshChat.status === STATUS_NEW;
    }

    async sendSinglePhotoMessage(chatId, telegram) {
        let options = this.getExtra();
        options['caption'] = this.getMessage();

        if (this.mailing.cachedImage && this.mailing.cachedImage.file_id) {
            return telegram.sendPhoto(chatId, this.mailing.cachedImage.file_id, options);
        }
        else {
            let image = this.mailing.photos[0];
            let buffer = this.dataUriToBuffer(image.src);
            let apiMessage = await telegram.sendPhoto(chatId, {source: buffer}, options);
            this.mailing.cachedImage = this.getBestPhoto(apiMessage.photo);
            await this.saveMailingState();
            return apiMessage;
        }
    }

    async sendLinkedPhotoMessage(chatId, telegram) {
        if (!this.mailing.cachedImage) {
            let image = this.mailing.photos[0];
            let buffer = this.dataUriToBuffer(image.src);
            let uploadedImage = await this.uploadImage(buffer);
            if (!uploadedImage) {
                return false;
            }
            this.mailing.cachedImage = uploadedImage;
            await this.saveMailingState();
        }

        const emptyChar = '‎';
        let imageUrl = this.mailing.cachedImage.url;
        let text = this.getMessage();

        text = `<a href="${imageUrl}">${emptyChar}</a> ${text}`;
        return telegram.sendMessage(chatId, text, this.getExtra());
    }

    async sendMediaGroupMessage(chatId, telegram) {
        let media;
        if (this.mailing.cachedImage) {
            media = this.mailing.cachedImage.map(photo => photo.file_id);
        }
        else {
            media = this.mailing.photos.map(image => {
                return {media: {source: this.dataUriToBuffer(image.src)}, type: 'photo'};
            });
        }

        let mediaGroup;
        let result;
        let hasKeyboard = this.mailing.buttons && this.mailing.buttons.length > 0;

        if (hasKeyboard) {
            mediaGroup = await telegram.sendMediaGroup(chatId, media);
            result = await telegram.sendMessage(chatId, this.getMessage(), this.getExtra());
        }
        else {
            media[0]['caption'] = this.getMessage();
            media[0]['parse_mode'] = 'HTML';
            mediaGroup = await telegram.sendMediaGroup(chatId, media, {});
            result = mediaGroup[0];
        }

        if (!this.mailing.cachedImage) {
            this.mailing.cachedImage = mediaGroup.reduce((files, message) => {
                let photo = this.getBestPhoto(message.photo);
                files.push(photo);
                return files;
            }, []);

            await this.saveMailingState();
        }

        return result;
    }

    async sendPlainTextMessage(chatId, telegram) {
        return telegram.sendMessage(chatId, this.getMessage(), this.getExtra());
    }

    async sendMailingToChat(chat) {
        let response = false;
        let botId = chat.bot;

        let bot = await this.getBot(botId);
        if (!bot) {
            await this.setChatFailed(chat);
            return false;
        }

        let telegram = this.getTelegram(bot.token);

        try {
            let method = this.sendPlainTextMessage;
            if (this.mailing.photos && this.mailing.photos.length > 0) {
                if (this.mailing.photos.length > 1 && !this.mailing.photoAsLink) {
                    method = this.sendMediaGroupMessage;
                }
                else if (this.mailing.photoAsLink) {
                    method = this.sendLinkedPhotoMessage
                }
                else {
                    method = this.sendSinglePhotoMessage;
                }
            }

            let isNew = await this.checkIsNew(chat);
            if (isNew) {
                response = await method.call(this, chat.chatId, telegram);

                if (this.id) {
                    if (!response) {
                        await this.setChatFailed(chat, false);
                    }
                    else {
                        await this.setChatFinished(chat, response.message_id);
                    }
                }
            }
        }
        catch (sendError) {
            if (sendError && sendError.code) {
                if (!this.id) {
                    throw sendError;
                }

                if (sendError.code === 403) {
                    await this.setChatBlock(chat);
                    return false;
                }

                if (sendError.code === 429) {
                    let waitTimeMs = sendError.parameters && sendError.parameters.retry_after > 0
                        ? (sendError.parameters.retry_after || 1) * 1000
                        : 1000;

                    await wait(waitTimeMs);
                    return this.sendMailingToChat(chat);
                }

                await this.setChatFailed(chat, sendError);
                return false;
            }
        }

        return response;
    }

    stopSending() {
        this.stop = true;
        return new Promise(resolve => {
            this.stopResolve = resolve;
        });
    }

    async startSending() {
        if (!this.id) {
            return false;
        }

        let firstChunk = true;
        let isFinished = false;
        while (!isFinished) {
            if (firstChunk) {
                await this.sendNextChunk(1);
                firstChunk = false;
            }
            else {
                await this.sendNextChunk();
            }

            isFinished = await this.checkFinished();
        }

        if (this.stop) {
            if (this.stopResolve) {
                this.stopResolve();
            }
        }
        else {
            process.exit(SIG_STOPPED);
        }
    }

    async checkFinished() {
        let chats = await this.getNextChats();
        let hasChats = chats && chats.length > 0;
        let noChatsLeft = !hasChats;
        return noChatsLeft || this.stop;
    }
}

module.exports = {
    Sender, MAILING_DB_NAME, MAILING_STATUS_NEW, MAILING_STATUS_PROCESSING, MAILING_STATUS_PAUSED, MAILING_STATUS_FINISHED,
    MAILER_BOT_ID,
    TEST_QUEUE_SIZE, TEST_BOT_ID, TEST_USER_ID, TEST_CHAT_ID,
    STATUS_NEW, STATUSES_SUCCESS,
    SIG_STOPPED
};