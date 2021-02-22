<template>
    <v-container v-if="dashboard && dashboard.totalUsers">

        <v-row align="center">
            <v-col cols="3">
                <v-card
                    class="mx-auto card-wrap"
                    max-width="100%">
                    <v-card-title class="headline">
                        <span class="text--primary"><v-icon>mdi-account-group</v-icon> Всего: </span>
                        <span class="text--primary">{{ dashboard ? dashboard.totalUsers.dayTotalUsers : 'Нет данных'}} <small></small></span>

                    </v-card-title>

                    <v-card-actions>
                        <div class="card-value">
                            <span> {{dashboard.totalUsers.dayTotalUsers}} </span> <small>( + {{dashboard.totalUsers.dayTotalUsers - dashboard.totalUsers.yesterdayTotalUsers}})</small>
                        </div>

                    </v-card-actions>
                </v-card>

            </v-col>

            <v-col cols="3">
                <v-card
                        class="mx-auto card-wrap"
                        max-width="100%">

                    <v-card-title class="text--primary">
                        <span class="list-item-title "><v-icon>mdi-account</v-icon>&nbsp;<span> Уникальных: </span> </span>
                    </v-card-title>
                    <v-card-actions>
                        <div class="card-value text--primary">
                            <span> {{dashboard.uniqueUsers.dayUniqueUsers}} </span> <small>( + {{dashboard.uniqueUsers.dayUniqueUsers - dashboard.uniqueUsers.yesterdayUniqueUsers}})</small>
                        </div>
                    </v-card-actions>
                </v-card>

            </v-col>

            <v-col cols="3">
                <v-card
                        class="mx-auto card-wrap"
                        max-width="100%">
                    <v-card-title class="green--text">
                        <v-icon> mdi-account-plus </v-icon>
                        <span> Активных: </span>
                    </v-card-title>

                    <v-card-actions>
                        <div class="card-value">
                            <span> {{dashboard.activeUsers.dayActiveUsers}} </span> <small> (+ {{dashboard.activeUsers.dayActiveUsers - dashboard.activeUsers.yesterdayActiveUsers}})</small>
                        </div>
                    </v-card-actions>

                </v-card>

            </v-col>

            <v-col cols="3">
                <v-card
                        class="mx-auto card-wrap"
                        max-width="100%">
                    <v-card-title>
                        <span class="list-item-title text--red">
                            <v-icon>mdi-account-cancel</v-icon>&nbsp;
                            <span> Блокировки: </span>
                        </span>
                    </v-card-title>

                    <v-card-actions>
                        <div class="card-value text--primary">
                            <span> {{dashboard.blockedUsers.dayBlockedUsers}} </span> <small> (+ {{dashboard.blockedUsers.dayBlockedUsers - dashboard.blockedUsers.yesterdayBlockedUsers}})</small>
                        </div>
                    </v-card-actions>
                </v-card>

            </v-col>
        </v-row>


        <v-card
                class="mx-auto card-wrap"
                max-width="100%">
            <v-list-item two-line>
                <v-list-item-content>
                    <v-list-item-title>
                        <span class="list-item-title text--primary">
                            <v-icon>mdi-account-group</v-icon>
                            <span> Всего: </span>
                        </span>

                        <v-row class="list-time">
                            <v-col cols="4" class="line-right">
                                <div class="list-time-title">
                                    <span> за сутки</span>
                                </div>
                                <div class="list-time-value">
                                    <span>+ {{dashboard.totalUsers.dayTotalUsers}}</span>
                                </div>
                            </v-col>
                            <v-col cols="4" class="line-right">
                                <div class="list-time-title">
                                    <span> за неделю</span>
                                </div>
                                <div class="list-time-value">
                                    <span>+ {{dashboard.totalUsers.weekTotalUsers}}</span>
                                </div>
                            </v-col>
                            <v-col cols="4" class="line-right">
                                <div class="list-time-title">
                                    <span> за месяц</span>
                                </div>
                                <div class="list-time-value">
                                    <span>+ {{dashboard.totalUsers.monthTotalUsers}}</span>
                                </div>
                            </v-col>
                        </v-row>

                    </v-list-item-title>
                </v-list-item-content>
            </v-list-item>
        </v-card>


        <v-card
                class="mx-auto card-wrap"
                max-width="100%">
            <v-list-item two-line>
                <v-list-item-content>
                    <v-list-item-title>
                        <span class="list-item-title text--primary">
                            <v-icon>mdi-account</v-icon>
                            <span> Уникальных: </span>
                        </span>
                        <v-row class="list-time">
                            <v-col cols="4" class="line-right">
                                <div class="list-time-title">
                                    <span> за сутки</span>
                                </div>
                                <div class="list-time-value">
                                    <span>+ {{dashboard.uniqueUsers.dayUniqueUsers}}</span>
                                </div>
                            </v-col>
                            <v-col cols="4" class="line-right">
                                <div class="list-time-title">
                                    <span> за неделю</span>
                                </div>
                                <div class="list-time-value">
                                    <span>+ {{dashboard.uniqueUsers.weekUniqueUsers}}</span>
                                </div>
                            </v-col>
                            <v-col cols="4" class="line-right">
                                <div class="list-time-title">
                                    <span> за месяц</span>
                                </div>
                                <div class="list-time-value">
                                    <span>+ {{dashboard.uniqueUsers.monthUniqueUsers}}</span>
                                </div>
                            </v-col>
                        </v-row>

                    </v-list-item-title>
                </v-list-item-content>
            </v-list-item>
        </v-card>

        <v-card
                class="mx-auto card-wrap"
                max-width="100%">
            <v-list-item two-line>
                <v-list-item-content>
                    <v-list-item-title>
                        <span class="green--text"> <v-icon>mdi-account-plus</v-icon> </span>
                        <span class="list-item-title"> Активных: </span>
                        <v-row class="list-time">
                            <v-col cols="4" class="line-right">
                                <div class="list-time-title">
                                    <span> за сутки</span>
                                </div>
                                <div class="list-time-value">
                                    <span>+ {{dashboard.activeUsers.dayActiveUsers}}</span>
                                </div>
                            </v-col>
                            <v-col cols="4" class="line-right">
                                <div class="list-time-title">
                                    <span> за неделю</span>
                                </div>
                                <div class="list-time-value">
                                    <span>+ {{dashboard.activeUsers.weekActiveUsers}}</span>
                                </div>
                            </v-col>
                            <v-col cols="4" class="line-right">
                                <div class="list-time-title">
                                    <span> за месяц</span>
                                </div>
                                <div class="list-time-value">
                                    <span>+ {{dashboard.activeUsers.monthActiveUsers}}</span>
                                </div>
                            </v-col>
                        </v-row>
                    </v-list-item-title>
                </v-list-item-content>
            </v-list-item>
        </v-card>


        <v-card
                class="mx-auto card-wrap"
                max-width="100%">
            <v-list-item two-line>
                <v-list-item-content>
                    <v-list-item-title>
                        <span class="list-item-title text--red"><v-icon>mdi-account-cancel</v-icon> Блокировки: </span>
                        <v-row class="list-time">
                            <v-col cols="4" class="line-right">
                                <div class="list-time-title">
                                    <span> за сутки</span>
                                </div>
                                <div class="list-time-value">
                                    <span>+ {{dashboard.blockedUsers.dayBlockedUsers}}</span>
                                </div>
                            </v-col>
                            <v-col cols="4" class="line-right">
                                <div class="list-time-title">
                                    <span> за неделю</span>
                                </div>
                                <div class="list-time-value">
                                    <span>+ {{dashboard.blockedUsers.weekBlockedUsers}}</span>
                                </div>
                            </v-col>
                            <v-col cols="4" class="line-right">
                                <div class="list-time-title">
                                    <span> за месяц</span>
                                </div>
                                <div class="list-time-value">
                                    <span>+ {{dashboard.blockedUsers.monthBlockedUsers}}</span>
                                </div>
                            </v-col>
                        </v-row>
                    </v-list-item-title>
                </v-list-item-content>
            </v-list-item>
        </v-card>

    </v-container>
