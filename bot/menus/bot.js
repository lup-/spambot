module.exports = function (b, session, m) {
    return [
        [ b( 'Список', 'bot_list') ],
        [ b( 'Добавить', 'bot_add') ],
        [ b( 'Удалить', 'bot_delete') ],
        [ b( 'В главное меню', 'home') ],
    ];
};