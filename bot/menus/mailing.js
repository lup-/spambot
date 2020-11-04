module.exports = function (b, session, m) {
    let date = session.mailingDate || false;

    let menu = [
        [ b( 'Задать дату', 'set_mailing_date' ), ],
    ];

    if (date) {
        menu.push([ b('Сбросить дату', 'reset_mailing_date') ]);
    }

    menu.push([ b( date ? 'Запланировать' : 'Отправить сейчас', 'send_mailing' ) ]);
    menu.push( [ b( 'В главное меню', 'home') ] );

    return menu;
};