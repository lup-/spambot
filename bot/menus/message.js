module.exports = function (b, session, m) {
    let bot = session.bot || false;
    let message = session.message || false;

    return [
        [ b(message ? '✅ Пост сделан' : 'Создать пост', 'new_message'), b(bot ? `✅ ${bot.name}` : 'Выбрать бота', 'bot_change') ],
        [ b( 'Сбросить все', 'reset_message' ), b('Дальше', 'mailing_menu') ],
        [ b( 'В главное меню', 'home')]
    ];
};