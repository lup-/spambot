<template>
    <v-container class="fill-height align-start">
        <v-row align="start" :justify="isEmpty || isLoading ? 'center' : 'start'">
            <v-btn fab bottom right fixed large color="primary"
                    @click="$router.push({name: 'adsNew'})"
            >
                <v-icon>mdi-plus</v-icon>
            </v-btn>

            <v-col cols="12">
                <v-data-iterator
                        :items="ads"
                        :loading="isLoading"
                        locale="ru"
                >
                    <template v-slot:default="{ items }">
                        <v-row>
                            <v-col cols="12" sm="6" lg="4" v-for="item in items" :key="item.id">
                                <v-card>
                                    <v-card-text>{{item.text}}</v-card-text>
                                    <v-divider></v-divider>
                                    <v-list dense>
                                        <v-list-item>
                                            <v-list-item-content>Показы:</v-list-item-content>
                                            <v-list-item-content class="align-end">{{ item.display || 0 }}</v-list-item-content>
                                        </v-list-item>
                                        <v-list-item>
                                            <v-list-item-content>Боты:</v-list-item-content>
                                            <v-list-item-content class="align-end">{{ item.bots ? item.bots.length : 0 }}</v-list-item-content>
                                        </v-list-item>
                                        <v-list-item>
                                            <v-list-item-content>Тэги:</v-list-item-content>
                                            <v-list-item-content class="align-end">{{ item.tags ? item.tags.length : 0 }}</v-list-item-content>
                                        </v-list-item>
                                        <v-list-item>
                                            <v-list-item-content>Сообщения:</v-list-item-content>
                                            <v-list-item-content class="align-end">{{ item.messages ? item.messages.length : 0}}</v-list-item-content>
                                        </v-list-item>
                                        <v-list-item>
                                            <v-list-item-content>Частота показа:</v-list-item-content>
                                            <v-list-item-content class="align-end">{{ Math.round(item.prob*100) }}%</v-list-item-content>
                                        </v-list-item>
                                    </v-list>
                                    <v-card-actions>
                                        <v-btn icon @click="deleteAd(item)"><v-icon>mdi-delete</v-icon></v-btn>
                                        <v-btn icon @click="$router.push({name: 'adsEdit', params: {id: item.id}})"><v-icon>mdi-pencil</v-icon></v-btn>
                                    </v-card-actions>
                                </v-card>
                            </v-col>
                        </v-row>
                    </template>
                </v-data-iterator>
            </v-col>
            <v-col cols="12" v-if="$store.state.user.current.isAdmin">
                <v-btn color="danger" @click="reloadBotAds">Перегрузить сообщения в ботах</v-btn>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    export default {
        name: "AdsList",
        data() {
            return {
                isLoading: false,
            }
        },
        async mounted() {
            await this.loadAds();
        },
        methods: {
            deleteAd(ad) {
                this.$store.dispatch('deleteAd', ad);
            },
            async loadAds() {
                this.isLoading = true;
                let filter = this.$store.getters.allowedBotFilter('bots');
                await this.$store.dispatch('loadAds', filter);
                this.isLoading = false;
            },
            async reloadBotAds() {
                await this.$store.dispatch('reloadBotAds');
            }
        },
        computed: {
            ads() {
                return this.isLoading ? [] : this.$store.state.ads.list;
            },
            isEmpty() {
                return this.ads.length === 0 && this.isLoading === false;
            }
        }
    }
</script>

<style scoped>

</style>