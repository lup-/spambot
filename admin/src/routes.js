import Stats from "@/components/Stats/Stats";
import Details from "@/components/Stats/Details";
import AdsEdit from "@/components/Ads/Edit";
import AdsList from "@/components/Ads/List";

export default [
    { name: 'home', path: '/', component: Stats },
    { name: 'stats', path: '/stats', component: Stats },
    { name: 'adsList', path: '/ads/', component: AdsList },
    { name: 'adsNew', path: '/ads/new', component: AdsEdit },
    { name: 'adsEdit', path: '/ads/:id', component: AdsEdit },
    { name: 'statsDetails', path: '/stats/details/:id?', component: Details },
];