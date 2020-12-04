const yandexParser = require('./yandex');
const soundcloudParser = require('./soundcloud');

const {getDomain} = require('../../helpers/common');

module.exports = function getParser(url) {
    let domain = getDomain(url);

    switch (domain) {
        case 'music.yandex.ru':
        case 'music.yandex.by':
            return new yandexParser();
        case 'soundcloud.com':
            return new soundcloudParser();
    }

    return false;
}