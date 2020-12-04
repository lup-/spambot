const axios = require('axios');
const {parseUrl} = require('../../helpers/parser');

function makeRandomHash(length) {
    let result           = '';
    let characters       = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

module.exports = function () {
    return {
        parseIds(trackUrl) {
            try {
                let [, albumId, trackId] = trackUrl.match(/\/album\/(.*?)\/track\/([^\/]*)/i);
                return {albumId, trackId};
            }
            catch (e) {
                return false;
            }
        },
        getUrls(trackId, albumId) {
            let mp3InfoUrl = `https://music.yandex.ru/api/v2.1/handlers/track/${trackId}:${albumId}/web-album-track-track-saved/download/m`;
            let pageUrl = `https://music.yandex.ru/album/${albumId}/track/${trackId}`;
            return {mp3InfoUrl, pageUrl}
        },

        async parseVolumes(url) {
            let {trackList} = await parseUrl(url, {
                trackList(document) {
                    let script = document.querySelectorAll('script[nonce]')[2];

                    if (!script) {
                        return false;
                    }

                    let podcastData = JSON.parse( script.innerHTML.replace(/^var Mu=/, '').replace(/;$/, '') );
                    return podcastData && podcastData.pageData
                        ? podcastData.pageData.volumes[0]
                        : false;
                }
            });

            if (!trackList) {
                return false;
            }

            let issues = [];

            for (const yandexTrack of trackList) {
                let trackId = yandexTrack.id;
                let albumId = yandexTrack.albums[0].id;
                let number = yandexTrack.albums[0].trackPosition.index;

                let {pageUrl} = this.getUrls(trackId, albumId);

                let issue = {
                    platformId: trackId,
                    number,
                    title: yandexTrack.title,
                    duration: yandexTrack.durationMs,
                    pageUrl,
                };

                issues.push(issue);
            }

            return issues;
        },
        async getTrackMp3(trackUrl) {
            let {albumId, trackId} = this.parseIds(trackUrl);
            if (!trackId) {
                return false;
            }

            let {mp3InfoUrl, pageUrl} = this.getUrls(trackId, albumId);

            let response = await axios.get(mp3InfoUrl, {
                headers: {
                    'X-Retpath-Y': encodeURI(pageUrl),
                }
            });
            let data = response.data;

            let mp3DownloadInfoUrl = data ? 'https:'+data.src+'&format=json' : false;
            response = await axios.get(mp3DownloadInfoUrl);
            data = response.data;

            let hash = makeRandomHash(32);
            let downloadUrl = `https://${data.host}/get-mp3/${hash}/${data.ts}${data.path}?track-id=${trackId}&play=false`;

            response = await axios.get(downloadUrl, {responseType: 'stream'});
            return response.data;
        }
    }
}