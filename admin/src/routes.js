import Stats from "@/components/Stats/Stats";
import Details from "@/components/Stats/Details";
import BotSettings from "@/components/Stats/Settings";
import AdsEdit from "@/components/Ads/Edit";
import AdsList from "@/components/Ads/List";
import MailingEdit from "@/components/Mailings/Edit";
import MailingsList from "@/components/Mailings/List";
import RefUserEdit from "@/components/RefUsers/Edit";
import RefUsersList from "@/components/RefUsers/List";
import VacancyEdit from "@/components/Vacancies/Edit";
import VacanciesList from "@/components/Vacancies/List";

export default [
    { name: 'home', path: '/', component: Stats },
    { name: 'stats', path: '/stats', component: Stats },
    { name: 'botSettings', path: '/bots/:botName', component: BotSettings },
    { name: 'adsList', path: '/ads/', component: AdsList },
    { name: 'adsNew', path: '/ads/new', component: AdsEdit },
    { name: 'adsEdit', path: '/ads/:id', component: AdsEdit },
    { name: 'statsDetails', path: '/stats/details/:id?', component: Details },
    { name: 'mailingList', path: '/mailing/', component: MailingsList },
    { name: 'mailingNew', path: '/mailing/new', component: MailingEdit },
    { name: 'mailingEdit', path: '/mailing/:id', component: MailingEdit },
    { name: 'refUsersList', path: '/refusers/', component: RefUsersList },
    { name: 'refUsersEdit', path: '/refusers/:id', component: RefUserEdit },
    { name: 'vacanciesList', path: '/vacancies/', component: VacanciesList },
    { name: 'vacancyNew', path: '/vacancies/new', component: VacancyEdit },
    { name: 'vacancyEdit', path: '/vacancies/:id', component: VacancyEdit },
];