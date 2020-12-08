const axios = require('axios');
const {parseUrl} = require('../../helpers/parser');
const {wait} = require('../../../modules/Helpers');

module.exports = function () {
    return {
        getCollectionApiUrl(podcastId) {
            return `https://amp-api.podcasts.apple.com/v1/catalog/ru/podcasts/${podcastId}/episodes?offset=0&limit=10`;
        },
        async getMetadata(url) {
            let {config, podcastId} = await parseUrl(url, {
                config(document) {
                    let meta = document.querySelector('meta[name="web-experience-app/config/environment"]');
                    let encodedJSON = meta.getAttribute('content');
                    let json = decodeURIComponent(encodedJSON);

                    return JSON.parse(json);
                },
                podcastId(document) {
                    let meta = document.querySelector('meta[name="apple:content_id"]');
                    return meta.getAttribute('content');
                }
            });

            const mediaToken = config.MEDIA_API.token;

            return {config, podcastId, mediaToken} ;
        },
        async parseVolumes(url) {
            let {podcastId, mediaToken} = await this.getMetadata(url);

            let episodes = [];
            let nextUrl = this.getCollectionApiUrl(podcastId);
            do {
                try {
                    let {data} = await axios.get(nextUrl, {
                        headers: {'authorization': 'Bearer '+mediaToken}
                    });
                    episodes = episodes.concat(data.data);
                    nextUrl = data.next ? 'https://amp-api.podcasts.apple.com'+data.next : false;
                }
                catch (e) {
                    await wait(1000);
                }
            }
            while (nextUrl);

            return episodes.map(episode => {
                return {
                    platformId: episode.id,
                    season: episode.attributes.seasonNumber,
                    number: episode.attributes.episodeNumber,
                    title: episode.attributes.name,
                    description: episode.attributes.description.standard,
                    duration: episode.attributes.durationInMilliseconds,
                    pageUrl: episode.attributes.url,
                }
            });
        },
        async getTrackMp3(trackUrl) {
            let {mediaSrc} = await parseUrl(trackUrl, {
                mediaSrc(document) {
                    try {
                        let config = JSON.parse(document.querySelector('#shoebox-ember-data-store').innerHTML);
                        return config && config.data && config.data.attributes && config.data.attributes.assetUrl
                    }
                    catch (e) {
                        return  false;
                    }
                }
            });

            let {data} = await axios.get(mediaSrc, {responseType: 'stream'});
            return data;
        }
    }
}