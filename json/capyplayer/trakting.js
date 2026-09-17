/*
 * CapyPlayer Widget - Trakt 继续观看（全能智能融合版）
 *
 * 融合特性：
 * 1. 借鉴 V3 的“智能净空”逻辑：剧集已追平最新集自动隐藏，有新集播出自动出现！
 * 2. OAuth 真实进度：电影和剧集支持真实的断点续播百分比。
 * 3. 完美跳转：保留原生 currentSeason/Episode 字段直达集数。
 * 4. 极速实时：加入时间戳与防缓存头，多设备秒级同步，高并发加载。
 */

WidgetMetadata = {
    id: "trakt_continue_oauth_v3_fusion",
    title: "Trakt 智能追剧 (融合版)",
    author: "MakkaPakka & Fusion",
    description: "融合 V3 追平隐藏逻辑与 OAuth 真实电影进度，极速加载，完美跳转。",
    version: "4.0.0",
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
            cacheDuration: 0, // 强制实时
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
const TMDB_CONCURRENCY = 15; // 极速并发拉满

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

        // 获取真实的进度（包含暂停的电影，和观看历史的剧集以便推算下一集）
        const [playbackMovies, watchedShows] = await Promise.all([
            fetchTraktData(`${TRAKT_API_BASE}/sync/playback/movies?extended=full&limit=40`, accessToken, oauthClientId),
            fetchTraktData(`${TRAKT_API_BASE}/sync/watched/shows?extended=progress&limit=100`, accessToken, oauthClientId) // 获取剧集观看历史用于推算新集
        ]);

        // 电影：只保留看了一半的真实暂停记录
        let validMovies = playbackMovies.filter(item => {
            const p = Number(item?.progress);
            return Number.isFinite(p) && p > 0 && p < 100;
        }).map(item => ({ ...item, _type: "movie", _sortTime: safeTime(item.paused_at) }));

        // 剧集：应用 V3 逻辑，过滤掉已追平的，只保留有下一集的
        let validShows = [];
        for (let item of watchedShows) {
            const watchedCount = countWatchedEpisodes(item);
            if (watchedCount <= 0) continue;
            validShows.push({ ...item, _type: "show", _sortTime: safeTime(item.last_watched_at) });
        }

        // 混合电影和剧集，按时间倒序
        let combined = [...validMovies, ...validShows].sort((a, b) => b._sortTime - a._sortTime);

        const start = (currentPage - 1) * limit;
        const pageItems = combined.slice(start, start + limit);

        // 并发构建卡片
        const results = await mapWithConcurrency(pageItems, TMDB_CONCURRENCY, async (item) => {
            try {
                if (item._type === "movie") return await buildMovieItem(item);
                if (item._type === "show") return await buildShowItem(item);
            } catch (e) { return null; }
        });

        // 【关键借鉴 V3】：去除因为没有下一集而返回 null 的剧集！
        const finalOutput = results.filter(Boolean);

        if (!finalOutput.length) {
            return currentPage === 1 ? [{ id: "empty", type: "text", title: "暂无可观看内容", description: "电影已看完，剧集已全部追到最新进度。等新集播出后会自动出现！" }] : [];
        }

        return finalOutput;
    } catch (e) {
        return [{ id: "err", type: "text", title: "加载失败", description: String(e?.message || e) }];
    }
}

// 统一带防缓存的请求
async function fetchTraktData(urlBase, accessToken, clientId) {
    try {
        const url = `${urlBase}&_t=${Date.now()}&_r=${Math.random()}`;
        const res = await Widget.http.get(url, {
            headers: {
                "Content-Type": "application/json",
                "trakt-api-version": "2",
                "trakt-api-key": clientId,
                "Authorization": `Bearer ${accessToken}`,
                "Cache-Control": "no-cache, no-store, must-revalidate"
            }
        });
        return Array.isArray(res?.data) ? res.data : [];
    } catch (e) { return []; }
}

// === 构建电影卡片 ===
async function buildMovieItem(item) {
    const movie = item.movie;
    const tmdbId = Number(movie?.ids?.tmdb || 0) || null;
    let tmdbData = tmdbId ? await fetchTmdbCache(`/movie/${tmdbId}`) : null;

    const progress = normalizeProgress(item.progress);
    const title = tmdbData?.title || movie.title || "未知电影";
    const year = String(movie.year || String(tmdbData?.release_date || "").slice(0, 4) || "");

    const media = {
        id: `movie_${tmdbId || movie?.ids?.trakt}`,
        type: "tmdb",
        mediaType: "movie",
        title: title,
        year: year,
        releaseDate: year,
        genreTitle: "继续观看电影",
        description: `播放进度：${progress}%\n上次观看：${formatHistoryDateTime(item.paused_at)}`
    };
    if (tmdbId) media.tmdbId = tmdbId;
    if (tmdbData?.poster_path) media.posterPath = TMDB_IMG + tmdbData.poster_path;
    return media;
}

