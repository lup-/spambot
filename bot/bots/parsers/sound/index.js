const yandexParser = require('./yandex');
const soundcloudParser = require('./soundcloud');
const appleParser = require('./apple');

const {getDomain} = require('../../helpers/common');

module.exports = function getParser(url) {
    let domain = getDomain(url);

    switch (domain) {
        case 'music.yandex.ru':
        case 'music.yandex.by':
            return new yandexParser();
        case 'soundcloud.com':
            return new soundcloudParser();
        case 'podcasts.apple.com':
        case 'apple.co':
            return new appleParser();
    }

    return false;
}