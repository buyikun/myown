/*
 * CapyPlayer Widget - Trakt 智能追剧 (单剧去重·官方纯净同步版)
 *
 * 核心优化：
 * 1. 同一剧集去重：同部剧只显示最新暂停的一集，拒绝列表重复。
 * 2. 官方隐藏同步：自动拉取 Trakt 隐藏列表，剔除不在官方 Up Next 中的幽灵老剧。
 * 3. 排序修复：严格按照最后观看/暂停时间排序，确保最近活跃的在最前。
 * 4. 完美跳转：坚决保留原生 currentSeason/Episode 字段与 link 魔法。
 */

WidgetMetadata = {
    id: "trakt_continue_oauth_ultimate_pure",
    title: "Trakt 恢复播放 (纯净去重版)",
    author: "MakkaPakka & Final Fixed",
    description: "去重多集、同步官方隐藏列表、严格按观看时间排序的完美版本。",
    version: "5.1.0",
    requiredVersion: "0.0.1",

    globalParams: [
        { name: "oauthClientId", title: "OAuth Client ID", type: "input", value: "" },
        { name: "oauthClientSecret", title: "OAuth Client Secret", type: "input", value: "" },
        { name: "oauthRedirectUri", title: "OAuth Redirect URI", type: "input", value: "urn:ietf:wg:oauth:2.0:oob" }
    ],

    modules: [
        {
            title: "继续观看",
            functionName: "loadContinueWatchingOAuth",
            type: "list",
            cacheDuration: 0, // 强制每次 0 缓存实时触发
            params: [
                { name: "page", title: "页码", type: "page" },
                { name: "pageSize", title: "每页数量", type: "enumeration", value: "15", enumOptions: [ { title: "10", value: "10" }, { title: "15", value: "15" }, { title: "20", value: "20" } ] }
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

const TRAKT_API_BASE = "https://api.trakt.tv";
const TRAKT_AUTH_BASE = "https://auth.trakt.tv";
const STORAGE_TOKEN_KEY = "trakt_oauth_token_v6";
const STORAGE_DEVICE_KEY = "trakt_oauth_device_v6";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const tmdbCache = new Map();
const TMDB_CONCURRENCY = 15;

// ==========================================
// 1. 核心：极速真实继续观看逻辑
// ==========================================
async function loadContinueWatchingOAuth(params = {}) {
    const { oauthClientId, oauthClientSecret, oauthRedirectUri = "urn:ietf:wg:oauth:2.0:oob", page = 1, pageSize = 15 } = params;
    const currentPage = Math.max(1, Number(page) || 1);
    const limit = Math.max(1, Number(pageSize) || 15);

    if (!oauthClientId || !oauthClientSecret) {
        return [{ id: "setup", type: "text", title: "需要 OAuth 设置", description: "请先在组件设置中填写 OAuth Client ID 和 Secret，然后进入「Trakt OAuth 登录」授权。" }];
    }

    try {
        const accessToken = await ensureOAuthToken(oauthClientId, oauthClientSecret, oauthRedirectUri);

        // 获取暂停的电影、暂停的剧集、看过的历史，【并且】拉取官方的隐藏列表
        const [playbackMovies, playbackEpisodes, watchedShows, hiddenShows] = await Promise.all([
            fetchTraktData(`${TRAKT_API_BASE}/sync/playback/movies?extended=full&limit=40`, accessToken, oauthClientId),
            fetchTraktData(`${TRAKT_API_BASE}/sync/playback/episodes?extended=full&limit=100`, accessToken, oauthClientId),
            fetchTraktData(`${TRAKT_API_BASE}/sync/watched/shows?extended=progress&limit=100`, accessToken, oauthClientId),
            fetchTraktData(`${TRAKT_API_BASE}/users/hidden/progress_watched?type=show&limit=100`, accessToken, oauthClientId)
        ]);

        // 解析用户手动在官方隐藏的老剧
        const hiddenShowIds = new Set();
        hiddenShows.forEach(h => {
            if (h.show?.ids?.tmdb) hiddenShowIds.add(h.show.ids.tmdb);
        });

        // 核心去重容器：保证一部电影或一部剧只有一个卡片
        let mediaMap = new Map();

        // 1. 处理暂停的电影
        playbackMovies.forEach(item => {
            const p = Number(item?.progress);
            if (Number.isFinite(p) && p > 0 && p < 100) {
                const tmdbId = item.movie?.ids?.tmdb;
                if (!tmdbId) return;
                const key = `movie_${tmdbId}`;
                const t = safeTime(item.paused_at);
                // 留存最近暂停的那一个
                if (!mediaMap.has(key) || mediaMap.get(key)._sortTime < t) {
                    mediaMap.set(key, { ...item, _type: "movie_playback", _sortTime: t });
                }
            }
        });

        // 2. 处理暂停的剧集（解决同一部剧出好几个的问题）
        playbackEpisodes.forEach(item => {
            const p = Number(item?.progress);
            if (Number.isFinite(p) && p > 0 && p < 100) {
                const tmdbId = item.show?.ids?.tmdb;
                if (!tmdbId) return;
                if (hiddenShowIds.has(tmdbId)) return; // 被官方隐藏的，不显示

                const key = `show_${tmdbId}`;
                const t = safeTime(item.paused_at);
                // 留存最新的一集
                if (!mediaMap.has(key) || mediaMap.get(key)._sortTime < t) {
                    mediaMap.set(key, { ...item, _type: "show_playback", _sortTime: t });
                }
            }
        });

        // 3. 处理已看完了的剧集，推算下一集
        watchedShows.forEach(item => {
            const tmdbId = item.show?.ids?.tmdb;
            if (!tmdbId) return;
            if (hiddenShowIds.has(tmdbId)) return; // 被官方隐藏的幽灵老剧，绝对不显示

            const key = `show_${tmdbId}`;
            // 如果已经有正在看一半的进度了，就不用再推算了
            if (mediaMap.has(key)) return; 

            if (countWatchedEpisodes(item) > 0) {
                const t = safeTime(item.last_watched_at);
                mediaMap.set(key, { ...item, _type: "show_upnext", _sortTime: t });
            }
        });

        let combinedItems = Array.from(mediaMap.values());

        // 核心修复：坚决按照你【最后的观看/暂停时间】排倒序，绝不用播出时间！杜绝老剧顶上来的情况。
        combinedItems.sort((a, b) => b._sortTime - a._sortTime);

        const start = (currentPage - 1) * limit;
        const pageItems = combinedItems.slice(start, start + limit);

        const results = await mapWithConcurrency(pageItems, TMDB_CONCURRENCY, async (item) => {
            try {
                if (item._type === "movie_playback") return await buildMoviePlaybackItem(item);
                if (item._type === "show_playback") return await buildShowPlaybackItem(item);
                if (item._type === "show_upnext") return await buildShowUpNextItem(item);
            } catch (e) { return null; }
        });

        const allValidCards = results.filter(Boolean);

        if (!allValidCards.length) {
            return currentPage === 1 ? [{ id: "empty", type: "text", title: "暂无可观看内容", description: "电影已看完，剧集已全部追平。等新集播出后会自动出现！" }] : [];
        }

        return allValidCards;

    } catch (e) {
        return [{ id: "err", type: "text", title: "加载失败", description: String(e?.message || e) }];
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
                "Cache-Control": "no-cache, no-store, must-revalidate", // 强杀缓存
                "Pragma": "no-cache"
            }
        });
        return Array.isArray(res?.data) ? res.data : [];
    } catch (e) { return []; }
}

// === 构建电影暂停卡片 ===
async function buildMoviePlaybackItem(item) {
    const movie = item.movie;
    const tmdbId = Number(movie?.ids?.tmdb || 0) || null;
    let tmdbData = tmdbId ? await fetchTmdbCache(`/movie/${tmdbId}`) : null;

    const progress = normalizeProgress(item.progress);
    const title = tmdbData?.title || movie.title || "未知电影";

    const media = {
        id: `movie_${tmdbId || movie?.ids?.trakt}`,
        type: "tmdb",
        mediaType: "movie",
        title: title,
        year: String(tmdbData?.release_date || movie.released || "").slice(0, 4) || "",
        durationText: `▶ ${progress}%`,
        genreTitle: "恢复播放",
        description: `播放进度：${progress}%\n上次观看：${formatHistoryDateTime(item.paused_at)}`,
        link: tmdbId ? buildTraktResumeLink({ mediaType: "movie", tmdbId: tmdbId, progress: progress }) : ""
    };
    if (tmdbId) media.tmdbId = tmdbId;
    if (tmdbData?.poster_path) media.posterPath = TMDB_IMG + tmdbData.poster_path;
    return media;
}

// === 构建剧集暂停卡片（真正显示百分比的地方）===
async function buildShowPlaybackItem(item) {
    const show = item.show;
    const ep = item.episode;
    const tmdbId = Number(show?.ids?.tmdb || 0) || null;
    let tmdbShow = tmdbId ? await fetchTmdbCache(`/tv/${tmdbId}`) : null;

    const progress = normalizeProgress(item.progress);
    const season = Number(ep.season || 0);
    const episode = Number(ep.number || 0);
    const title = tmdbShow?.name || tmdbShow?.original_name || show.title || "未知剧集";
    const se = `S${pad2(season)}E${pad2(episode)}`;
    const episodeTitle = ep.title || `第 ${episode} 集`;

    const media = {
        id: `tv_play_${tmdbId || show?.ids?.trakt}`,
        type: "tmdb",
        mediaType: "tv",
        title: `${title} · ${se}`,
        year: String(ep.first_aired || tmdbShow?.first_air_date || show.first_aired || "").slice(0, 4) || "",
        durationText: `▶ ${progress}%`,
        genreTitle: "恢复播放",
        description: `恢复播放 · ${episodeTitle}\n播放进度：${progress}%\n上次观看：${formatHistoryDateTime(item.paused_at)}`,
        
        // 绝对保留原生跳转参数
        currentSeason: season,
        currentEpisode: episode,
        currentEpisodeName: episodeTitle,
        link: tmdbId ? buildTraktResumeLink({ mediaType: "tv", tmdbId: tmdbId, season: season, episode: episode, progress: progress }) : ""
    };
    if (tmdbId) media.tmdbId = tmdbId;
    if (tmdbShow?.poster_path) media.posterPath = TMDB_IMG + tmdbShow.poster_path;
    return media;
}

// === 构建待看新集卡片 (V3 智能推算) ===
async function buildShowUpNextItem(item) {
    const show = item.show || {};
    const tmdbId = Number(show?.ids?.tmdb || 0) || null;
    const last = getLastWatchedEpisode(item);
    if (!last) return null;

    const tmdbShow = tmdbId ? await fetchTmdbCache(`/tv/${tmdbId}`) : null;
    const aired = getAiredEpisodeCount(show, tmdbShow);
    const next = await inferNextEpisode(last, tmdbId, tmdbShow, show, aired);

    if (!next) return null; // 追平自动隐藏

    const title = tmdbShow?.name || tmdbShow?.original_name || show.title || "未知剧集";
    const targetSeason = next.season;
    const targetEpisode = next.episode;
    const airDateStr = next.air_date || tmdbShow?.first_air_date || show.first_aired || "";
    const se = `S${pad2(targetSeason)}E${pad2(targetEpisode)}`;
    const episodeTitle = next.title || `第 ${targetEpisode} 集`;

    const media = {
        id: `tv_next_${tmdbId || show?.ids?.trakt}`,
        type: "tmdb",
        mediaType: "tv",
        title: `${title} · ${se}`,
        year: String(airDateStr).slice(0, 4) || "",
        releaseDate: airDateStr,
        durationText: "待看新集",
        genreTitle: "待看新集",
        description: `待看新集 · ${episodeTitle}\n播出时间：${airDateStr ? airDateStr : '未知'}\n上次观看：${formatDate(item.last_watched_at)}`,
        currentSeason: targetSeason,
        currentEpisode: targetEpisode,
        currentEpisodeName: episodeTitle,
        link: tmdbId ? buildTraktResumeLink({ mediaType: "tv", tmdbId: tmdbId, season: targetSeason, episode: targetEpisode }) : ""
    };
    if (tmdbId) media.tmdbId = tmdbId;
    if (tmdbShow?.poster_path) media.posterPath = TMDB_IMG + tmdbShow.poster_path;
    return media;
}

// ==========================================
// 推算与辅助计算
// ==========================================
async function inferNextEpisode(last, tmdbId, tmdbShow, show, aired) {
    if (!last) return null;
    const traktAired = Number(aired || show?.aired_episodes || 0);

    if (!tmdbId) {
        if (last.season === 1 && traktAired > last.episode) return { season: last.season, episode: last.episode + 1, title: "", air_date: "" };
        return null;
    }
    try {
        const seasonData = await fetchTmdbSeason(tmdbId, last.season);
        const eps = Array.isArray(seasonData?.episodes) ? seasonData.episodes : [];
        
        const nextInSameSeason = eps.find(ep => Number(ep?.episode_number) === last.episode + 1 && hasAired(ep?.air_date));
        if (nextInSameSeason) return { season: last.season, episode: Number(nextInSameSeason.episode_number), title: nextInSameSeason.name || "", air_date: nextInSameSeason.air_date };

        const lastEpisodeToAir = tmdbShow?.last_episode_to_air;
        if (lastEpisodeToAir && Number(lastEpisodeToAir.season_number) === last.season && Number(lastEpisodeToAir.episode_number) >= last.episode + 1) {
            const matched = eps.find(ep => Number(ep?.episode_number) === last.episode + 1);
            return { season: last.season, episode: last.episode + 1, title: matched?.name || "", air_date: matched?.air_date || "" };
        }

        if (last.season === 1 && traktAired > last.episode) {
            const matched = eps.find(ep => Number(ep?.episode_number) === last.episode + 1);
            return { season: last.season, episode: last.episode + 1, title: matched?.name || "", air_date: matched?.air_date || "" };
        }

        const nextSeasonNo = last.season + 1;
        const hasNextSeason = Array.isArray(tmdbShow?.seasons) && tmdbShow.seasons.some(s => Number(s?.season_number) === nextSeasonNo && Number(s?.episode_count || 0) > 0);
        if (!hasNextSeason) return null;

        const nextSeason = await fetchTmdbSeason(tmdbId, nextSeasonNo);
        const ep1 = Array.isArray(nextSeason?.episodes) ? nextSeason.episodes.find(ep => Number(ep?.episode_number) === 1 && hasAired(ep?.air_date)) : null;
        if (!ep1) return null;

        return { season: nextSeasonNo, episode: 1, title: ep1.name || "", air_date: ep1.air_date || "" };
    } catch (e) {
        if (last.season === 1 && traktAired > last.episode) return { season: last.season, episode: last.episode + 1, title: "", air_date: "" };
        return null;
    }
}

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
        const s = Number(season?.number || 0);
        if (s <= 0) continue;
        const episodes = Array.isArray(season?.episodes) ? season.episodes : [];
        for (const ep of episodes) {
            if (Number(ep?.plays || 0) <= 0) continue;
            const e = Number(ep?.number || 0);
            if (e <= 0) continue;
            if (!best || s > best.season || (s === best.season && e > best.episode)) { best = { season: s, episode: e }; }
        }
    }
    return best;
}

