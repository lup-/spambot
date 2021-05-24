function markMessageToDelete(ctx, message) {
    if (ctx && ctx.session) {
        if (!ctx.session._deleteMessages) {
            ctx.session._deleteMessages = [];
        }

        ctx.session._deleteMessages.push(message);
    }

    return message;
}

async function deleteMiddleware(ctx, next) {
    let hasMessageToDelete = ctx && ctx.session && ctx.session._deleteMessages && ctx.session._deleteMessages.length > 0;

    if (hasMessageToDelete) {
        try {
            for (let message of ctx.session._deleteMessages) {
                await ctx.deleteMessage(message.message_id);
            }
        }
        finally {
            ctx.session._deleteMessages = [];
        }
    }

    ctx.markMessageToDelete = markMessageToDelete;
    ctx.replyWithDisposableHTML = async (html, extra) => {
        await deleteMiddleware(ctx, () => {});
        let message = await ctx.replyWithHTML(html, extra);
        markMessageToDelete(ctx, message);
    }

    return next();
}

module.exports = {markMessageToDelete, deleteMiddleware};