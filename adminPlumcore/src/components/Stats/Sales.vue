<template>
    <v-container class="align-start">
        <v-row>
            <v-col cols="12">
                <v-card class="mb-2">
                    <v-card-title>
                        <v-btn icon class="align-self-start mr-4 mt-2" size="28" @click="$router.push({name: 'statDashboard'})">
                            <v-icon>mdi-arrow-left-thick</v-icon>
                        </v-btn>

                        Статистика продаж

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
                <v-expansion-panels :value="[0]" multiple class="align-self-start justify-start mb-4">
            <v-expansion-panel>
                <v-expansion-panel-header>Продажи</v-expansion-panel-header>
                <v-expansion-panel-content>
                    <plotly :data="salesData" :layout="salesLayout"/>
                </v-expansion-panel-content>
            </v-expansion-panel>
            <v-expansion-panel>
                <v-expansion-panel-header>Категории</v-expansion-panel-header>
                <v-expansion-panel-content>
                    <pie-card :max-height="248" :data="categories" title="Категории"></pie-card>
                </v-expansion-panel-content>
            </v-expansion-panel>
            <v-expansion-panel>
                <v-expansion-panel-header>Курсы</v-expansion-panel-header>
                <v-expansion-panel-content>
                    <pie-card :max-height="248" :data="courses" title="Курсы"></pie-card>
                </v-expansion-panel-content>
            </v-expansion-panel>
        </v-expansion-panels>
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
    import PieCard from "@/components/Stats/Cards/PieCard";
    import { Plotly } from 'vue-plotly';
    import axios from "axios";

    export default {
        components: {PieCard, Plotly},
        data() {
            return {
                days: 15,
                topCourses: [],
                sales: {
                    labels: [],
                    series:[]
                },
                salesLayout: {
                    margin: 20,
                },
                categories: [],
                courses: [],
                tableHeaders: [
                    {text: 'Дата', value: 'date'},
                    {text: 'Платежей', value: 'totalSum'},
                    {text: 'Покупок', value: 'ordersCount'},
                    {text: 'Курсов', value: 'courseCount'},
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
                let {data: stats} = await axios.post('/api/plumcore/stats/sales', {days: this.days});
                this.categories = stats.categories;
                this.courses = stats.courses;
                this.tableData = stats.sales;
                this.sales.labels = stats.sales.map(item => item.date);
                this.sales.series = [ stats.sales.map(item => item.totalSum) ];
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
            salesData() {
                return [{
                    x: this.tableData.map(item => item.date),
                    y: this.tableData.map(item => item.totalSum),
                    type: 'scatter'
                }];
            }
        }
    }
</script>

<style lang="scss">
    @import "../../../node_modules/chartist/dist/scss/settings/chartist-settings";

    .v-btn.v-btn--active:before {
        background-color: transparent;
    }

    .ct-legend {
        position: relative;
        z-index: 10;
        list-style: none;

        li {
            position: relative;
            padding-left: 23px;
            margin-bottom: 3px;
            display: flex;
            align-items: center;
        }

        li:before {
            width: 12px;
            height: 12px;
            position: absolute;
            left: 0;
            content: '';
            border: 3px solid transparent;
            border-radius: 2px;
        }

        li.inactive:before {
            background: transparent;
        }

        &.ct-legend-inside {
            position: absolute;
            top: 0;
            left: 0;
            padding-left: 0;
         }

        @for $i from 0 to length($ct-series-colors) {
            .ct-series-#{$i}:before {
                background-color: nth($ct-series-colors, $i + 1);
                border-color: nth($ct-series-colors, $i + 1);
            }
        }
    }
</style>