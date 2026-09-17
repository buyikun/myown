var WidgetMetadata = {
    id: "trakt_continue_watching",
    title: "Trakt 继续观看",
    description: "读取 Trakt 正在观看记录",
    version: "1.0.2",

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
            cacheDuration: 60,
            timeoutSeconds: 30,
            retryCount: 0
        }
    ]
};


/**
 * Trakt 请求
 */
async function traktRequest(path, params) {

    var clientId = String(params.traktClientId || "").trim();
    var accessToken = String(params.traktAccessToken || "").trim();

    if (!clientId) {
        throw new Error("Trakt Client ID 为空");
    }

    if (!accessToken) {
        throw new Error("Trakt Access Token 为空");
    }

    var headers = {
        "Accept": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": clientId,
        "Authorization": "Bearer " + accessToken,
        "User-Agent": "CapyPlayer-Trakt-Widget/1.0"
    };

    console.log(
        "[Trakt] REQUEST",
        path
    );

    var response = await Widget.http.get(
        "https://api.trakt.tv" + path,
        {
            params: params.query || {},
            headers: headers,
            timeout: 30000
        }
    );

    console.log(
        "[Trakt] RESPONSE",
        "ok=" + response.ok,
        "status=" + response.status
    );

    if (!response.ok) {
        throw new Error(
            "Trakt HTTP " +
            response.status +
            " - " +
            path
        );
    }

    var data = response.data;

    console.log(
        "[Trakt] DATA TYPE",
        typeof data
    );

    /*
     * CapyPlayer 文档中的 Widget.http 返回：
     *
     * {
     *   ok,
     *   status,
     *   data,
     *   headers
     * }
     *
     * 某些情况下 data 可能已经是对象，
     * 也可能还是 JSON 字符串。
     */

    if (typeof data === "string") {

        var text = data.trim();

        if (!text) {
            return [];
        }

        try {
            data = JSON.parse(text);
        } catch (e) {

            console.error(
                "[Trakt] JSON PARSE ERROR",
                String(e)
            );

            console.error(
                "[Trakt] RAW DATA",
                text.substring(0, 500)
            );

            throw new Error(
                "Trakt 返回的不是有效 JSON：" +
                text.substring(0, 100)
            );
        }
    }

    return data;
}


/**
 * 获取 Trakt 正在观看
 */
async function getTraktPlayback(params) {

    var data = await traktRequest(
        "/sync/playback",
        {
            traktClientId: params.traktClientId,
            traktAccessToken: params.traktAccessToken,
            query: {
                limit: 10
            }
        }
    );

    if (!Array.isArray(data)) {

        console.error(
            "[Trakt] playback 返回不是数组",
            data
        );

        return [];
    }

    console.log(
        "[Trakt] playback count =",
        data.length
    );

    return data;
}


/**
 * 主数据源
 */
async function getContinueWatching(params) {

    try {

        console.log(
            "[continue_watching] 开始读取 Trakt"
        );

        var playback = await getTraktPlayback(params);

        console.log(
            "[continue_watching] Trakt 返回",
            playback.length,
            "items"
        );

        var result = [];

        for (var i = 0; i < playback.length; i++) {

            var item = playback[i];

            /*
             * 只处理电视剧
             */
            if (!item || !item.show) {
                continue;
            }

            /*
             * 只显示 0~100% 之间的未完成项目
             */
            var progress = Number(item.progress || 0);

            if (progress <= 0 || progress >= 100) {
                continue;
            }

            var show = item.show;

            var ids = show.ids || {};

            var tmdbId = ids.tmdb;

            if (!tmdbId) {

                console.log(
                    "[continue_watching] 跳过，没有 TMDB ID：",
                    show.title || ""
                );

                continue;
            }

            var season = 0;
            var episode = 0;

            if (item.episode) {
                season = Number(item.episode.season || 0);
                episode = Number(item.episode.number || 0);
            }

            var episodeText = "";

            if (season > 0 && episode > 0) {
                episodeText =
                    "S" +
                    String(season).padStart(2, "0") +
                    "E" +
                    String(episode).padStart(2, "0");
            }

            var title = show.title || "未知剧集";

            result.push({
                id: String(tmdbId),

                type: "tmdb",

                title:
                    title +
                    (episodeText ? " · " + episodeText : "") +
                    " · ▶ " +
                    progress.toFixed(1) +
                    "%",

                mediaType: "tv",

                tmdbId: String(tmdbId),

                description:
                    "Trakt 继续观看 · " +
                    (episodeText || "") +
                    " · 播放进度 " +
                    progress.toFixed(1) +
                    "%",

                currentSeason: season,

                currentEpisode: episode,

                posterUrl: "",

                backdropUrl: ""
            });
        }

        console.log(
            "[continue_watching] 最终返回",
            result.length,
            "items"
        );

        return result;

    } catch (e) {

        console.error(
            "[continue_watching] ERROR",
            String(e)
        );

        return [];
    }
}