function getAiredEpisodeCount(show, tmdbShow) {
    const traktAired = Number(show?.aired_episodes || 0);
    if (traktAired > 0) return traktAired;
    const tmdbTotal = Number(tmdbShow?.number_of_episodes || 0);
    return tmdbTotal > 0 ? tmdbTotal : 0;
}
function hasAired(dateStr) {
    if (!dateStr) return false;
    const d = new Date(String(dateStr) + "T00:00:00Z");
    if (isNaN(d.getTime())) return false;
    return d.getTime() <= Date.now();
}

// ==========================================
// 原作者完美详情接口魔法
// ==========================================
function buildTraktResumeLink({ mediaType, tmdbId, season = 0, episode = 0, progress = 0 }) {
    return ["traktresume", String(mediaType || ""), String(tmdbId || ""), String(season || 0), String(episode || 0), String(progress || 0)].join("|");
}

function parseTraktResumeLink(link) {
    if (!link || typeof link !== "string") return null;
    const parts = link.split("|");
    if (parts.length < 6 || parts[0] !== "traktresume") return null;
    return { mediaType: parts[1], tmdbId: Number(parts[2] || 0), season: Number(parts[3] || 0), episode: Number(parts[4] || 0), progress: Number(parts[5] || 0) };
}

async function loadDetail(link) {
    const ctx = parseTraktResumeLink(link);
    if (!ctx || !ctx.tmdbId) return null;
    if (ctx.mediaType === "movie") return await loadTraktResumeMovieDetail(ctx, link);
    if (ctx.mediaType === "tv") return await loadTraktResumeTvDetail(ctx, link);
    return null;
}

