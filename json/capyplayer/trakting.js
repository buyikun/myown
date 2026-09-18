/*
 * CapyPlayer Widget - Trakt 继续观看 Fast (OAuth 版)
 * v1.3.0-fast-oauth
 *
 * 目标：
 * - 解决 loadContinueWatching 超过 30 秒超时，极速加载，不卡顿
 * - 增加 OAuth 授权，获取真实播放进度（含电影）
 * - 按照最新播放（或上映/播出时间）排序
 * - 同一部剧多集暂停去重，只保留最新的一集
 *
 * 保留：
 * - Trakt 观看记录，下一集判断，追平隐藏，新集重新出现
 * - Trakt aired_episodes 兜底，Trakt 评分优先 -> TMDB 兜底
 * - 🔶 / 🔷，固定“第X集”
 */

WidgetMetadata = {
    id: "trakt_continue_oauth_fast",
    title: "Trakt 继续观看 (OAuth 极速版)",
    author: "Blue & Optimized",
    description: "极速加载，OAuth 授权支持电影和真实进度，按最新排序并去重。",
    version: "1.3.0-fast",
    requiredVersion: "0.0.1",

    globalParams: [
        { name: "oauthClientId", title: "OAuth Client ID", type: "input", value: "" },
        { name: "oauthClientSecret", title: "OAuth Client Secret", type: "input", value: "" },
        { name: "oauthRedirectUri", title: "OAuth Redirect URI", type: "input", value: "urn:ietf:wg:oauth:2.0:oob" }
    ],

    modules: [
        {
            title: "我的片单",
            functionName: "loadContinueWatchingOAuth",
            type: "list",
            cacheDuration: 0, // 强制每次 0 缓存实时触发
            params: [
                { name: "page", title: "页码", type: "page" },
                {
                    name: "pageSize",
                    title: "每页数量",
                    type: "enumeration",
                    value: "15",
                    enumOptions: [
                        { title: "10", value: "10" },
                        { title: "15", value: "15" },
                        { title: "20", value: "20" }
                    ]
                }
            ]
        },
        {
            title: "Trakt OAuth 登录",
            functionName: "manageTraktOAuth",
            type: "list",
            cacheDuration: 0,
            params: [
                {
                    name: "oauthAction",
                    title: "OAuth 操作",
                    type: "enumeration",
                    value: "status",
                    enumOptions: [
                        { title: "🔐 查看登录状态", value: "status" },
                        { title: "1️⃣ 生成设备登录码", value: "start" },
                        { title: "2️⃣ 检查授权并完成登录", value: "complete" },
                        { title: "🚪 退出登录", value: "logout" }
                    ]
                }
            ]
        }
    ]
};

const TRAKT_BASE = "https://api.trakt.tv";
const TRAKT_AUTH_BASE = "https://auth.trakt.tv";
const STORAGE_TOKEN_KEY = "trakt_oauth_token_v6";
const STORAGE_DEVICE_KEY = "trakt_oauth_device_v6";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

/*
 * Fast 参数
 */
const MAX_WATCHED_FETCH = 100;
const MAX_DEEP_CHECK = 30; // 适当增加以覆盖更多记录，但仍限制深查数量
const MAX_CONCURRENCY = 15; // 提高并发以实现极速

const tmdbShowCache = new Map();
const tmdbSeasonCache = new Map();
const traktRatingCache = new Map();

// ============================================================
// 主入口
// ============================================================

