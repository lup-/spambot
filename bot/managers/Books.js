const qs = require('qs');
const got = require('got');
const axios = require('axios');
const CryptoJS = require('crypto-js');
const {getDb} = require('../modules/Database');
const {CookieJar} = require('tough-cookie');
const {parseUrl} = require('../bots/helpers/parser');
const {trimHTML} = require('../modules/Helpers');

const FLIBUSTA_BASE = 'http://flibusta.is';
const FLIBUSTA_SEARCH_URL = 'http://flibusta.is/makebooklist';

const AUDIOBOOKS_SEARCH_URL = 'https://akniga.org/search/books';
const MAX_RESULTS = 50;

module.exports = function (proxyMgr) {
    return {
        proxyMgr,
        getHash(LIVESTREET_SECURITY_KEY) {
            const CryptoJSAesJson = {
                stringify(e) {
                    let a = {
                        ct: e.ciphertext.toString(CryptoJS.enc.Base64)
                    };
                    if (e.iv)
                        a.iv = e.iv.toString();
                    if (e.salt)
                        a.s = e.salt.toString();
                    return JSON.stringify(a);
                },
                parse(e) {
                    let a = JSON.parse(e)
                    let t = CryptoJS.lib.CipherParams.create({
                        ciphertext: CryptoJS.enc.Base64.parse(a.ct)
                    });
                    if (a.iv)
                        t.iv = CryptoJS.enc.Hex.parse(a.iv);
                    if (a.s)
                        t.salt = CryptoJS.enc.Hex.parse(a.s);
                    return t;
                }
            };

            return CryptoJS.AES.encrypt(JSON.stringify(LIVESTREET_SECURITY_KEY), 'EKxtcg46V', {
                format: CryptoJSAesJson
            }).toString();
        },
        getPlatform(isAudio) {
            return isAudio ? 'akniga.org' : 'flibusta.is';
        },

        getProxyAgent() {
            return this.proxyMgr.getAgentRoundRobin();
        },

        async checkProxyAndThrowError(proxyAgent, url, error, src) {
            if (proxyAgent && proxyAgent.inputProxy) {
                await this.proxyMgr.excludeProxyOnError(proxyAgent.inputProxy, url, error);
            }

            console.log(src, error);
            throw error;
        },

        async getBookPage(searchText, sort, page = 1) {
            let params = {'ab': 'ab1', 't': searchText, sort, page: page-1};
            let query = Object.keys(params).map(key => {
                let value = encodeURIComponent(params[key]);
                return `${key}=${value}`;
            }).join('&');

            let url = `${FLIBUSTA_SEARCH_URL}?${query}`;
            let proxyAgent = await this.getProxyAgent();

            let error;
            try {
                let result = await parseUrl(url, {
                    books(document) {
                        let bookEls = document.querySelectorAll('form div');

                        let books = [];
                        for (const bookEl of bookEls) {
                            let authors = bookEl.innerHTML.match(/(?<!пер\. +)\<a href=\"\/a\/\d+\"\>(.*?)<\/a>/ig);
                            authors = authors ? authors.map(tag => tag.replace(/<.*?>/g, '')) : false;

                            let genreEls = bookEl.querySelectorAll('a.genre');
                            let downloadEls = bookEl.querySelectorAll('a[href^="/b/"]');
                            let sizeEl = bookEl.querySelector('[style="size"]');

                            let genres = [];
                            for (const genreEl of genreEls) {
                                genres.push(genreEl.innerHTML.trim());
                            }

                            let id = false;
                            let title = false;
                            let link = false;
                            let downloads = [];
                            for (const downloadEl of downloadEls) {
                                let uri = downloadEl.getAttribute('href');
                                let url = FLIBUSTA_BASE + uri;
                                let urlParts = uri.split('/');
                                let format = urlParts[3] || false;

                                if (format) {
                                    if (format !== 'read') {
                                        downloads.push({url, format});
                                    }
                                } else {
                                    id = parseInt(uri.replace('/b/', ''));
                                    title = trimHTML(downloadEl.innerHTML.trim());
                                    link = url;
                                }
                            }

                            let size = sizeEl ? sizeEl.innerHTML.trim() : false;
                            let mainAuthor = authors ? authors[authors.length - 1] : false;

                            books.push({id, title, authors, mainAuthor, genres, link, size, downloads});
                        }

                        return books;
                    },
                    pageCount(document) {
                        let lastPageEl = document.querySelector('.pager-last a');
                        if (!lastPageEl) {
                            return false;
                        }

                        try {
                            let uri = lastPageEl.getAttribute('href');
                            let pageNum = parseInt(uri.replace(/[^\d]/g, ''));
                            return pageNum;
                        } catch (e) {
                            return false;
                        }
                    }
                }, false, false, proxyAgent);

                return result;
            }
            catch (e) {
                error = e;
            }

            if (error) {
                await this.checkProxyAndThrowError(proxyAgent, url, error, 'Books.js:147');
            }
        },
        async getAudioBookPage(searchText, page = 1) {
            let url = `${AUDIOBOOKS_SEARCH_URL}/page${page}/?q=${encodeURIComponent(searchText)}`;
            let proxyAgent = await this.getProxyAgent();
            let error;
            try {
                let result = parseUrl(url, {
                books(document) {
                    let bookEls = document.querySelectorAll('.content__main__articles--item');

                    let books = [];
                    for (const bookEl of bookEls) {
                        let linkEl = bookEl.querySelector('.content__article-main-link');
                        let titleEl = bookEl.querySelector('.caption__article-main');
                        let genreEl = bookEl.querySelector('.section__title');
                        let authorEl = bookEl.querySelector('.link__action--author a[href*="author"]');
                        let performerEl = bookEl.querySelector('.link__action--author a[href*="performer"]');
                        let fragmentEl = bookEl.querySelector('.caption__article-preview');
                        let descriptionEl = bookEl.querySelector('.description__article-main');
                        let hoursEl = bookEl.querySelector('.link__action--label--time .hours');
                        let minutesEl = bookEl.querySelector('.link__action--label--time .minutes');
                        let ratingEl = bookEl.querySelector('.js-favourite-count');

                        let id = bookEl.getAttribute('data-bid') ? parseInt( bookEl.getAttribute('data-bid') ) : false;
                        let headline = titleEl ? titleEl.innerHTML.trim() : ' - ';
                        let [authors, title] = headline.split(' - ');
                        authors = authors.split(', ');

                        let genre = genreEl ? genreEl.innerHTML.replace(/<.*?>/g, ' ').trim() : false;
                        let mainAuthor = authorEl ? authorEl.innerHTML.trim() : false;
                        let performer = performerEl ? performerEl.innerHTML.trim() : false;
                        let isFragment = fragmentEl ? true : false;
                        let description = descriptionEl ? descriptionEl.innerHTML.trim() : false;

                        let hours = hoursEl ? parseInt(hoursEl.innerHTML.replace(/[^\d]/g, '')) : 0;
                        let minutes = minutesEl ? parseInt(minutesEl.innerHTML.replace(/[^\d]/g, '')) : 0;
                        let duration = hours > 0 || minutes > 0 ? hours * 60 + minutes : false;
                        let rating = ratingEl ? ratingEl.innerHTML.trim() : false;

                        let link = linkEl ? linkEl.getAttribute('href') : false;

                        if (link && title) {
                            books.push({
                                id,
                                title,
                                genre,
                                link,
                                authors,
                                mainAuthor,
                                performer,
                                isFragment,
                                description,
                                duration,
                                rating
                            });
                        }
                    }

                    return books;
                },
                pageCount(document) {
                    let pageEls = document.querySelectorAll('.page__nav--standart');
                    let lastPageEl = pageEls && pageEls.length > 0
                        ? pageEls[pageEls.length - 1]
                        : false;

                    if (!lastPageEl) {
                        return false;
                    }

                    try {
                        return parseInt(lastPageEl.innerHTML);
                    }
                    catch (e) {
                        return false;
                    }
                }
            }, false, false, proxyAgent);
                return result;
            }
            catch (e) {
                error = e;
            }

            if (error) {
                await this.checkProxyAndThrowError(proxyAgent, url, error, 'Books.js:243');
            }
        },

        async getBookList(searchText, sort) {
            let currentPage = 1;
            let totalPages = false;
            let fetchedBooks = [];

            while ((totalPages === false || currentPage < totalPages) && fetchedBooks.length < MAX_RESULTS) {
                try {
                    let {books, pageCount} = await this.getBookPage(searchText, sort, currentPage);
                    if (totalPages === false) {
                        totalPages = pageCount || 1;
                    }

                    currentPage++;
                    fetchedBooks = fetchedBooks.concat(books);
                }
                catch (e) {
                    return false;
                }
            }

            return fetchedBooks;
        },
        async getAudioBookList(searchText) {
            let currentPage = 1;
            let totalPages = false;
            let fetchedBooks = [];

            while ((totalPages === false || currentPage < totalPages) && fetchedBooks.length < MAX_RESULTS) {
                try {
                    let {books, pageCount} = await this.getAudioBookPage(searchText, currentPage);
                    if (totalPages === false) {
                        totalPages = pageCount || 1;
                    }

                    currentPage++;
                    fetchedBooks = fetchedBooks.concat(books);
                }
                catch (e) {
                    return false;
                }
            }

            return fetchedBooks;
        },

        async getBook(mediaUrl) {
            let options = {responseType: 'stream'};
            let proxyAgent = await this.getProxyAgent();
            if (proxyAgent) {
                options.httpAgent = proxyAgent;
                options.httpsAgent = proxyAgent;
            }

            let error;
            try {
                let {data} = await axios.get(mediaUrl, options);
                return data;
            }
            catch (e) {
                error = e;
            }

            if (error) {
                await this.checkProxyAndThrowError(proxyAgent, mediaUrl, error, 'Books.js:291');
            }
        },
        async getAudioBook(link) {
            let proxyAgent = await this.getProxyAgent();
            const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36';

            let cookieJar;
            let bookId;
            let lsKey;
            let error;
            try {
                let result = await parseUrl(link, {
                    bookId(document) {
                        let articleEl = document.querySelector('article[data-bid]');
                        return articleEl
                            ? articleEl.getAttribute('data-bid')
                            : false;
                    },
                    lsKey(document) {
                        let scriptEls = document.querySelectorAll('script');
                        let lsKey = false;
                        for (const scriptEl of scriptEls) {
                            let hasLsKey = scriptEl.innerHTML.indexOf('LIVESTREET_SECURITY_KEY') !== -1;
                            if (hasLsKey) {
                                let matches = scriptEl.innerHTML.match(/LIVESTREET_SECURITY_KEY *= *\\*'*([^\\',]+)/);
                                if (matches && matches[1]) {
                                    lsKey = matches[1];
                                }
                            }
                        }

                        return lsKey;
                    }
                }, new CookieJar(), USER_AGENT, proxyAgent);
                cookieJar = result.cookieJar;
                bookId = result.bookId;
                lsKey = result.lsKey;
            }
            catch (e) {
                error = e;
            }

            if (error) {
                await this.checkProxyAndThrowError(proxyAgent, link, error, 'Books.js:335');
            }

            let dataLink = `https://akniga.org/ajax/b/${bookId}`;
            let gotOptions = {
                headers: {
                    'user-agent': USER_AGENT,
                    'content-type': 'application/x-www-form-urlencoded'
                },
                body: qs.stringify({
                    bid: bookId,
                    hash: this.getHash(lsKey),
                    security_ls_key: lsKey,
                }),
                cookieJar
            };

            if (proxyAgent) {
                gotOptions.agent = {http: proxyAgent, https: proxyAgent};
            }

            let response;
            try {
                response = await got.post(dataLink, gotOptions);
            }
            catch (e) {
                error = e;
            }

            if (error) {
                await this.checkProxyAndThrowError(proxyAgent, dataLink, error, 'Books.js:365');
            }

            let params;
            try {
                params = JSON.parse(response.body.toString());
            }
            catch (e) {
                params = false;
            }

            if (!params) {
                return false;
            }

            let mediaUrl;
            if (params.srv) {
                let fileName = encodeURIComponent(`01. ${params.title}.mp3`);
                mediaUrl = `${params.srv}b/${bookId}/${params.key}/${fileName}`;
            }
            else if (params.preview_url) {
                mediaUrl = params.preview_url;
            }

            try {
                let {data} = await axios.get(mediaUrl, {responseType: 'stream'});
                return data;
            }
            catch (e) {
                error = e;
            }

            if (error) {
                await this.checkProxyAndThrowError(proxyAgent, mediaUrl, error, 'Books.js:398');
            }

            return false;
        },

        async saveFile(platform, bookId, format, file) {
            const db = await getDb();
            return db.collection('files').insertOne({platform, bookId, format, file});
        },
        async getFile(platform, bookId, format) {
            const db = await getDb();
            return db.collection('files').findOne({platform, bookId, format});
        },
        async saveDownload(platform, bookId, format, userId) {
            const db = await getDb();
            return db.collection('downloads').insertOne({platform, bookId, format, userId});
        }
    }
}