async function loadTraktResumeMovieDetail(ctx, link) {
    try {
        const d = await fetchTmdbCache(`/movie/${ctx.tmdbId}`);
        return {
            id: `movie.${d.id}`, tmdbId: d.id, type: "tmdb", mediaType: "movie", link: link,
            title: d.title || "未知电影", posterPath: d.poster_path || "", backdropPath: d.backdrop_path || "",
            durationText: ctx.progress > 0 ? `恢复播放 ${normalizeProgress(ctx.progress)}%` : "",
            description: `Trakt 实际播放进度：${normalizeProgress(ctx.progress)}%\n${d.overview || "暂无简介"}`
        };
    } catch (e) { return null; }
}

async function loadTraktResumeTvDetail(ctx, link) {
    try {
        const [show, seasonDetail] = await Promise.all([
            fetchTmdbCache(`/tv/${ctx.tmdbId}`),
            Widget.tmdb.get(`/tv/${ctx.tmdbId}/season/${ctx.season}`, { params: { language: "zh-CN" } })
        ]);

        const rawEpisodes = Array.isArray(seasonDetail?.episodes) ? seasonDetail.episodes : [];
        const orderedEpisodes = [
            ...rawEpisodes.filter(ep => Number(ep.episode_number) === Number(ctx.episode)),
            ...rawEpisodes.filter(ep => Number(ep.episode_number) !== Number(ctx.episode))
        ];

        const episodeItems = orderedEpisodes.map(ep => {
            const epNo = Number(ep.episode_number || 0);
            const isTarget = epNo === Number(ctx.episode);
            return {
                id: `tv.${show.id}`, tmdbId: show.id, type: "tmdb", mediaType: "tv", season: Number(ctx.season), episode: epNo,
                title: `E${epNo}. ${ep.name || `第 ${epNo} 集`}`, duration: Number(ep.runtime || 0),
                durationText: isTarget ? `▶ 继续 ${normalizeProgress(ctx.progress)}%` : "",
                link: buildTraktResumeLink({ mediaType: "tv", tmdbId: show.id, season: Number(ctx.season), episode: epNo, progress: isTarget ? ctx.progress : 0 }),
                backdropPath: ep.still_path || show.backdrop_path || "", posterPath: show.poster_path || ""
            };
        });

        return {
            id: `tv.${show.id}`, tmdbId: show.id, type: "tmdb", mediaType: "tv", link: link,
            season: Number(ctx.season), episode: Number(ctx.episode),
            title: show.name || "未知剧集", posterPath: show.poster_path || "", backdropPath: show.backdrop_path || "",
            durationText: `▶ ${normalizeProgress(ctx.progress)}%`,
            description: `Trakt 实际播放进度：${normalizeProgress(ctx.progress)}%\n${show.overview || ""}`,
            episodeItems: episodeItems
        };
    } catch (e) { return null; }
}

