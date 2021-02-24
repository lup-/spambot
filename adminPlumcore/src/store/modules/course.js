import Crud from "./baseCrud";

const API_LIST_URL = `/api/plumcore/course/list`;
const API_ADD_URL = `/api/plumcore/course/add`;
const API_UPDATE_URL = `/api/plumcore/course/update`;
const API_DELETE_URL = `/api/plumcore/course/delete`;

const NAME_ITEMS = 'courses';
const NAME_ITEM = 'course';

export default new Crud({
    API_LIST_URL,
    API_ADD_URL,
    API_UPDATE_URL,
    API_DELETE_URL,

    NAME_ITEMS,
    NAME_ITEM
});