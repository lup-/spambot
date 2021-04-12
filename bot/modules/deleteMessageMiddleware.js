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

    return next();
}

module.exports = {markMessageToDelete, deleteMiddleware};