async function loadContinueWatchingOAuth(params = {}) {
    const { oauthClientId, oauthClientSecret, oauthRedirectUri = "urn:ietf:wg:oauth:2.0:oob", page = 1, pageSize = 15 } = params;
    const currentPage = Math.max(1, Number(page) || 1);
    const limit = Math.max(1, Number(pageSize) || 15);

    if (!oauthClientId || !oauthClientSecret) {
        return [{ id: "setup", type: "text", title: "需要 OAuth 设置", description: "请先在组件设置中填写 OAuth Client ID 和 Secret，然后进入「Trakt OAuth 登录」授权。" }];
    }

    try {
        const accessToken = await ensureOAuthToken(oauthClientId, oauthClientSecret, oauthRedirectUri);

        // 并发获取：电影暂停、剧集暂停、剧集观看历史、隐藏列表
        // 极大减少全量请求的数据量，提高响应速度
        const [playbackMovies, playbackEpisodes, watchedShows, hiddenShows] = await Promise.all([
            fetchTraktData(`${TRAKT_BASE}/sync/playback/movies?extended=full&limit=40`, accessToken, oauthClientId),
            fetchTraktData(`${TRAKT_BASE}/sync/playback/episodes?extended=full&limit=60`, accessToken, oauthClientId),
            fetchTraktData(`${TRAKT_BASE}/sync/watched/shows?extended=progress&limit=${MAX_WATCHED_FETCH}`, accessToken, oauthClientId),
            fetchTraktData(`${TRAKT_BASE}/users/hidden/progress_watched?type=show&limit=100`, accessToken, oauthClientId)
        ]);

        const hiddenShowIds = new Set(hiddenShows.map(h => h.show?.ids?.tmdb).filter(Boolean));
        let mediaMap = new Map(); // 核心去重字典

        // 1. 提取电影暂停记录
        playbackMovies.forEach(item => {
            const p = Number(item?.progress);
            if (p > 0 && p < 100) {
                const tmdbId = item.movie?.ids?.tmdb;
                if (!tmdbId) return;
                const key = `movie_${tmdbId}`;
                const t = safeTime(item.paused_at);
                if (!mediaMap.has(key) || mediaMap.get(key)._sortTime < t) {
                    mediaMap.set(key, { ...item, _type: "movie_playback", _sortTime: t });
                }
            }
        });

        // 2. 提取剧集暂停记录 (单剧去重)
        playbackEpisodes.forEach(item => {
            const p = Number(item?.progress);
            if (p > 0 && p < 100) {
                const tmdbId = item.show?.ids?.tmdb;
                if (!tmdbId || hiddenShowIds.has(tmdbId)) return;
                const key = `show_${tmdbId}`;
                const t = safeTime(item.paused_at);
                if (!mediaMap.has(key) || mediaMap.get(key)._sortTime < t) {
                    mediaMap.set(key, { ...item, _type: "show_playback", _sortTime: t });
                }
            }
        });

        // 3. 提取智能待看 (极速过滤已追平剧集)
        watchedShows.forEach(item => {
            const tmdbId = item.show?.ids?.tmdb;
            if (!tmdbId || hiddenShowIds.has(tmdbId)) return;
            const key = `show_${tmdbId}`;
            
            // 如果这部剧正在看一半，就不参与“待看”推算了
            if (mediaMap.has(key)) return; 

            const watchedCount = countWatchedEpisodes(item);
            const airedCount = Number(item.show?.aired_episodes || 0);
            
            // 性能大杀器：利用 Trakt 原生数据秒级过滤已追平剧集，免去 TMDB 请求
            if (airedCount > 0 && watchedCount >= airedCount) return; 

            if (watchedCount > 0) {
                mediaMap.set(key, { ...item, _type: "show_upnext", _sortTime: safeTime(item.last_watched_at) });
            }
        });

        // 转为数组并严格按最近操作时间排序，保证最新活跃的在前
        let combinedItems = Array.from(mediaMap.values()).sort((a, b) => b._sortTime - a._sortTime);

        // 深查数量限制
        const candidates = combinedItems.slice(0, MAX_DEEP_CHECK);

        // 第一阶段：基础构建
        const checked = await mapWithConcurrency(candidates, MAX_CONCURRENCY, async item => {
            try {
                if (item._type === "movie_playback") return await buildMoviePlaybackItemBase(item);
                if (item._type === "show_playback") return await buildShowPlaybackItemBase(item);
                if (item._type === "show_upnext") return await buildShowUpNextItemBase(item);
            } catch (e) {
                console.warn("构建条目失败:", e?.message || String(e));
                return null;
            }
        });

        const available = checked.filter(Boolean);

        // 分页
        const start = (currentPage - 1) * limit;
        const pageItems = available.slice(start, start + limit);

        if (!pageItems.length) {
            return currentPage === 1 ? [{ id: "empty-progress", type: "text", title: "暂无可继续观看的新集", description: "已追到当前最新集，新集播出后会重新显示" }] : [];
        }

        // 第二阶段：只给最终显示的卡片补 Trakt Rating
        const output = await mapWithConcurrency(pageItems, MAX_CONCURRENCY, async data => {
            try { return await finalizeMediaItem(data); } catch (e) { return data.media; }
        });

        return output.filter(Boolean);

    } catch (e) {
        console.error("加载失败:", e?.message || String(e));
        return [{ id: "err-load", type: "text", title: "读取 Trakt 失败", description: (e?.message || String(e)) + "\n请稍后重试" }];
    }
}

