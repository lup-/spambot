import axios from "axios";

export default {
    state: {
        stats: [],
        details: [],
    },
    getters: {
        plotlyDetails(state) {
            let totals = state.details.map(botStat => {
                return {
                    x: botStat.stats.map(item => item.tag),
                    y: botStat.stats.map(item => item.count),
                    type: 'scatter',
                    mode: 'markers',
                    name: botStat.botId,
                    marker: {
                        size: 10,
                    }
                }
            });

            let refs = state.details.reduce((lines, botStat) => {
                let refLines = botStat.refStats.map(refStat => {
                    return {
                        x: refStat.stats.map(item => item.tag),
                        y: refStat.stats.map(item => item.count),
                        type: 'scatter',
                        mode: 'lines',
                        name: botStat.botId+':'+(refStat.ref ? refStat.ref : 'прямые'),
                        stackgroup: botStat.botId,
                        line: {
                            width: 2
                        }
                    }
                });

                lines = lines.concat(refLines);
                return lines;
            }, []);

            return totals.concat(refs);
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
                    columns[`${botStat.botId}:_total`] = totalItem && totalItem.count ? totalItem.count : 0;
                    return columns;
                }, {tag});

                return columns;
            });

            let headers = Object.keys(rows[0]).map(colCode => {
                let [botId, colType] = colCode.split(':');
                let colName = colCode;

                if (colCode === 'tag') {
                    colName = 'Время';
                }

                if (colType === '_total') {
                    colName = `${botId}, всего`;
                }

                if (colType === '_direct') {
                    colName = `${botId}, прямые`;
                }

                return {text: colName, value: colCode};
            });

            return {headers, rows}
        }
    },
    actions: {
        async loadStats({commit}, filter) {
            let response = await axios.post(`/api/stats/list`, {filter});
            return commit('setStats', response.data.stats);
        },
        async loadDetails({commit}, params) {
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