<template>
    <v-container class="align-start">
        <v-row>
            <v-col cols="12">
                <v-card class="mb-2">
                    <v-card-title>
                        <v-btn icon class="align-self-start mr-4 mt-2" size="28" @click="$router.push({name: 'statDashboard'})">
                            <v-icon>mdi-arrow-left-thick</v-icon>
                        </v-btn>

                        Статистика по пользователям

                        <v-spacer></v-spacer>
                        <v-btn-toggle v-model="days" tile group color="primary" background-color="white" v-ripple="false">
                            <v-btn :value="0">Сегодня</v-btn>
                            <v-btn :value="7">7д</v-btn>
                            <v-btn :value="15">15д</v-btn>
                            <v-btn :value="30">1м</v-btn>
                            <v-btn :value="365">1г</v-btn>
                        </v-btn-toggle>
                    </v-card-title>
                </v-card>
            </v-col>
        </v-row>

        <v-row>
            <v-col cols="12">
                <v-card class="mb-2">
                    <v-card-text>
                        <plotly :data="usersData" :layout="usersLayout"/>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>

        <v-row>
            <v-col cols="12">
                <v-card>
                    <v-data-table
                            dense
                            :headers="tableHeaders"
                            :items="tableData"
                            :items-per-page="50"
                    ></v-data-table>
                </v-card>
            </v-col>
        </v-row>

    </v-container>
</template>

<script>
    import { Plotly } from 'vue-plotly';
    import axios from "axios";

    export default {
        components: {Plotly},
        data() {
            return {
                days: 15,
                usersLayout: {
                    margin: 20,
                    yaxis: {title: 'Всего', showgrid: false},
                    yaxis2: {title: 'Новых и блокировок', overlaying: 'y', side: 'right', showgrid: false},
                    showlegend: true,
                    legend: {
                        orientation: "h",
                        x: 0.4,
                        y: 1.1
                    }
                },
                tableHeaders: [
                    {text: 'Дата', value: 'date'},
                    {text: 'Пользователей', value: 'users'},
                    {text: 'Новых', value: 'new'},
                    {text: 'Блокировок', value: 'blocked'},
                ],
                tableData: []
            }
        },
        created() {
            this.loadStats();
        },
        watch: {
            days() {
                this.loadStats();
            }
        },
        methods: {
            async loadStats() {
                let {data: stats} = await axios.post('/api/plumcore/stats/users', {days: this.days});
                this.tableData = stats.users;
            }
        },
        computed: {
            isSmallDisplay() {
                return ['xs', 'sm', 'md'].indexOf(this.$vuetify.breakpoint.name) !== -1;
            },
            mainChartHeight() {
                return this.isSmallDisplay ? 560 : 500;
            },
            salesOptions() {
                return {
                    fullWidth: true,
                    lineSmooth: false,
                    height: (this.isSmallDisplay ? 168 : 440) + 'px'
                }
            },
            usersData() {
                return [{
                        x: this.tableData.map(item => item.date),
                        y: this.tableData.map(item => item.users),
                        type: 'scatter',
                        line: {width: 4},
                        name: 'Всего',
                    },
                    {
                        x: this.tableData.map(item => item.date),
                        y: this.tableData.map(item => item.new),
                        type: 'scatter',
                        line: {color: 'green'},
                        name: 'Новых',
                        yaxis: 'y2'
                    },
                    {
                        x: this.tableData.map(item => item.date),
                        y: this.tableData.map(item => item.blocked),
                        type: 'scatter',
                        line: {color: 'red'},
                        name: 'Блокировок',
                        yaxis: 'y2'
                    }];
            }
        }
    }
</script>