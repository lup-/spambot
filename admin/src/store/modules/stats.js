import axios from "axios";

export default {
    state: {
        stats: [],
        details: [],
    },
    getters: {
        plotlyTotals(state) {
            let totals = state.details.map(botStat => {
                return {
                    x: botStat.stats.map(item => item.tag),
                    y: botStat.stats.map(item => item.total),
                    type: 'scatter',
                    name: botStat.botId+', всего',
                }
            });

            return totals;
        },
        plotlyActive(state) {
            let active = state.details.map(botStat => {
                return {
                    x: botStat.stats.map(item => item.tag),
                    y: botStat.stats.map(item => item.active),
                    type: 'scatter',
                    name: botStat.botId+', активных',
                }
            });

            return active;
        },
        plotlyNew(state) {
            let newUsers = state.details.map(botStat => {
                return {
                    x: botStat.stats.map(item => item.tag),
                    y: botStat.stats.map(item => item.count),
                    type: 'scatter',
                    name: botStat.botId+', всего новых',
                    marker: {
                        size: 10,
                    }
                }
            });

            return newUsers;
        },
        plotlyRefs(state) {
            let refs = state.details.reduce((lines, botStat) => {
                let refLines = botStat.refStats.map(refStat => {
                    return {
                        x: refStat.stats.map(item => item.tag),
                        y: refStat.stats.map(item => item.count),
                        type: 'scatter',
                        mode: 'lines',
                        name: refStat.ref
                            ? botStat.botId+':'+refStat.ref
                            : botStat.botId+', органика',
                        stackgroup: botStat.botId,
                        line: {
                            width: 2
                        }
                    }
                });

                lines = lines.concat(refLines);
                return lines;
            }, []);

            return refs;
        },
        statTable(state) {
            let noDetails = state.details.length === 0;
            if (noDetails) {
                return {headers: [], rows: []};
            }

            let tags = state.details[0].stats.map(item => item.tag);

            let rows = tags.map(tag => {
                let columns = state.details.reduce((columns, botStat) => {
                    let totalItem = botStat.stats.find(item => item.tag === tag);
                    let refCols = botStat.refStats.reduce((cols, refs) => {
                        let refItem = refs.stats.find(item => item.tag === tag);
                        let refCode = botStat.botId+':'+(refs.ref ? refs.ref : '_direct');
                        cols[refCode] = refItem && refItem.count ? refItem.count : 0;
                        return cols;
                    }, {});

                    columns = Object.assign(columns, refCols);
                    columns[`${botStat.botId}:_new`] = totalItem && totalItem.count ? totalItem.count : 0;
                    columns[`${botStat.botId}:_active`] = totalItem && totalItem.active ? totalItem.active : 0;
                    columns[`${botStat.botId}:_total`] = totalItem && totalItem.total ? totalItem.total : 0;
                    return columns;
                }, {tag});

                return columns;
            });

            let headers = Object.keys(rows[0]).map(colCode => {
                let [botId, colType] = colCode.split(':');
                let colName = colCode;
                let type = 'refs';

                if (colCode === 'tag') {
                    colName = 'Время';
                    type = false;
                }

                if (colType === '_direct') {
                    colName = `${botId}, органика`;
                }

                if (colType === '_new') {
                    colName = `${botId}, всего новых`;
                    type = 'new';
                }

                if (colType === '_active') {
                    colName = `${botId}, активных`;
                    type = 'active';
                }

                if (colType === '_total') {
                    colName = `${botId}, всего`;
                    type = 'totals';
                }

                return {text: colName, value: colCode, type};
            });

            return {headers, rows}
        }
    },
    actions: {
        async loadStats({commit}, filter) {
            let tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            let response = await axios.post(`/api/stats/list`, {filter, tz});
            return commit('setStats', response.data.stats);
        },
        async loadDetails({commit}, params) {
            params.tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            let response = await axios.post(`/api/stats/details`, params);
            return commit('setDetails', response.data.stats);
        },
    },
    mutations: {
        setStats(state, stats) {
            state.stats = stats;
        },
        setDetails(state, stats) {
            state.details = stats;
        }
    }
}