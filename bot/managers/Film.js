const {getDb} = require('../modules/Database');
const MovieDB = require('node-themoviedb');
const shortid = require('shortid');
const mdb = new MovieDB(process.env.TMDB_KEY, {language: 'ru'});

module.exports = function () {
    let cachedGenres = {tv: [], movie: []};
    return {
        settings(currentUserProfile) {
            let defaultSettings = {
                tvGenres: [],
                movieGenres: [],
            }

            let currentSettings = currentUserProfile ? currentUserProfile.settings || {} : {};

            return  Object.assign(defaultSettings, currentSettings);
        },
        getSessionGenres(session) {
            let searchType = session.searchType || 'tv';
            let genresProp = searchType + 'Genres';
            let currentProfile = session.profile;

            let settings = this.settings(currentProfile);
            return settings[genresProp] || [];
        },
        updateSessionGenres(session, newGenreId) {
            let genreIds = this.getSessionGenres(session);

            let isSelected = genreIds.indexOf(newGenreId) !== -1;
            if (isSelected) {
                let genreIndex = genreIds.indexOf(newGenreId);
                genreIds.splice(genreIndex, 1);
            }
            else {
                genreIds.push(newGenreId);
            }

            let searchType = session.searchType || 'tv';
            let genresProp = searchType + 'Genres';

            let currentProfile = session.profile || {};
            let settings = this.settings(currentProfile);
            settings[genresProp] = genreIds;

            session.profile = currentProfile;
            session.profile.settings = settings;
            return session;
        },
        async saveProfile(profile) {
            const db = await getDb();
            const profiles = db.collection('profiles');

            if (!profile.id) {
                profile.id = shortid.generate();
            }

            const id = profile.id;
            let updateResult = await profiles.findOneAndReplace({id}, profile, {upsert: true, returnOriginal: false});
            return updateResult.value || false;
        },
        initSessionProfileMiddleware() {
            return async (ctx, next) => {
                let canInit = ctx.session && ctx.update && ctx.update.message && ctx.update.message.from;
                if (!canInit) {
                    return next();
                }

                if (ctx.session && ctx.session.profile) {
                    return next();
                }

                const fromInfo = ctx.update.callback_query
                    ? ctx.update.callback_query.from
                    : ctx.update.message.from;
                const chatInfo = ctx.update.callback_query
                    ? ctx.update.callback_query.message.chat
                    : ctx.update.message.chat;

                const userId = fromInfo.id;

                ctx.session.userId = userId;
                ctx.session.chatId = chatInfo.id;

                if (!ctx.session.profile) {
                    ctx.session.profile = await this.loadProfileByUserId(userId);
                    if (!ctx.session.profile) {
                        ctx.session.profile = {};
                    }
                }

                ctx.session.profile.userId = userId;
                ctx.session.profile.chatId = chatInfo.id;

                return next();
            }
        },
        async loadProfileByUserId(userId) {
            const db = await getDb();
            const profiles = db.collection('profiles');

            let profile = await profiles.findOne({userId});
            return profile;
        },
        async genresList(searchType) {
            let getGenres = searchType === 'tv' ? mdb.genre.getTVList : mdb.genre.getMovieList;
            let rawGenres = await getGenres();

            cachedGenres[searchType] = rawGenres.data.genres;

            return cachedGenres[searchType];
        },
        async discoverAtIndex(searchType, genreIds, index) {
            let discoverFn = mdb.discover[searchType];
            const pageSize = 20;
            const pageNum = Math.floor(index/pageSize)+1;
            const pageIndex = index - (pageNum-1)*pageSize;

            const args = {
                query: {
                    page: pageNum,
                    with_genres: genreIds.join(','),
                },
            };

            let genres = cachedGenres[searchType] && cachedGenres[searchType].length > 0
                ? cachedGenres[searchType]
                : await this.genresList(searchType);

            let response = await discoverFn(args);
            let pageResults = response.data;
            let film = pageResults.results[pageIndex];

            film.genre = film.genre_ids.map( genreId => {
                let genre = genres.find( item => item.id === genreId );
                return genre.name;
            });

            let pageFilms = pageResults.results;
            let totalFilms = pageResults.total_results;
            let hasNext = index < totalFilms-1;
            let hasPrev = index > 0;

            return {film, hasPrev, hasNext, index, totalFilms, pageFilms} || false;
        },
        async saveLike(userId, chatId, film) {
            const db = await getDb();
            const likes = db.collection('likes');

            return likes.insertOne({userId, chatId, film});
        }
    }
}