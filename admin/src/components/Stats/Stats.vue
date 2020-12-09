<template>
    <v-container class="fill-height" :class="{'align-start': !isEmpty && !isLoading}">
        <v-data-iterator
                :items="stats"
                :loading="isLoading"
                locale="ru"
        >
            <template v-slot:default="{ items }">
                <v-row>
                    <v-col cols="12" sm="6" lg="4" v-for="stat in items" :key="'stats'+stat.botId">
                        <stat-card :stats="stat"></stat-card>
                    </v-col>
                </v-row>
            </template>
        </v-data-iterator>
    </v-container>
</template>

<script>
    import StatCard from "@/components/StatCard";

    export default {
        name: "Stats",
        components: {StatCard},
        data() {
            return {
                isLoading: false,
            }
        },
        async mounted() {
            await this.loadStats();
        },
        methods: {
            async loadStats() {
                this.isLoading = true;
                await this.$store.dispatch('loadStats', {});
                this.isLoading = false;
            }
        },
        computed: {
            stats() {
                return this.isLoading ? [] : this.$store.state.stats.stats;
            },
            isEmpty() {
                return this.stats.length === 0 && this.isLoading === false;
            }
        }
    }
</script>

<style scoped>

</style>