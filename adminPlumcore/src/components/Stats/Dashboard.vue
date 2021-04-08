<template>
    <v-container class="fill-height align-start" fluid>
        <v-row align="start" justify="start" dense>
            <v-col cols="12" md="4">
                <v-card>
                    <v-card-title>
                        <v-icon class="mr-12" size="64">mdi-account-multiple</v-icon>
                        <v-row align="start" class="flex-column">
                            <div class="caption grey--text text-uppercase">Пользователи</div>
                            <div class="display-1 font-weight-black d-flex align-baseline">
                                {{lastNum(users)}}
                                <v-icon v-if="isLastStepGrowing(users) === true" color="green">mdi-arrow-up-bold</v-icon>
                                <v-icon v-if="isLastStepGrowing(users) === false" color="red">mdi-arrow-down-bold</v-icon>
                                <span :class="isLastStepGrowing(users) ? 'green--text subtitle-1' : 'red--text subtitle-1'">
                                    {{growPercent(users)}}%
                                </span>
                            </div>
                        </v-row>
                        <v-spacer></v-spacer>
                        <v-btn icon class="align-self-start" size="28" @click="$router.push({name: 'statBot'})">
                            <v-icon>mdi-arrow-right-thick</v-icon>
                        </v-btn>
                    </v-card-title>

                    <v-sheet color="transparent">
                        <v-sparkline
                                :smooth="16"
                                :value="users"
                                :color="isPositive(users) ? 'green' : 'red'"
                                fill
                                padding="0"
                                stroke-linecap="round"
                        ></v-sparkline>
                    </v-sheet>
                </v-card>
            </v-col>

            <v-col cols="12" md="4">
                <v-card>
                    <v-card-title>
                        <v-icon class="mr-12" size="64">mdi-cash</v-icon>
                        <v-row align="start" class="flex-column">
                            <div class="caption grey--text text-uppercase">Платежи</div>
                            <div class="display-1 font-weight-black d-flex align-baseline">
                                {{lastNum(sales)}}
                                <v-icon v-if="isLastStepGrowing(sales) === true" color="green">mdi-arrow-up-bold</v-icon>
                                <v-icon v-if="isLastStepGrowing(sales) === false" color="red">mdi-arrow-down-bold</v-icon>
                                <span :class="isLastStepGrowing(sales) ? 'green--text subtitle-1' : 'red--text subtitle-1'">
                                    {{growPercent(sales)}}%
                                </span>
                            </div>
                        </v-row>
                        <v-spacer></v-spacer>
                        <v-btn icon class="align-self-start" size="28" @click="$router.push({name: 'statSales'})">
                            <v-icon>mdi-arrow-right-thick</v-icon>
                        </v-btn>
                    </v-card-title>

                    <v-sheet color="transparent">
                        <v-sparkline
                                :smooth="16"
                                :value="sales"
                                :color="isPositive(sales) ? 'green' : 'red'"
                                fill
                                padding="0"
                                stroke-linecap="round"
                        ></v-sparkline>
                    </v-sheet>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    export default {
        data() {
            return {
                users: [6, 2, 5, 9, 5, 10, 11, 10],
                sales: [50000, 0, 15000, 25550, 1000, 3500, 8000, 30000],
            }
        },
        methods: {
            isPositive(data) {
                if (data.length <= 1) {
                    return false;
                }

                return data[data.length-1] > data[0];
            },
            isLastStepGrowing(data) {
                if (data.length < 2) {
                    return null;
                }

                return data[data.length-1] > data[data.length-2];
            },
            growPercent(data) {
                if (data.length < 2) {
                    return 0;
                }

                let last = data[data.length-1];
                let preLast = data[data.length-2];
                let percent = (last-preLast)/preLast * 100;
                let strPercent = Math.round(percent).toString();
                return percent > 0 ? strPercent : strPercent.replace('-', '');
            },
            formatNum(number) {
                return Math.round(number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
            },
            lastNum(data) {
                return this.formatNum(data[data.length-1]);
            }
        }
    }
</script>

<style scoped>

</style>