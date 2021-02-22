import Stats from "@/components/Stats/Stats";
import Details from "@/components/Stats/Details";
import AdsEdit from "@/components/Ads/Edit";
import AdsList from "@/components/Ads/List";
import MailingEdit from "@/components/Mailings/Edit";
import MailingsList from "@/components/Mailings/List";
import RefUserEdit from "@/components/RefUsers/Edit";
import RefUsersList from "@/components/RefUsers/List";
import Dashboard from "@/components/Dashboard";

export default [
    { name: 'home', path: '/', component: Dashboard },
    { name: 'stats', path: '/stats', component: Stats },
    { name: 'adsList', path: '/ads/', component: AdsList },
    { name: 'adsNew', path: '/ads/new', component: AdsEdit },
    { name: 'adsEdit', path: '/ads/:id', component: AdsEdit },
    { name: 'statsDetails', path: '/stats/details/:id?', component: Details },
    { name: 'mailingList', path: '/mailing/', component: MailingsList },
    { name: 'mailingNew', path: '/mailing/new', component: MailingEdit },
    { name: 'mailingEdit', path: '/mailing/:id', component: MailingEdit },
    { name: 'refUsersList', path: '/refusers/', component: RefUsersList },
    { name: 'refUsersEdit', path: '/refusers/:id', component: RefUserEdit },

];
