<template>
    <v-container class="fill-height" :class="{'align-start': !isEmpty && !isLoading}">
        <v-row :align="isEmpty || isLoading ? 'center' : 'start'" :justify="isEmpty || isLoading ? 'center' : 'start'">
            <v-progress-circular v-if="isLoading"
                :size="70"
                :width="7"
                indeterminate
            ></v-progress-circular>

            <v-col cols="12" class="text-center" v-if="isEmpty && !isLoading">Статистики нет</v-col>
            <v-col cols="12" md="6" lg="4" v-for="stat in stats" :key="'stats'+stat.botId">
                <stat-card :stats="stat"></stat-card>
            </v-col>
        </v-row>
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