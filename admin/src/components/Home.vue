<template>
    <v-component :is="defaultComponent"></v-component>
</template>

<script>
    import Stats from "./Stats/Stats";
    import AdsList from "../components/Ads/List";
    import MailingsList from "../components/Mailings/List";
    import RefUsersList from "../components/RefUsers/List";
    import VacanciesList from "../components/Vacancies/List";
    import UsersList from '../components/Users/List';

    export default {
        components: {Stats, AdsList, MailingsList, RefUsersList, VacanciesList, UsersList},
        computed: {
            defaultComponent() {
                let allRoutes = this.$store.state.routes;
                let defaultRoute = this.$store.getters.allowedRoutes(allRoutes)[0];
                return defaultRoute.componentName || 'Stats';
            }
        }
    }
</script>

<style scoped>

</style>