// === 构建剧集卡片 (融合 V3 推算逻辑) ===
async function buildShowItem(item) {
    const show = item.show || {};
    const tmdbId = Number(show?.ids?.tmdb || 0) || null;
    const last = getLastWatchedEpisode(item);
    if (!last) return null;

    const tmdbShow = tmdbId ? await fetchTmdbCache(`/tv/${tmdbId}`) : null;
    const aired = getAiredEpisodeCount(show, tmdbShow);
    
    // 【借鉴点 1 & 2】：使用 V3 的 inferNextEpisode，推算已播出的下一集
    const next = await inferNextEpisode(last, tmdbId, tmdbShow, show, aired);

    // 【借鉴点 3】：V3 灵魂逻辑！如果推算不出下一集（已追平），直接返回 null 隐藏该卡片！
    if (!next) return null; 

    const title = tmdbShow?.name || tmdbShow?.original_name || show.title || "未知剧集";
    const year = String(show.year || String(tmdbShow?.first_air_date || "").slice(0, 4) || "");
    const targetSeason = next.season;
    const targetEpisode = next.episode;
    const se = `S${pad2(targetSeason)}E${pad2(targetEpisode)}`;
    const episodeTitle = next.title || `第 ${targetEpisode} 集`;

    const descriptionLines = [
        `待看新集 · ${se} · ${episodeTitle}`,
        `上次观看：${formatDate(item.last_watched_at)}`
    ];

    const media = {
        id: `tv_${tmdbId || show?.ids?.trakt}`,
        type: "tmdb",
        mediaType: "tv",
        title: `${title} · ${se}`,
        year: year,
        releaseDate: year,
        genreTitle: "待看新集",
        description: descriptionLines.join("\n"),
        
        // 保留跳转灵魂参数
        currentSeason: targetSeason,
        currentEpisode: targetEpisode,
        currentEpisodeName: episodeTitle
    };
    if (tmdbId) media.tmdbId = tmdbId;
    if (tmdbShow?.poster_path) media.posterPath = TMDB_IMG + tmdbShow.poster_path;
    return media;
}

// ==========================================
// V3 严谨推算下一集逻辑 (完全移植)
// ==========================================
async function inferNextEpisode(last, tmdbId, tmdbShow, show, aired) {
    if (!last) return null;
    const traktAired = Number(aired || show?.aired_episodes || 0);

    if (!tmdbId) {
        if (last.season === 1 && traktAired > last.episode) return { season: last.season, episode: last.episode + 1, title: "" };
        return null;
    }
    try {
        const seasonData = await fetchTmdbSeason(tmdbId, last.season);
        const eps = Array.isArray(seasonData?.episodes) ? seasonData.episodes : [];
        
        const nextInSameSeason = eps.find(ep => Number(ep?.episode_number) === last.episode + 1 && hasAired(ep?.air_date));
        if (nextInSameSeason) return { season: last.season, episode: Number(nextInSameSeason.episode_number), title: nextInSameSeason.name || "" };

        const lastEpisodeToAir = tmdbShow?.last_episode_to_air;
        if (lastEpisodeToAir && Number(lastEpisodeToAir.season_number) === last.season && Number(lastEpisodeToAir.episode_number) >= last.episode + 1) {
            const matched = eps.find(ep => Number(ep?.episode_number) === last.episode + 1);
            return { season: last.season, episode: last.episode + 1, title: matched?.name || "" };
        }

        if (last.season === 1 && traktAired > last.episode) {
            const matched = eps.find(ep => Number(ep?.episode_number) === last.episode + 1);
            return { season: last.season, episode: last.episode + 1, title: matched?.name || "" };
        }

        const nextSeasonNo = last.season + 1;
        const hasNextSeason = Array.isArray(tmdbShow?.seasons) && tmdbShow.seasons.some(s => Number(s?.season_number) === nextSeasonNo && Number(s?.episode_count || 0) > 0);
        if (!hasNextSeason) return null;

        const nextSeason = await fetchTmdbSeason(tmdbId, nextSeasonNo);
        const ep1 = Array.isArray(nextSeason?.episodes) ? nextSeason.episodes.find(ep => Number(ep?.episode_number) === 1 && hasAired(ep?.air_date)) : null;
        if (!ep1) return null;

        return { season: nextSeasonNo, episode: 1, title: ep1.name || "" };
    } catch (e) {
        if (last.season === 1 && traktAired > last.episode) return { season: last.season, episode: last.episode + 1, title: "" };
        return null;
    }
}

// 辅助计算
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
    if(token.access_token) return [{ id: "ok", type: "text", title: "Trakt 已登录", description: "享受极致速度与完美跳转体验吧！" }];
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
