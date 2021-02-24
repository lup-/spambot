import Stats from "../components/Stats/Stats";
import Details from "../components/Stats/Details";
import BotSettings from "../components/Stats/Settings";
import AdsEdit from "../components/Ads/Edit";
import AdsList from "../components/Ads/List";
import MailingEdit from "../components/Mailings/Edit";
import MailingsList from "../components/Mailings/List";
import RefUserEdit from "../components/RefUsers/Edit";
import RefUsersList from "../components/RefUsers/List";
import VacancyEdit from "../components/Vacancies/Edit";
import VacanciesList from "../components/Vacancies/List";
import Login from '../components/Users/Login';
import UsersEdit from '../components/Users/Edit';
import UsersList from '../components/Users/List';
//import Dashboard from '../components/Dashboard';
import Home from '../components/Home';

export default [
    { name: 'home', path: '/', component: Home, meta: {requiresAuth: true, group: 'home'} },
    { name: 'login', path: '/login', component: Login },
    { name: 'stats', path: '/stats', component: Stats, meta: {requiresAuth: true, group: 'stats'} },
    { name: 'botSettings', path: '/bots/:botName', component: BotSettings, meta: {requiresAuth: true, group: 'stats'} },
    { name: 'statsDetails', path: '/stats/details/:id?', component: Details, meta: {requiresAuth: true, group: 'stats'} },
    { name: 'adsList', path: '/ads/', component: AdsList, meta: {requiresAuth: true, group: 'adsList'} },
    { name: 'adsNew', path: '/ads/new', component: AdsEdit, meta: {requiresAuth: true, group: 'adsList'} },
    { name: 'adsEdit', path: '/ads/:id', component: AdsEdit, meta: {requiresAuth: true, group: 'adsList'} },
    { name: 'mailingList', path: '/mailing/', component: MailingsList, meta: {requiresAuth: true, group: 'mailingList'} },
    { name: 'mailingNew', path: '/mailing/new', component: MailingEdit, meta: {requiresAuth: true, group: 'mailingList'} },
    { name: 'mailingEdit', path: '/mailing/:id', component: MailingEdit, meta: {requiresAuth: true, group: 'mailingList'} },
    { name: 'refUsersList', path: '/refusers/', component: RefUsersList, meta: {requiresAuth: true, group: 'refUsersList'} },
    { name: 'refUsersEdit', path: '/refusers/:id', component: RefUserEdit, meta: {requiresAuth: true, group: 'refUsersList'} },
    { name: 'vacanciesList', path: '/vacancies/', component: VacanciesList, meta: {requiresAuth: true, group: 'vacanciesList'} },
    { name: 'vacancyNew', path: '/vacancies/new', component: VacancyEdit, meta: {requiresAuth: true, group: 'vacanciesList'} },
    { name: 'vacancyEdit', path: '/vacancies/:id', component: VacancyEdit, meta: {requiresAuth: true, group: 'vacanciesList'} },
    { name: 'usersList', path: '/users/', component: UsersList, meta: {requiresAuth: true, group: 'usersList'} },
    { name: 'userNew', path: '/users/new', component: UsersEdit, meta: {requiresAuth: true, group: 'usersList'} },
    { name: 'userEdit', path: '/users/:id', component: UsersEdit, meta: {requiresAuth: true, group: 'usersList'} },
];
