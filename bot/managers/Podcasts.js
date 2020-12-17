const axios = require('axios');
const {getDb} = require('../modules/Database');
const {getCache} = require('../modules/Cache');
const {parseUrl} = require('../bots/helpers/parser');

const getParser = require('../bots/parsers/sound');
const {getDomain} = require('../bots/helpers/common');

const LIST_URL = 'https://api.rating.mave.digital/v1/podcasts';

const supported = [
    {code: 'yandex', domains: ['music.yandex.ru', 'music.yandex.by'], list: true, download: true, priority: 3},
    {code: 'soundcloud', domains: ['soundcloud.com'], list: true, download: true, priority: 2},
    {code: 'apple', domains: ['podcasts.apple.com', 'apple.co'], list: true, download: true, priority: 1 },
    {code: 'wefo', domains: ['we.fo'], isProxy: true},
    {code: 'bandlink', domains: ['band.link'], isProxy: true},
]

module.exports = function () {
    return {
        async listPodcasts(categoryIds, sort) {
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

                    list = list.filter(podcast => categoryNames.indexOf(podcast.category) !== -1);
                }

                if (sort) {
                    list.sort((a, b) => {
                        let sortField = Object.keys(sort)[0] || false;
                        let dir = sortField ? sort[sortField] : false;
                        let objectField = `${sortField}_count`;

                        return sortField
                            ? (a[objectField] - b[objectField]) * dir
                            : 0;
                    });
                }

                return list;
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
        async getFinalPodcastLink(baseUrl) {
            let cache = await getCache();

            return cache.getPermanent('podcast_final_link_'+baseUrl, async () => {
                let {allLinks} = await parseUrl(baseUrl, {
                    allLinks(document) {
                        let linkEls = document.querySelectorAll('a[href]');
                        let links = [];
                        linkEls.forEach(el => links.push(el.getAttribute('href').trim().toLowerCase()));

                        return links;
                    }
                });

                let externalLinks = allLinks.filter(link => link.indexOf('http') === 0);
                let directPlatforms = supported.filter(platform => !platform.isProxy);
                let supportedDomains = directPlatforms.reduce((domains, platform) => domains.concat(platform.domains), []);
                let supportedLinks = externalLinks.filter(link => supportedDomains.indexOf(getDomain(link)) !== -1);
                if (supportedLinks.length === 0) {
                    return false;
                }

                let platforms = supportedLinks.map(link => supported.find(item => item.domains.indexOf(getDomain(link)) !== -1));

                let sortedPlatforms = platforms.slice();
                sortedPlatforms.sort((a, b) => a.priority - b.priority);
                let selectedPlatform = sortedPlatforms[0];

                let selectedIndex = platforms.findIndex(platform => platform.code === selectedPlatform.code);

                return selectedIndex !== -1
                    ? supportedLinks[selectedIndex]
                    : false;
            });
        },
        async getFinalPlatformByUrl(baseUrl) {
            let finalUrl = await this.getFinalPodcastLink(baseUrl);
            return finalUrl ? this.getPlatformByUrl(finalUrl) : false;
        },
        async getPlatformByUrl(url, final = true) {
            let domain = getDomain(url);
            let platform = supported.find(item => item.domains.indexOf(domain) !== -1);

            if (platform && platform.isProxy && final) {
                return this.getFinalPlatformByUrl(url);
            }

            return platform || false;
        },
        async getPlatform(podcast, final = true) {
            if (!podcast) {
                return false;
            }

            return this.getPlatformByUrl(podcast.link, final);
        },
        async isListSupported(podcast) {
            let platform = await this.getPlatform(podcast);
            return platform ? platform.list : false;
        },
        async isDownloadSupported(podcast) {
            let platform = await this.getPlatform(podcast);
            return platform ? platform.download : false;
        },
        async getPodcastByIndex(index, categoryIds, sort, searchType, favorites) {
            let list = await this.listPodcasts(categoryIds, sort);
            if (!list) {
                return  false;
            }

            if (searchType === 'favorite') {
                list = list.filter(podcast => favorites.indexOf(podcast.id) !== -1);
            }

            let podcast = list[index] || false;
            let hasPrev = index > 0;
            let totalPodcasts = list.length;
            let hasNext = index < totalPodcasts-1;
            let isFavorite = podcast && favorites && favorites.length > 0 ? favorites.indexOf(podcast.id) !== -1 : false;

            return {podcast, hasPrev, hasNext, index, totalPodcasts, isFavorite} || false;
        },

        async getVolumesByPodcast(podcast) {
            let platform = await this.getPlatform(podcast, false);
            let url = platform.isProxy
                ? await this.getFinalPodcastLink(podcast.link)
                : podcast.link;

            let parser = getParser(url);
            if (parser) {
                let cache = await getCache();

                let volumes = await cache.getPermanent('podcast_volumes_'+podcast.id, async () => {
                    return parser.parseVolumes(url);
                });

                if (volumes && volumes.length > 0) {
                    volumes.reverse();
                }

                return volumes;
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

        getSavedSort(ctx) {
            return ctx.session.profile
                ? ctx.session.profile.sort || {}
                : {};
        },
        async toggleInFavourites(profile, podcast, profileManager) {
            if (!profile.favorite) {
                profile.favorite = [];
            }

            let favIndex = profile.favorite.indexOf(podcast.id);
            if (favIndex === -1) {
                profile.favorite.push(podcast.id);
            }
            else {
                profile.favorite.splice(favIndex, 1);
            }

            return profileManager.saveProfile(profile);
        },
        async saveListen(userId, podcast, volume = false) {
            let db = await getDb();
            let listens = db.collection('listens');
            return listens.insertOne({userId, podcast, volume});
        }
    }
}