var WidgetMetadata = {
    id: "trakt_continue_watching",
    title: "Trakt 继续观看",
    description: "读取 Trakt 正在观看记录，并使用 TMDB ID交给 CapyPlayer 搜索资源",
    version: "1.0.1",

    icon: "https://trakt.tv/assets/logos/logotype.red.png",

    globalParams: [
        {
            name: "traktClientId",
            label: "Trakt Client ID",
            type: "string",
            required: true
        },
        {
            name: "traktAccessToken",
            label: "Trakt Access Token",
            type: "string",
            required: true
        }
    ],

    modules: [
        {
            id: "continue_watching",
            title: "继续观看",
            type: "media_list",
            functionName: "getContinueWatching",
            cacheDuration: 300,
            timeoutSeconds: 30,
            retryCount: 1
        }
    ]
};


/*
 * =========================
 * 基础配置
 * =========================
 */

var TRAKT_API = "https://api.trakt.tv";

var TMDB_IMAGE =
    "https://image.tmdb.org/t/p/w500";

var TMDB_BACKDROP =
    "https://image.tmdb.org/t/p/w1280";


/*
 * =========================
 * 工具函数
 * =========================
 */


/**
 * 安全解析 JSON
 */
function safeJson(data) {

    if (typeof data === "string") {

        try {
            return JSON.parse(data);
        } catch (e) {

            return {};
        }
    }

    return data || {};
}


/**
 * 确保返回数组
 */
function ensureArray(data) {

    return Array.isArray(data)
        ? data
        : [];
}


/**
 * Trakt 请求 Header
 */
function getTraktHeaders(params) {

    return {

        "trakt-api-version": "2",

        "trakt-api-key":
            String(params.traktClientId || ""),

        "Authorization":
            "Bearer " +
            String(params.traktAccessToken || ""),

        "Content-Type":
            "application/json",

        "Accept":
            "application/json"
    };
}


/**
 * S01E01
 */
function makeEpisodeCode(
    season,
    episode
) {

    var s =
        String(season || 0)
            .padStart(2, "0");

    var e =
        String(episode || 0)
            .padStart(2, "0");

    return "S" + s + "E" + e;
}


/**
 * 播放进度
 *
 * 62.3
 * ↓
 * 62.3%
 */
function makeProgressText(progress) {

    var value =
        Number(progress);

    if (!isFinite(value)) {

        return "0%";
    }

    return (
        value
            .toFixed(1)
            .replace(/\.0$/, "")
        + "%"
    );
}


/*
 * =========================
 * 获取 Trakt Playback
 * =========================
 */

async function getTraktPlayback(params) {

    var clientId =
        String(
            params.traktClientId || ""
        ).trim();


    var accessToken =
        String(
            params.traktAccessToken || ""
        ).trim();


    if (!clientId) {

        throw new Error(
            "未填写 Trakt Client ID"
        );
    }


    if (!accessToken) {

        throw new Error(
            "未填写 Trakt Access Token"
        );
    }


    var response =
        await Widget.http.get(

            TRAKT_API +
            "/sync/playback",

            {
                params: {
                    limit: 30
                },

                headers:
                    getTraktHeaders(params),

                timeout: 30000
            }
        );


    if (!response.ok) {

        throw new Error(
            "Trakt 请求失败 HTTP " +
            response.status
        );
    }


    return safeJson(
        response.data
    );
}


/*
 * =========================
 * TMDB 获取电视剧详情
 * =========================
 */

async function getTMDBTV(
    tmdbId,
    language
) {

    if (!tmdbId) {

        return null;
    }


    try {

        var data =
            await Widget.tmdb.get(

                "/tv/" +
                encodeURIComponent(
                    String(tmdbId)
                ),

                {
                    params: {
                        language:
                            language || "zh-CN"
                    },

                    timeout: 30000
                }
            );


        return data || null;

    } catch (e) {

        console.warn(
            "TMDB 获取失败:",
            String(tmdbId)
        );

        return null;
    }
}


/*
 * =========================
 * 创建 MediaItem
 * =========================
 */

