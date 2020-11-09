const WizardScene = require('telegraf/scenes/wizard');
const {menu, buttonStep} = require('../../helpers/wizard');

module.exports = function (datingManager) {
    return new WizardScene('profileWizard',
        async (ctx) => {
            ctx.wizard.state.profile = ctx.session.profile || {
                userId: ctx.session.userId,
                chatId: ctx.session.chatId,
            };
            await ctx.reply(
                'Я помогу тебе найти пару или просто друзей. Можно я задам тебе пару вопросов?',
                menu([
                    {code: 'yes', text: 'Да'},
                    {code: 'no', text: 'Нет'},
                ])
            )
            return ctx.wizard.next();
        },
        buttonStep([
            {code: 'yes', callback: (ctx, nextStep) => {
                    return nextStep(ctx);
            }},
            {code: 'no', callback: (ctx) => ctx.scene.enter('mainMenu')},
        ]),
        async (ctx) => {
            await ctx.reply('Сколько тебе лет?');
            return ctx.wizard.next();
        },
        (ctx) => {
            let age = parseInt(ctx.message.text) || false;
            let validAge = age && age > 0 && age < 120;

            if (!validAge) {
                ctx.reply('Пожалуйста, укажи реальный возраст. Например, 31');
                return;
            }
            ctx.wizard.state.profile.age = age;

            ctx.reply(
                'Парень или девушка?',
                menu([
                    {code: 'male', text: 'Парень'},
                    {code: 'female', text: 'Девушка'},
                ])
            );
            return ctx.wizard.next();
        },
        buttonStep([
            {code: /(.*)/, callback(ctx, nextStep) {
                    ctx.wizard.state.profile.sex = ctx.match[1];
                    return nextStep(ctx);
                }
            },
        ]),
        (ctx) => {
            ctx.reply(
                'Кто тебе интересен?',
                menu([
                    {code: 'male', text: 'Парни'},
                    {code: 'female', text: 'Девушки'},
                    {code: 'any', text: 'Интересны все'},
                ])
            );
            return ctx.wizard.next();
        },
        buttonStep([
            {code: /(.*)/, callback(ctx, nextStep) {
                    ctx.wizard.state.profile.lookingFor = ctx.match[1];
                    return nextStep(ctx);
                }
            },
        ]),
        (ctx) => {
            ctx.reply('Из какого ты города?');
            return ctx.wizard.next();
        },
        (ctx) => {
            ctx.wizard.state.profile.city = ctx.message.text.trim();

            ctx.reply('Как мне тебя называть?');
            return ctx.wizard.next();
        },
        (ctx) => {
            ctx.wizard.state.profile.name = ctx.message.text.trim();

            ctx.reply(
                'Расскажи о себе и кого хочешь найти, чем предлагаешь заняться. Это поможет лучше подобрать тебе компанию.',
                menu([
                    {code: 'skip', text: 'Пропустить'},
                ])
            );
            return ctx.wizard.next();
        },
        buttonStep([
            {code: 'skip', callback: (ctx, nextStep) => nextStep(ctx)}
        ], [
            {code: 'message', callback(ctx, nextStep) {
                    ctx.wizard.state.profile.details = ctx.message.text.trim();
                    return nextStep(ctx);
                }}
        ]),
        (ctx) => {
            ctx.reply('Теперь пришли фото, его будут видеть другие пользователи');
            return ctx.wizard.next();
        },
        async (ctx) => {
            let hasPhoto = ctx.message.photo && ctx.message.photo.length > 0;

            if (!hasPhoto) {
                ctx.reply('Пожалуйста, пришли фото');
                return;
            }

            let photos = ctx.message.photo;
            let photo = photos[0];

            ctx.wizard.state.profile.photo = photo;
            let profile = ctx.wizard.state.profile;
            let profileText = datingManager.getProfileText(profile);

            await ctx.reply('Так выглядит твоя анкета:');
            await ctx.replyWithPhoto(photo.file_id, {caption: profileText});

            ctx.reply('Все верно?', menu([
                {code: 'yes', text: 'Да'},
                {code: 'no', text: 'Изменить анкету'},
            ]));
            return ctx.wizard.next();
        },
        buttonStep([
            {code: 'yes', callback: (ctx, nextStep) => nextStep(ctx)},
            {code: 'no', callback: (ctx, nextStep, selectStep) => selectStep(ctx, 2)}
        ]),
        async (ctx) => {
            let profile = ctx.wizard.state.profile;
            let savedProfile = await datingManager.saveProfile(profile);
            ctx.wizard.state.profile = savedProfile;
            ctx.session.profile = savedProfile;
            ctx.reply('Анкета сохранена');
            return ctx.scene.enter('mainMenu');
        },
    );
}
