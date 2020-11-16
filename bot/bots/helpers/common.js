async function catchErrors(err, ctx) {
    console.log(err);
    try {
        await ctx.reply('Похоже, что-то пошло не по плану.\nПопробуйте начать заново /start.');
    }
    catch (e) {
    }

    return;
}

module.exports = {catchErrors}