// 绝对防缓存网络请求
async function fetchTraktData(urlBase, accessToken, clientId) {
    try {
        const url = `${urlBase}&_t=${Date.now()}&_r=${Math.random()}`;
        const res = await Widget.http.get(url, {
            headers: {
                "Content-Type": "application/json",
                "trakt-api-version": "2",
                "trakt-api-key": clientId,
                "Authorization": `Bearer ${accessToken}`,
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache"
            }
        });
        return Array.isArray(res?.data) ? res.data : [];
    } catch (e) { return []; }
}

// ============================================================
// 第一阶段：基础构建
// ============================================================

async function buildMoviePlaybackItemBase(item) {
    const movie = item.movie;
    const tmdbId = Number(movie?.ids?.tmdb || 0) || null;
    let tmdbData = tmdbId ? await fetchTmdbShow(tmdbId, "movie") : null;

    const progress = normalizeRating(item.progress);
    const title = tmdbData?.title || movie.title || "未知电影";
    const releaseDateStr = tmdbData?.release_date || movie.released || "";
    const year = String(releaseDateStr).slice(0, 4) || "";
    const pausedAt = formatDate(item.paused_at);

    const lines = [
        `🔶 恢复播放 · 电影`,
        `🔷 播放进度 · ${formatPercent(progress)}%`
    ];
    if (pausedAt) lines.push(`上次观看 · ${pausedAt}`);

    const media = {
        id: `movie_${tmdbId || movie?.ids?.trakt}`,
        type: "tmdb",
        mediaType: "movie",
        title: title,
        year: year,
        description: lines.join("\n"),
        currentSeason: 0,
        currentEpisode: 0,
        currentEpisodeName: "电影"
    };

    const tmdbRating = normalizeRating(tmdbData?.vote_average);
    if (tmdbRating > 0) media.rating = tmdbRating;
    if (tmdbId) media.tmdbId = tmdbId;
    if (tmdbData?.poster_path) media.posterPath = TMDB_IMG + tmdbData.poster_path;

    return { media: media, show: movie, tmdbRating: tmdbRating, type: "movie" };
}

async function buildShowPlaybackItemBase(item) {
    const show = item.show;
    const ep = item.episode;
    const tmdbId = Number(show?.ids?.tmdb || 0) || null;
    let tmdbShow = tmdbId ? await fetchTmdbShow(tmdbId, "tv") : null;

    const progress = normalizeRating(item.progress);
    const season = Number(ep.season || 0);
    const episode = Number(ep.number || 0);
    const title = tmdbShow?.name || tmdbShow?.original_name || show.title || "未知剧集";
    const se = `S${pad2(season)}E${pad2(episode)}`;
    const episodeTitle = `第${episode}集`;
    const pausedAt = formatDate(item.paused_at);

    const lines = [
        `🔶 恢复播放 · ${se} · ${episodeTitle}`,
        `🔷 播放进度 · ${formatPercent(progress)}%`
    ];
    if (pausedAt) lines.push(`上次观看 · ${pausedAt}`);

    const media = {
        id: `tv_play_${tmdbId || show?.ids?.trakt}`,
        type: "tmdb",
        mediaType: "tv",
        title: `${title} · ${se}`,
        year: String(ep.first_aired || tmdbShow?.first_air_date || "").slice(0, 4) || "",
        description: lines.join("\n"),
        currentSeason: season,
        currentEpisode: episode,
        currentEpisodeName: episodeTitle
    };

    const tmdbRating = normalizeRating(tmdbShow?.vote_average);
    if (tmdbRating > 0) media.rating = tmdbRating;
    if (tmdbId) media.tmdbId = tmdbId;
    if (tmdbShow?.poster_path) media.posterPath = TMDB_IMG + tmdbShow.poster_path;

    return { media: media, show: show, tmdbRating: tmdbRating, type: "show" };
}