// ==========================================
// 并发工具与 TMDB 缓存
// ==========================================
const tmdbSeasonCache = new Map();
async function fetchTmdbSeason(tmdbId, seasonNo) {
    const key = `${tmdbId}:${seasonNo}`;
    if (tmdbSeasonCache.has(key)) return tmdbSeasonCache.get(key);
    try {
        const promise = Widget.tmdb.get(`/tv/${tmdbId}/season/${seasonNo}`, { params: { language: "zh-CN" } });
        tmdbSeasonCache.set(key, promise);
        const data = await promise;
        return data || null;
    } catch (e) { return null; }
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

async function fetchTmdbCache(path) {
    if (tmdbCache.has(path)) return tmdbCache.get(path);
    try {
        const promise = Widget.tmdb.get(path, { params: { language: "zh-CN" } });
        tmdbCache.set(path, promise);
        const data = await promise;
        return data || null;
    } catch (e) { return null; }
}

function normalizeProgress(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    return Number.isInteger(Math.round(n * 10) / 10) ? String((Math.round(n * 10) / 10).toFixed(0)) : String((Math.round(n * 10) / 10).toFixed(1));
}
function pad2(n) { return Number(n) < 10 ? "0" + n : String(n); }
function safeTime(value) { const t = new Date(value || 0).getTime(); return isNaN(t) ? 0 : t; }
function formatDate(value) { if (!value) return ""; const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/); return match ? match[1] : ""; }
function formatHistoryDateTime(value) {
    if (!value) return "未知时间";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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
            const res = await Widget.http.post(`${TRAKT_API_BASE}/oauth/device/code`, { client_id: oauthClientId }, { headers: { "Content-Type": "application/json" }});
            Widget.storage.set(STORAGE_DEVICE_KEY, JSON.stringify(res.data));
            return [{ id: "code", type: "text", title: `登录码：${res.data.user_code}`, description: `1. 手机打开网址: https://trakt.tv/activate\n2. 输入上方登录码\n3. 返回此处点击"2️⃣ 检查授权"` }];
        } catch(e) { return [{ id: "err", type: "text", title: "获取登录码失败" }]; }
    }

    if (oauthAction === "complete") {
        const device = JSON.parse(Widget.storage.get(STORAGE_DEVICE_KEY) || "{}");
        if (!device.device_code) return [{ id: "err", type: "text", title: "请先生成登录码" }];
        try {
            const res = await Widget.http.post(`${TRAKT_API_BASE}/oauth/device/token`, { code: device.device_code, client_id: oauthClientId, client_secret: oauthClientSecret }, { headers: { "Content-Type": "application/json" }});
            Widget.storage.set(STORAGE_TOKEN_KEY, JSON.stringify({...res.data, created_at: Math.floor(Date.now() / 1000)}));
            Widget.storage.remove(STORAGE_DEVICE_KEY);
            return [{ id: "ok", type: "text", title: "登录成功！", description: "现在可以去打开「继续观看」了" }];
        } catch(e) { return [{ id: "wait", type: "text", title: "等待授权中...", description: "请确保在网页上已点击同意授权，然后再试一次" }]; }
    }
    
    const token = JSON.parse(Widget.storage.get(STORAGE_TOKEN_KEY) || "{}");
    if(token.access_token) return [{ id: "ok", type: "text", title: "Trakt 已登录", description: "已经完美去重并同步官方隐藏列表！" }];
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
