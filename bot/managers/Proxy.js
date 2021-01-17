const hpagent = require('hpagent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const got = require('got');
const moment = require('moment');

const {getDb} = require('../modules/Database');
const {parseUrl} = require('../bots/helpers/parser');

const PROXY_DB_NAME = 'botofarmer';
const PROXY_SOURCE_URL = 'https://scrapingant.com/free-proxies/';
const CHECK_URL = 'https://google.com';
const CHECK_TIMEOUT = 5000;
const REQUEST_TIMEOUT = 10000;

module.exports = class Proxy {
    constructor() {
        this.roundrobinIndex = 0;
        this.loaded = false;
        this.proxyPool = [];
    }

    async check(proxy, url = CHECK_URL) {
        let proxyAgent = this.getAgent(proxy);

        try {
            let result = await got(url, {
                timeout: CHECK_TIMEOUT,
                agent: {http: proxyAgent, https: proxyAgent},
            });

            return result && result.statusCode && result.statusCode === 200;
        }
        catch (e) {
            return false;
        }
    }

    async fetchNewList() {
        let allProxies = [];
        let {proxies} = await parseUrl(PROXY_SOURCE_URL, {
            proxies(document) {
                let proxyRows = document.querySelectorAll('.proxies-table tr');

                let proxies = [];
                for (let proxyRow of proxyRows) {
                    const dataEls = proxyRow.querySelectorAll('td');

                    let host = dataEls[0] ? dataEls[0].innerHTML.toLowerCase() : false;
                    let port = dataEls[1] ? parseInt(dataEls[1].innerHTML.toLowerCase()) : false;
                    let type = dataEls[2] ? dataEls[2].innerHTML.toLowerCase() : false;

                    let isTitle = !host || host === 'ip';

                    if (!isTitle) {
                        proxies.push({host, port, type})
                    }
                }

                return proxies;
            }
        });

        if (proxies && proxies.length) {
            allProxies = allProxies.concat(proxies);
        }

        let {freeproxies} = await parseUrl('https://freeproxyip.net/', {
            freeproxies(document) {
                let proxyRows = document.querySelectorAll('#best table tr');

                let proxies = [];
                for (let proxyRow of proxyRows) {
                    const headEl = proxyRow.querySelector('th[scope="row"]');
                    const dataEls = proxyRow.querySelectorAll('td');

                    let hostPort = headEl ? headEl.innerHTML.toLowerCase() : false;
                    let [host, port] = hostPort ? hostPort.split(':') : [false, false];
                    let type = dataEls[0] ? dataEls[0].innerHTML.toLowerCase() : false;
                    if (port) {
                        port = parseInt(port);
                    }

                    let isTitle = !host || host === 'ip:port';

                    if (!isTitle) {
                        proxies.push({host, port, type})
                    }
                }

                return proxies;
            }
        });

        if (freeproxies && freeproxies.length) {
            allProxies = allProxies.concat(freeproxies);
        }

        return allProxies;
    }

    async updateProxyList() {
        let db = await getDb(PROXY_DB_NAME);
        let fetchedProxies = await this.fetchNewList();

        let proxies = fetchedProxies.filter(proxy => proxy.type !== 'http');

        for (let proxy of proxies) {
            let checkResult = await this.check(proxy);

            let updateFields = {
                basicCheck: checkResult,
                lastCheck: moment().unix(),
            }

            await db.collection('proxies').findOneAndUpdate(
                {host: proxy.host, port: proxy.port, type: proxy.type},
                {$set: updateFields},
                {upsert: true, returnOriginal: false}
            );
        }

        return this.initProxyPool();
    }

    async recheckUsageFailed() {
        let db = await getDb(PROXY_DB_NAME);
        let proxies = await db.collection('proxies').find({usageCheck: true}).toArray();

        for (let proxy of proxies) {
            if (!proxy.failedUrl) {
                continue;
            }

            let usageCheck = await this.check(proxy, proxy.failedUrl);

            let basicCheck = usageCheck;
            if (!usageCheck) {
                basicCheck = await this.check(proxy);
            }

            let updateFields = {
                basicCheck,
                usageCheck,
                lastCheck: moment().unix(),
            }

            await db.collection('proxies').findOneAndUpdate(
                {host: proxy.host, port: proxy.port},
                {$set: updateFields},
                {upsert: true, returnOriginal: false}
            );
        }

        return this.initProxyPool();
    }

    async initProxyPool() {
        this.roundrobinIndex = 0;
        this.proxyPool = await this.loadWorkingProxies() || [];
        this.loaded = true;
    }

    async loadWorkingProxies() {
        let minLastCheck = moment().subtract(2, 'd').unix();

        let db = await getDb(PROXY_DB_NAME);
        return db.collection('proxies').find({lastCheck: {$gt: minLastCheck}, basicCheck: true, usageCheck: {$in: [null, true]}}).toArray();
    }

    async getProxyRoundRobin() {
        if (!this.loaded) {
            await this.initProxyPool();
        }

        if (this.proxyPool.length === 0) {
            return false;
        }

        let proxy = this.proxyPool[this.roundrobinIndex];

        this.roundrobinIndex++;
        if (this.roundrobinIndex >= this.proxyPool.length) {
            this.roundrobinIndex = 0;
        }

        return proxy;
    }

    async getAgentRoundRobin() {
        let proxy = await this.getProxyRoundRobin();
        return proxy
            ? this.getAgent(proxy)
            : false;
    }

    async excludeProxyOnError(proxy, failedUrl, error) {
        let isBlockingError = error && /(timed* *out|reject|hang *up|socket *closed|ECONNREFUSED)/ig.test(error.toString());
        if (!isBlockingError) {
            return;
        }

        if (!proxy._id) {
            return;
        }

        let db = await getDb(PROXY_DB_NAME);
        await db.collection('proxies').findOneAndUpdate(
            {_id: proxy._id},
            {$set: {usageCheck: false, failedUrl, lastError: error.toString()}},
            {upsert: true, returnOriginal: false}
        );
        await this.initProxyPool();
    }

    getAgent(proxy) {
        let isSocksProxy = proxy.type.indexOf('socks') === 0;
        let isProxyHttp = proxy.type === 'http';
        let isProxyHttps = proxy.type === 'https';
        let agent = false;

        if (isSocksProxy) {
            agent = new SocksProxyAgent({
                host: proxy.host,
                port: parseInt(proxy.port),
                type: proxy.type === 'socks5' ? 5 : 4
            });
        }

        if (isProxyHttp || isProxyHttps) {
            let Agent = isProxyHttps
                ? hpagent.HttpsProxyAgent
                : hpagent.HttpProxyAgent;

            let proxyUrl = `${proxy.type}://${proxy.host}:${proxy.port}`;

            agent = new Agent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                maxSockets: 256,
                maxFreeSockets: 256,
                timeout: REQUEST_TIMEOUT,
                proxy: proxyUrl
            });
        }

        if (agent) {
            agent.inputProxy = proxy;
        }

        return agent;
    }
}