async function buildShowUpNextItemBase(item) {
    const show = item?.show || {};
    const tmdbId = Number(show?.ids?.tmdb || 0) || null;
    const last = getLastWatchedEpisode(item);
    if (!last) return null;

    const watchedCount = countWatchedEpisodes(item);
    let tmdbShow = null;
    let tmdbFailed = false;

    if (tmdbId) {
        try { tmdbShow = await fetchTmdbShow(tmdbId, "tv"); } catch (e) { tmdbFailed = true; }
    }

    const aired = getAiredEpisodeCount(show, tmdbShow);
    const result = await inferNextEpisode(last, tmdbId, tmdbShow, show, aired, tmdbFailed);

    if (result.status === "none" || result.status === "lookup_failed") return null;

    const next = result.next;
    const title = tmdbShow?.name || tmdbShow?.original_name || show.title || "未知剧集";
    const year = String(show.year || String(tmdbShow?.first_air_date || "").slice(0, 4) || "");
    const targetSeason = Number(next.season || 0);
    const targetEpisode = Number(next.episode || 0);
    const se = `S${pad2(targetSeason)}E${pad2(targetEpisode)}`;
    const episodeTitle = `第${targetEpisode}集`;

    const pct = aired > 0 ? Math.min(100, Math.max(0, watchedCount / aired * 100)) : 0;
    const progressText = aired > 0 ? `${formatPercent(pct)}%（${watchedCount}/${aired} 集）` : `${watchedCount} 集`;
    const lastWatchedDate = formatDate(item?.last_watched_at);

    const lines = [
        `🔶 继续观看 · ${se} · ${episodeTitle}`,
        `🔷 观看进度 · ${progressText}`
    ];
    if (lastWatchedDate) lines.push(`上次观看 · ${lastWatchedDate}`);

    const media = {
        id: String(tmdbId || show?.ids?.trakt || title),
        type: "tmdb",
        mediaType: "tv",
        title: `${title} · ${se}`,
        year: year,
        description: lines.join("\n"),
        currentSeason: targetSeason,
        currentEpisode: targetEpisode,
        currentEpisodeName: episodeTitle
    };

    const tmdbRating = normalizeRating(tmdbShow?.vote_average);
    if (tmdbRating > 0) media.rating = tmdbRating;
    if (tmdbId) media.tmdbId = tmdbId;
    if (tmdbShow?.poster_path) media.posterPath = TMDB_IMG + tmdbShow.poster_path;

    return { media: media, show: show, tmdbRating: tmdbRating, type: "show" };
}

// ============================================================
// 第二阶段：补 Trakt Rating
// ============================================================

async function finalizeMediaItem(data) {
    const media = data?.media;
    if (!media) return null;
    const showOrMovie = data?.show || {};

    const traktRating = await fetchTraktRating(showOrMovie, data.type);
    if (traktRating > 0) media.rating = traktRating;

    return media;
}

// ============================================================
// 下一集判断
// ============================================================

async function inferNextEpisode(last, tmdbId, tmdbShow, show, aired, showLookupFailed = false) {
    if (!last) return { status: "none" };

    const traktAired = Number(aired || show?.aired_episodes || 0);

    if (!tmdbId || showLookupFailed) {
        if (last.season === 1 && traktAired > last.episode) {
            return { status: "next", next: { season: last.season, episode: last.episode + 1 } };
        }
        return { status: "lookup_failed" };
    }

    let seasonData;
    try {
        seasonData = await fetchTmdbSeason(tmdbId, last.season);
    } catch (e) {
        if (last.season === 1 && traktAired > last.episode) {
            return { status: "next", next: { season: last.season, episode: last.episode + 1 } };
        }
        return { status: "lookup_failed" };
    }

    const episodes = Array.isArray(seasonData?.episodes) ? seasonData.episodes : [];
    const nextEpisode = episodes.find(ep => Number(ep?.episode_number) === last.episode + 1 && hasAired(ep?.air_date));

    if (nextEpisode) {
        return { status: "next", next: { season: last.season, episode: Number(nextEpisode.episode_number) } };
    }

    const lastEpisodeToAir = tmdbShow?.last_episode_to_air;
    if (lastEpisodeToAir && Number(lastEpisodeToAir.season_number) === last.season && Number(lastEpisodeToAir.episode_number) >= last.episode + 1) {
        return { status: "next", next: { season: last.season, episode: last.episode + 1 } };
    }

    if (last.season === 1 && traktAired > last.episode) {
        return { status: "next", next: { season: last.season, episode: last.episode + 1 } };
    }

    const nextSeasonNo = last.season + 1;
    const hasNextSeason = Array.isArray(tmdbShow?.seasons) && tmdbShow.seasons.some(season => Number(season?.season_number) === nextSeasonNo && Number(season?.episode_count || 0) > 0);

    if (!hasNextSeason) return { status: "none" };

    let nextSeason;
    try {
        nextSeason = await fetchTmdbSeason(tmdbId, nextSeasonNo);
    } catch (e) {
        return { status: "lookup_failed" };
    }

    const episode1 = Array.isArray(nextSeason?.episodes) ? nextSeason.episodes.find(ep => Number(ep?.episode_number) === 1 && hasAired(ep?.air_date)) : null;

    if (!episode1) return { status: "none" };

    return { status: "next", next: { season: nextSeasonNo, episode: 1 } };
}

