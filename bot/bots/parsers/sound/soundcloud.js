const axios = require('axios');
const {parseUrl} = require('../../helpers/parser');

module.exports = function () {
    return {
        async getMetadata(url) {
            let {soundCloudUserId, soundCloudTrackId, scriptsUrl, transcodings} = await parseUrl(url, {
                soundCloudUserId(document) {
                    let meta = document.querySelector('meta[property="twitter:app:url:iphone"]');
                    let url = meta.getAttribute('content');
                    return url.indexOf('users') !== -1 ? url.replace('soundcloud://users:', '') : false;
                },
                soundCloudTrackId(document) {
                    let meta = document.querySelector('meta[property="twitter:app:url:iphone"]');
                    let url = meta.getAttribute('content');
                    return url.indexOf('sounds') !== -1 ? url.replace('soundcloud://sounds:', '') : false;
                },
                scriptsUrl(document) {
                    let scriptTags = document.querySelectorAll('script[src]');
                    let scriptUrls = [];

                    for (const tag of scriptTags) {
                        scriptUrls.push(tag.getAttribute('src'));
                    }

                    return scriptUrls.filter(src => /\.js$/.test(src));
                },
                transcodings(document) {
                    let scriptTags = document.querySelectorAll('script');
                    let transcodings = false;

                    for (const scriptTag of scriptTags) {
                        let jsScript = scriptTag.innerHTML;
                        let hasData = jsScript && jsScript.indexOf('transcodings') !== -1;

                        if (hasData) {
                            try {
                                transcodings = JSON.parse(jsScript.match(/"transcodings":(\[\{.*?\}\])/)[1]);
                            }
                            catch (e) {}
                        }
                    }

                    return transcodings;
                }
            });

            let clientId = false;
            try {
                let jsFiles = await axios.all(scriptsUrl.map(url => axios.get(url)));
                for (const jsFile of jsFiles) {
                    let result = jsFile.data.match(/client_id=([a-zA-Z0-9]{32})/i);
                    if (result && result[1]) {
                        clientId = result[1];
                    }
                }
            }
            catch (e) {
                return false;
            }

            return {soundCloudUserId, soundCloudTrackId, clientId, transcodings};
        },
        getCollectionApiUrl(soundCloudUserId, clientId) {
            return `https://api-v2.soundcloud.com/stream/users/${soundCloudUserId}?client_id=${clientId}&limit=20`;
        },
        async parseVolumes(url) {
            let {soundCloudUserId, clientId} = await this.getMetadata(url);

            let collection = [];
            let nextUrl = this.getCollectionApiUrl(soundCloudUserId, clientId);
            do {
                let {data} = await axios.get(nextUrl);
                collection = collection.concat(data.collection);
                nextUrl = data.next_href;
                if (nextUrl) {
                    nextUrl += `&client_id=${clientId}`;
                }
            }
            while (nextUrl);

            return collection.filter(item => item.type === 'track').map((item, index, array) => {
                let number = array.length - index;
                return {
                    platformId: item.track.id,
                    number,
                    title: item.track.title,
                    description: item.track.description,
                    duration: item.track.duration,
                    pageUrl: item.track.permalink_url,
                }
            });
        },
        async getTrackMp3(trackUrl) {
            let {clientId, transcodings} = await this.getMetadata(trackUrl);
            let progressiveTrack = transcodings.find(media => media.format && media.format.protocol === 'progressive');

            if (!progressiveTrack) {
                return false;
            }

            let mediaDataUrl = progressiveTrack.url+`?client_id=${clientId}`;
            let response = await axios.get(mediaDataUrl);

            let downloadUrl = response.data.url;
            let {data} = await axios.get(downloadUrl, {responseType: 'stream'});

            return data;
        }
    }
}