</template>

<script>
    export default {
        name: "Dashboard",
        async created() {
            await this.$store.dispatch('loadDashboard');
        },
        data() {
            return {
                a: 1
            };
        },
        computed: {
            dashboard() {
                return this.$store.state.dashboard.data;
            },
        }
    }
</script>

<style scoped lang="scss">

    .all-rezult{
        span {
            font-size: 36px;
            color: blue;
            font-weight: bold;
        }

    }

    .card-wrap {
        margin: 12px 0 24px;
    }

    .card-container {
        display: flex;
        justify-content: space-between;
        align-items: center;

        &__wrap {
            flex: 0 0 50%;
        }
    }

    .text--red {
        color: red;
        span {
            color: currentColor;
        }
        .mdi-account-cancel::before {
            color: red;
        }
    }

    .text--primary {
        span {
            color: currentColor;
        }
        .mdi-account::before,
        .mdi-account-group::before {
            color: blue;
        }
    }

    .mdi-account::before {
        color: blue;
    }

    .green--text {
        span {
            color: currentColor;
        }
        .mdi-account-plus::before {
            color: green;
        }
    }

    .card-value {
        font-size: 28px;
    }
    .v-list-item__title {
        font-size: 1.3rem;
    }

    .list-item-line {
        border-bottom: 1px solid #ccc;
        padding-bottom: 10px;
    }

    .line-right {
        border-right: 1px dashed lightcoral;
    }

    .addUsersCount {
        color: green;

        i {
            font-size: 24px;
        }
    }

    .light-blue {
        display: block;
        width: 100%;
    }
</style>
