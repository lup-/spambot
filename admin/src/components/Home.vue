<template>
    <v-component :is="defaultComponent"></v-component>
</template>

<script>
    import Stats from "./Stats/Stats";
    import VacanciesList from "./Vacancies/List";

    export default {
        components: {Stats, VacanciesList},
        computed: {
            defaultComponent() {
                let hasStatsRights = this.$store.getters.userHasRights('stats');
                return hasStatsRights ? 'Stats' : 'VacanciesList';
            }
        }
    }
</script>

<style scoped>

</style>