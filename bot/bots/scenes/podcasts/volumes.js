const Markup = require('telegraf/markup');
const BaseScene = require('telegraf/scenes/base');
const {menu} = require('../../helpers/wizard');
const {__} = require('../../../modules/Messages');

function moreMenu() {
    return menu([{code: 'more', text: 'Послушать другой'}]);
}
function volumesMenu(volumes, pageIndex = 0) {
    let MAX_VOLUMES_PER_PAGE = 10;
    let showPagination = volumes.length > MAX_VOLUMES_PER_PAGE;
    let pageVolumes = showPagination
        ? volumes.splice(pageIndex * MAX_VOLUMES_PER_PAGE, MAX_VOLUMES_PER_PAGE)
        : volumes;

    let volumeButtons = pageVolumes.map(volume => {
        return [Markup.callbackButton(volume.title, 'volume_'+volume.platformId)];
    });

    if (showPagination) {
        let maxPageIndex = Math.floor(volumes.length / MAX_VOLUMES_PER_PAGE);
        if (maxPageIndex * MAX_VOLUMES_PER_PAGE < volumes.length) {
            maxPageIndex+=1;
        }

        let prevPageIndex = pageIndex > 0 ? pageIndex-1 : false;
        let nextPageIndex = pageIndex < maxPageIndex ? pageIndex+1 : false;

        let pageButtons = [];
        if (prevPageIndex !== false) {
            pageButtons.push(Markup.callbackButton('◀', 'page_'+prevPageIndex));
        }

        if (nextPageIndex !== false) {
            pageButtons.push(Markup.callbackButton('▶', 'page_'+nextPageIndex));
        }

        volumeButtons.push(pageButtons);
    }

    return Markup.inlineKeyboard(volumeButtons).extra();
}

function replyWithListenLink(link, ctx) {
    return ctx.safeReply(
        async ctx => {
            await ctx.replyWithHTML(__('Ссылка на прослушивание: '+link, ['content', 'link']), moreMenu());
        }, null, ctx
    );
}

module.exports = function (podcastManager) {
    const scene = new BaseScene('volumes');

    scene.enter(async ctx => {
        let podcastIndex = ctx.session.index;
        let fromPage = ctx.session.fromPage || false;
        let pageIndex = ctx.session.volumesPageIndex || 0;

        ctx.session.fromPage = false;

        if (typeof (podcastIndex) !== 'number') {
            return ctx.scene.enter('discover');
        }

        let categoryIds = podcastManager.getSavedCategories(ctx);
        let {podcast} = await podcastManager.getPodcastByIndex(podcastIndex, categoryIds);
        let hasVolumes = podcastManager.isListSupported(podcast);

        if (!hasVolumes) {
            await podcastManager.saveListen(ctx.session.userId, podcast);
            return replyWithListenLink(podcast.link, ctx);
        }

        let volumes = await podcastManager.getVolumesByPodcast(podcast);
        return ctx.safeReply(
            async ctx => {
                if (fromPage) {
                    return await ctx.editMessageText('Выпуски подкаста', volumesMenu(volumes, pageIndex));
                }
                else {
                    return await ctx.reply('Выпуски подкаста', volumesMenu(volumes, pageIndex));
                }
            }, null, ctx
        );
    });

    scene.action(/page_(\d+)/, ctx => {
        ctx.session.fromPage = true;
        ctx.session.volumesPageIndex = parseInt(ctx.match[1]);
        return ctx.scene.reenter();
    });

    scene.action('more', ctx => {
        return ctx.scene.enter('discover');
    });

    scene.action(/volume_(.*)/, async ctx => {
        ctx.session.volumesPageIndex = 0;
        let volumeId = ctx.match[1];

        let podcastIndex = ctx.session.index;
        if (typeof (podcastIndex) !== 'number') {
            return ctx.scene.enter('discover');
        }

        await ctx.replyWithHTML(__('Подождите, идет загрузка подкаста', ['status', 'wait']));

        let categoryIds = podcastManager.getSavedCategories(ctx);
        let {podcast} = await podcastManager.getPodcastByIndex(podcastIndex, categoryIds);
        let volumes = await podcastManager.getVolumesByPodcast(podcast);
        if (!volumes) {
            return ctx.scene.reenter();
        }

        let volume = volumes.find(volume => volume.platformId.toString() === volumeId);

        if (!volume) {
            return ctx.scene.reenter();
        }

        await podcastManager.saveListen(ctx.session.userId, podcast, volume);

        let canDownload = podcastManager.isDownloadSupported(podcast);
        if  (!canDownload) {
            return replyWithListenLink(volume.pageUrl, ctx);
        }

        let mp3 = await podcastManager.getVolumeMp3(volume);

        return ctx.safeReply(
            async ctx => {
                let extra = moreMenu();
                extra.caption = __(`<b>${podcast.title}</b>\n${volume.title}\n\nПриятного прослушивания!`, ['content', 'audio'], 'audio');
                extra.parse_mode = 'html';

                return await ctx.replyWithAudio({source: mp3}, extra);
            },
            async ctx => {
                let message = __(`<b>${podcast.title}</b>\n${volume.title}\n\nПриятного прослушивания!\n\n`+volume.pageUrl, ['content', 'audio', 'info']);
                return ctx.replyWithHTML(message, moreMenu());
            }, ctx
        );
    });

    return scene;
}