// ============================================================
// Trakt Rating
// ============================================================

async function fetchTraktRating(showOrMovie, type) {
    const lookupId = showOrMovie?.ids?.slug || showOrMovie?.ids?.trakt;
    if (!lookupId) return 0;
    
    const key = `${type}_${lookupId}`;
    if (traktRatingCache.has(key)) return await traktRatingCache.get(key);

    const promise = fetchTraktRatingInternal(lookupId, type);
    traktRatingCache.set(key, promise);

    try {
        const rating = await promise;
        traktRatingCache.set(key, rating);
        return rating;
    } catch (e) {
        traktRatingCache.delete(key);
        return 0;
    }
}

async function fetchTraktRatingInternal(lookupId, type) {
    const endpoint = type === "movie" ? "movies" : "shows";
    const url = `${TRAKT_BASE}/${endpoint}/${encodeURIComponent(lookupId)}/ratings`;

    const res = await Widget.http.get(url, {
        headers: { "Content-Type": "application/json", "trakt-api-version": "2", "trakt-api-key": INTERNAL_CLIENT_ID }
    });

    if (!res || res.ok === false) return 0;
    let data = (res?.data !== undefined) ? res.data : res;
    if (typeof data === "string") {
        try { data = JSON.parse(data); } catch (e) { return 0; }
    }
    return normalizeRating(data?.rating);
}

// ============================================================
// TMDB
// ============================================================

async function fetchTmdbShow(tmdbId, type = "tv") {
    const key = `${type}_${tmdbId}`;
    if (tmdbShowCache.has(key)) return await tmdbShowCache.get(key);

    const promise = Widget.tmdb.get(`/${type}/${tmdbId}`, { params: { language: "zh-CN" } });
    tmdbShowCache.set(key, promise);

    try {
        const data = await promise;
        tmdbShowCache.set(key, data || null);
        return data || null;
    } catch (e) {
        tmdbShowCache.delete(key);
        throw e;
    }
}

async function fetchTmdbSeason(tmdbId, seasonNo) {
    const key = `${tmdbId}:${seasonNo}`;
    if (tmdbSeasonCache.has(key)) return await tmdbSeasonCache.get(key);

    const promise = Widget.tmdb.get(`/tv/${tmdbId}/season/${seasonNo}`, { params: { language: "zh-CN" } });
    tmdbSeasonCache.set(key, promise);

    try {
        const data = await promise;
        tmdbSeasonCache.set(key, data || null);
        return data || null;
    } catch (e) {
        tmdbSeasonCache.delete(key);
        throw e;
    }
}

// ============================================================
// 辅助计算
// ============================================================

function countWatchedEpisodes(item) {
    let count = 0;
    const seasons = Array.isArray(item?.seasons) ? item.seasons : [];
    for (const season of seasons) {
        if (Number(season?.number || 0) === 0) continue;
        const episodes = Array.isArray(season?.episodes) ? season.episodes : [];
        for (const ep of episodes) { if (Number(ep?.plays || 0) > 0) count++; }
    }
    return count;
}

function getLastWatchedEpisode(item) {
    const seasons = Array.isArray(item?.seasons) ? item.seasons : [];
    let best = null;
    for (const season of seasons) {
        const seasonNo = Number(season?.number || 0);
        if (seasonNo <= 0) continue;
        const episodes = Array.isArray(season?.episodes) ? season.episodes : [];
        for (const ep of episodes) {
            if (Number(ep?.plays || 0) <= 0) continue;
            const episodeNo = Number(ep?.number || 0);
            if (episodeNo <= 0) continue;
            if (!best || seasonNo > best.season || (seasonNo === best.season && episodeNo > best.episode)) {
                best = { season: seasonNo, episode: episodeNo };
            }
        }
    }
    return best;
}

function getAiredEpisodeCount(show, tmdbShow) {
    const traktAired = Number(show?.aired_episodes || 0);
    if (traktAired > 0) return traktAired;
    return Number(tmdbShow?.number_of_episodes || 0);
}

function hasAired(dateStr) {
    if (!dateStr) return false;
    const date = new Date(String(dateStr) + "T00:00:00Z");
    if (isNaN(date.getTime())) return false;
    return date.getTime() <= Date.now();
}