function makeMediaItem(
    traktItem,
    tmdb
) {

    var show =
        traktItem.show || {};


    var episode =
        traktItem.episode || {};


    /*
     * TMDB ID
     */
    var tmdbId =
        show.ids &&
        show.ids.tmdb
            ? show.ids.tmdb
            : (
                tmdb &&
                tmdb.id
                    ? tmdb.id
                    : null
            );


    /*
     * 标题
     */
    var title =
        show.title ||
        (tmdb && tmdb.name) ||
        "未知作品";


    /*
     * 年份
     */
    var year = "";


    if (show.year) {

        year =
            String(show.year);

    } else if (
        tmdb &&
        tmdb.first_air_date
    ) {

        year =
            String(
                tmdb.first_air_date
            ).substring(0, 4);
    }


    /*
     * 当前集
     */
    var season =
        Number(
            episode.season || 1
        );


    var episodeNumber =
        Number(
            episode.number || 1
        );


    var episodeCode =
        makeEpisodeCode(
            season,
            episodeNumber
        );


    /*
     * 播放进度
     */
    var progress =
        Number(
            traktItem.progress || 0
        );


    /*
     * 当前集标题
     */
    var episodeTitle =
        episode.title || "";


    /*
     * 海报
     */
    var posterUrl = "";


    if (
        tmdb &&
        tmdb.poster_path
    ) {

        posterUrl =
            TMDB_IMAGE +
            tmdb.poster_path;
    }


    /*
     * 背景
     */
    var backdropUrl = "";


    if (
        tmdb &&
        tmdb.backdrop_path
    ) {

        backdropUrl =
            TMDB_BACKDROP +
            tmdb.backdrop_path;
    }


    /*
     * ============================
     * 最重要：
     *
     * type = tmdb
     *
     * 点击后交给 CapyPlayer。
     *
     * 不提供 videoUrl。
     * 不自己搜索服务器。
     * ============================
     */

    var item = {

        id:
            String(
                tmdbId ||
                (
                    show.ids &&
                    show.ids.trakt
                        ? show.ids.trakt
                        : title +
                          "-" +
                          season +
                          "-" +
                          episodeNumber
                )
            ),

        type:
            "tmdb",

        title:
            title +
            " · " +
            episodeCode +
            " · ▶ " +
            makeProgressText(progress),

        mediaType:
            "tv",

        posterUrl:
            posterUrl,

        backdropUrl:
            backdropUrl,

        description:
            "继续观看 · " +
            episodeCode +
            (
                episodeTitle
                    ? " · " + episodeTitle
                    : ""
            ) +
            " · Trakt 实际播放进度："
            +
            makeProgressText(progress),

        year:
            year,

        rating:
            tmdb &&
            typeof tmdb.vote_average === "number"
                ? tmdb.vote_average
                : null,

        tmdbId:
            tmdbId
                ? String(tmdbId)
                : null,

        currentSeason:
            season,

        currentEpisode:
            episodeNumber,

        currentEpisodeName:
            episodeTitle
    };


    return item;
}


/*
 * =========================
 * 主模块
 * =========================
 */

async function getContinueWatching(params) {

    try {

        var playback =
            await getTraktPlayback(
                params
            );


        var items =
            ensureArray(
                playback
            );


        /*
         * Trakt /sync/playback
         * 本身就是未完成播放列表。
         *
         * 再过滤一次：
         * 0 < progress < 100
         */
        items =
            items.filter(
                function(item) {

                    var progress =
                        Number(
                            item &&
                            item.progress
                        );


                    return (
                        item &&
                        item.show &&
                        isFinite(progress) &&
                        progress > 0 &&
                        progress < 100
                    );
                }
            );


        var result = [];


        /*
         * 逐个获取 TMDB
         */
        for (
            var i = 0;
            i < items.length &&
            i < 30;
            i++
        ) {

            var item =
                items[i];


            var tmdbId =
                item.show &&
                item.show.ids &&
                item.show.ids.tmdb
                    ? item.show.ids.tmdb
                    : null;


            var tmdb = null;


            if (tmdbId) {

                tmdb =
                    await getTMDBTV(
                        tmdbId,
                        params.language ||
                        "zh-CN"
                    );
            }


            /*
             * 即使 TMDB 暂时获取失败，
             * 也保留 Trakt 项目。
             */
            result.push(
                makeMediaItem(
                    item,
                    tmdb
                )
            );
        }


        console.log(
            "Trakt 继续观看：",
            result.length,
            "条"
        );


        return result;


    } catch (error) {

        console.error(
            "Trakt Continue Watching error:",
            error
        );


        /*
         * Widget 数据源必须返回数组
         */
        return [];
    }
}
