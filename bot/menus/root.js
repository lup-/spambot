module.exports = function (b, session, m) {
    return [
        [ b( 'Новая рассылка', 'message_menu') ],
        [ b( 'Текущие рассылки', 'mailing_list') ],
        [ b( 'Мои боты', 'bots_menu') ],
        [ b( 'Статистика', 'stat_menu') ],
    ];
};