<template>
    <v-container class="fill-height">
        <v-row>
            <v-col cols="12">
                <v-card>
                    <v-card-title>{{isNew ? 'Новая реклама' : 'Редактирование рекламы'}}</v-card-title>
                    <v-card-text>
                        <v-form autocomplete="off">
                            <v-select
                                v-model="ad.type"
                                :items="adTypes"
                                label="Тип рекламы"
                            ></v-select>
                            <v-autocomplete
                                :items="bots"
                                v-model="ad.bots"
                                chips
                                deletable-chips
                                multiple
                                label="Таргет по ботам"
                            ></v-autocomplete>
                            <v-autocomplete
                                :items="tags"
                                v-model="ad.tags"
                                chips
                                deletable-chips
                                multiple
                                label="Таргет по тэгам"
                            ></v-autocomplete>
                            <v-autocomplete
                                    :items="messages"
                                    v-model="ad.messages"
                                    item-value="id"
                                    chips
                                    deletable-chips
                                    multiple
                                    label="Таргет по сообщениям"
                            ></v-autocomplete>
                            <v-textarea
                                    v-model="ad.text"
                            ></v-textarea>
                            <v-slider
                                    v-model="probPercent"
                                    min="0"
                                    max="100"
                                    step="1"
                                    ticks="always"
                                    thumb-label="always"
                                    label="Вероятность показа, %"
                            ></v-slider>
                        </v-form>
                    </v-card-text>
                    <v-card-actions>
                        <v-btn @click="$router.push({name: 'adsList'})">К списку</v-btn>
                        <v-btn large color="primary" @click="save">Сохранить</v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
    export default {
        name: "AdsEdit",
        data() {
            return {
                probPercent: 0,
                ad: {type: 'small'},
                defaultAd: {type: 'small'},
                adTypes: [{text: 'Приписка', value: 'small'}]
            }
        },
        created() {
            if (this.adId) {
                this.$store.dispatch('setCurrentAd', this.adId);
            }
        },
        watch: {
            adId() {
                this.$store.dispatch('setCurrentAd', this.adId);
            },
            allAds() {
                if (this.adId) {
                    this.$store.dispatch('setCurrentAd', this.adId);
                }
            },
            storeAd() {
                if (this.storeAd) {
                    this.ad = this.storeAd;
                    this.probPercent = Math.round(this.ad.prob * 100);
                }
                else {
                    this.ad = this.defaultAd;
                    this.probPercent = 0;
                }
            },
            probPercent() {
                this.ad.prob = this.probPercent / 100;
            }
        },
        methods: {
            async save() {
                if (this.isNew) {
                    await this.$store.dispatch('newAd', this.ad);
                    await this.$router.push({name: 'adsList'});
                }
                else {
                    await this.$store.dispatch('editAd', this.ad);
                }
            }
        },
        computed: {
            isNew() {
                return !(this.$route.params && this.$route.params.id);
            },
            adId() {
                return (this.$route.params && this.$route.params.id) || false;
            },
            storeAd() {
                return this.$store.state.ads.current;
            },
            allAds() {
                return this.$store.state.ads.list;
            },
            bots() {
                return this.$store.state.bots.list.map(bot => {
                    return {text: bot.botName, value: bot.botName};
                });
            },
            tags() {
                return this.$store.getters.tags;
            },
            messages() {
                return this.$store.getters.textMessages(this.ad.bots, this.ad.tags).map(message => {
                    message.text = `[${message.bot}] ${message.text}`;
                    return message;
                });
            }
        }
    }
</script>

<style scoped>

</style>