async function mapWithConcurrency(items, concurrency, worker) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return [];
    const results = new Array(list.length);
    let cursor = 0;
    const runnerCount = Math.min(Math.max(1, concurrency || 1), list.length);

    const runners = new Array(runnerCount).fill(0).map(async () => {
        while (true) {
            const index = cursor++;
            if (index >= list.length) return;
            try { results[index] = await worker(list[index], index); } catch (e) { results[index] = null; }
        }
    });

    await Promise.all(runners);
    return results;
}

function normalizeRating(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 10) / 10;
}

function safeTime(value) {
    const t = new Date(value || 0).getTime();
    return isNaN(t) ? 0 : t;
}

function formatDate(value) {
    if (!value) return "";
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
}

function pad2(value) {
    const n = Number(value || 0);
    return n < 10 ? "0" + n : String(n);
}

function formatPercent(value) {
    const n = Number(value || 0);
    const one = Math.round(n * 10) / 10;
    return Number.isInteger(one) ? String(one) : one.toFixed(1);
}

// ==========================================
// OAuth 认证流
// ==========================================
async function manageTraktOAuth(params = {}) {
    const { oauthAction = "status", oauthClientId, oauthClientSecret, oauthRedirectUri = "urn:ietf:wg:oauth:2.0:oob" } = params;
    if (!Widget.storage) return [{ id: "err", type: "text", title: "当前版本不支持存储" }];
    
    if (oauthAction === "logout") {
        Widget.storage.remove(STORAGE_TOKEN_KEY); Widget.storage.remove(STORAGE_DEVICE_KEY);
        return [{ id: "out", type: "text", title: "已退出登录" }];
    }
    if (!oauthClientId || !oauthClientSecret) return [{ id: "miss", type: "text", title: "请先填写 Client ID 和 Secret" }];

    if (oauthAction === "start") {
        try {
            const res = await Widget.http.post(`${TRAKT_AUTH_BASE}/oauth/device/code`, { client_id: oauthClientId }, { headers: { "Content-Type": "application/json" }});
            Widget.storage.set(STORAGE_DEVICE_KEY, JSON.stringify(res.data));
            return [{ id: "code", type: "text", title: `登录码：${res.data.user_code}`, description: `1. 手机打开网址: https://trakt.tv/activate\n2. 输入上方登录码\n3. 返回此处点击"2️⃣ 检查授权"` }];
        } catch(e) { return [{ id: "err", type: "text", title: "获取登录码失败" }]; }
    }

    if (oauthAction === "complete") {
        const device = JSON.parse(Widget.storage.get(STORAGE_DEVICE_KEY) || "{}");
        if (!device.device_code) return [{ id: "err", type: "text", title: "请先生成登录码" }];
        try {
            const res = await Widget.http.post(`${TRAKT_AUTH_BASE}/oauth/device/token`, { code: device.device_code, client_id: oauthClientId, client_secret: oauthClientSecret }, { headers: { "Content-Type": "application/json" }});
            Widget.storage.set(STORAGE_TOKEN_KEY, JSON.stringify({...res.data, created_at: Math.floor(Date.now() / 1000)}));
            Widget.storage.remove(STORAGE_DEVICE_KEY);
            return [{ id: "ok", type: "text", title: "登录成功！", description: "现在可以去打开「继续观看」了" }];
        } catch(e) { return [{ id: "wait", type: "text", title: "等待授权中...", description: "请确保在网页上已点击同意授权，然后再试一次" }]; }
    }
    
    const token = JSON.parse(Widget.storage.get(STORAGE_TOKEN_KEY) || "{}");
    if(token.access_token) return [{ id: "ok", type: "text", title: "Trakt 已登录", description: "享受无残留的极速完美列表吧！" }];
    return [{ id: "no", type: "text", title: "未登录", description: "请选择 1️⃣ 开始生成登录码" }];
}

async function ensureOAuthToken(clientId, clientSecret, redirectUri) {
    let token = JSON.parse(Widget.storage.get(STORAGE_TOKEN_KEY) || "{}");
    if (!token.access_token) throw new Error("未登录");
    const now = Math.floor(Date.now() / 1000);
    if (token.refresh_token && now >= (token.created_at + token.expires_in - 86400)) {
        const res = await Widget.http.post(`${TRAKT_AUTH_BASE}/oauth/token`, { refresh_token: token.refresh_token, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", redirect_uri: redirectUri }, { headers: { "Content-Type": "application/json" }});
        token = {...res.data, created_at: now};
        Widget.storage.set(STORAGE_TOKEN_KEY, JSON.stringify(token));
    }
    return token.access_token;
}
