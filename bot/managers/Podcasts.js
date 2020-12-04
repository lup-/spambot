const axios = require('axios');
const {getDb} = require('../modules/Database');
const {getCache} = require('../modules/Cache');

const getParser = require('../bots/parsers/sound');
const {getDomain} = require('../bots/helpers/common');

const LIST_URL = 'https://api.rating.mave.digital/v1/podcasts';

const supported = [
    {code: 'yandex', domains: ['music.yandex.ru', 'music.yandex.by'], list: true, download: true},
    {code: 'soundcloud', domains: ['soundcloud.com'], list: true, download: true},
]

module.exports = function () {
    return {
        async listPodcasts(categoryIds) {
            let cache = await getCache();

            try {
                let list = await cache.getPermanent('podcasts_list', async () => {
                    let {data} = await axios(LIST_URL);
                    return data;
                }, 86400);

                let hasSelectedCategories = categoryIds && categoryIds.length > 0;
                if (hasSelectedCategories) {
                    let allCategories = await this.listCategories();
                    let categoryNames = allCategories
                        .filter(category => categoryIds.indexOf(category.id) !== -1)
                        .map(category => category.title);

                    return list.filter(podcast => categoryNames.indexOf(podcast.category) !== -1);
                }
                else {
                    return list;
                }
            }
            catch (e) {
                return false;
            }
        },
        async listCategories() {
            let list = await this.listPodcasts();
            if (!list) {
                return  false;
            }

            let categoryNames = list
                .map(podcast => podcast.category)
                .filter( (item, index, coll) => coll.indexOf(item) === index );
            categoryNames.sort();
            return categoryNames.map((title, id) => ({id, title}));
        },
        getPlatform(podcast) {
            if (!podcast) {
                return false;
            }
            let domain = getDomain(podcast.link);
            let platform = supported.find(item => item.domains.indexOf(domain) !== -1);
            return platform || false;
        },
        isListSupported(podcast) {
            let platform = this.getPlatform(podcast);
            return platform ? platform.list : false;
        },
        isDownloadSupported(podcast) {
            let platform = this.getPlatform(podcast);
            return platform ? platform.download : false;
        },
        async getPodcastByIndex(index, categoryIds) {
            let list = await this.listPodcasts(categoryIds);
            if (!list) {
                return  false;
            }

            let podcast = list[index] || false;
            let hasPrev = index > 0;
            let totalPodcasts = list.length;
            let hasNext = index < totalPodcasts-1;

            return {podcast, hasPrev, hasNext, index, totalPodcasts} || false;
        },

        async getVolumesByPodcast(podcast) {
            let parser = getParser(podcast.link);
            if (parser) {
                let cache = await getCache();

                return cache.getPermanent('podcast_volumes_'+podcast.id, async () => {
                    return parser.parseVolumes(podcast.link);
                });
            }

            return false;
        },

        async getVolumeMp3(volume) {
            let parser = getParser(volume.pageUrl);
            if (parser) {
                return parser.getTrackMp3(volume.pageUrl);
            }

            return false;
        },

        getSavedCategories(ctx) {
            return ctx.session.category
                ? ctx.session.category
                : (ctx.session.profile ? ctx.session.profile.category || []: []);
        },

        async saveListen(userId, podcast, volume = false) {
            let db = await getDb();
            let listens = db.collection('listens');
            return listens.insertOne({userId, podcast, volume});
        }
    }
}