/*
 * CapyPlayer Widget - Trakt 继续观看 (纯净同步版)
 *
 * 核心优化：
 * 1. 100% 官方同步：彻底剥离历史推算逻辑，仅调取真实的 /sync/playback 接口。
 * 2. 纯净列表：彻底消灭由于排序导致的“幽灵老剧”，仅显示正在看一半的电影和剧集。
 * 3. 极速加载：删减大量冗余推算代码，配合高并发与防缓存，实现秒开秒同步。
 * 4. 完美跳转：保留原生 currentSeason/Episode 字段与 link 魔法。
 */

WidgetMetadata = {
    id: "trakt_continue_oauth_pure",
    title: "Trakt 恢复播放 (纯净版)",
    author: "MakkaPakka & Pure Sync",
    description: "100% 同步 Trakt 官方继续观看列表，仅显示真实暂停进度，告别老剧干扰。",
    version: "5.0.0",
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
            cacheDuration: 0, 
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
// 1. 核心：纯净真实继续观看逻辑
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

        // 彻底砍掉 /sync/watched/shows，仅保留真实的暂停进度接口！
        const [playbackMovies, playbackEpisodes] = await Promise.all([
            fetchTraktData(`${TRAKT_API_BASE}/sync/playback/movies?extended=full&limit=40`, accessToken, oauthClientId),
            fetchTraktData(`${TRAKT_API_BASE}/sync/playback/episodes?extended=full&limit=40`, accessToken, oauthClientId)
        ]);

        let combinedItems = [];

        playbackMovies.forEach(item => {
            const p = Number(item?.progress);
            if (Number.isFinite(p) && p > 0 && p < 100) combinedItems.push({ ...item, _type: "movie" });
        });

        playbackEpisodes.forEach(item => {
            const p = Number(item?.progress);
            if (Number.isFinite(p) && p > 0 && p < 100) combinedItems.push({ ...item, _type: "show" });
        });

        if (!combinedItems.length) {
            return currentPage === 1 ? [{ id: "empty", type: "text", title: "暂无暂停的影视", description: "完美同步 Trakt，目前没有产生暂停进度的电影或剧集。" }] : [];
        }

        // 恢复按“最近暂停时间”排序，确保刚刚看的永远在第一个
        combinedItems.sort((a, b) => safeTime(b.paused_at) - safeTime(a.paused_at));

        const start = (currentPage - 1) * limit;
        const pageItems = combinedItems.slice(start, start + limit);

        const results = await mapWithConcurrency(pageItems, TMDB_CONCURRENCY, async (item) => {
            try {
                if (item._type === "movie") return await buildMoviePlaybackItem(item);
                if (item._type === "show") return await buildShowPlaybackItem(item);
            } catch (e) { return null; }
        });

        return results.filter(Boolean);

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
                "Cache-Control": "no-cache, no-store, must-revalidate",
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

// === 构建剧集暂停卡片 ===
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
        year: String(ep.first_aired || tmdbShow?.first_air_date || "").slice(0, 4) || "",
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

// ==========================================
// 2. 详情接口：原作者完美跳转魔法
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
        
        // 神奇逻辑：把要看的那一集强制置顶排列！
        const orderedEpisodes = [
            ...rawEpisodes.filter(ep => Number(ep.episode_number) === Number(ctx.episode)),
            ...rawEpisodes.filter(ep => Number(ep.episode_number) !== Number(ctx.episode))
        ];

        const episodeItems = orderedEpisodes.map(ep => {
            const epNo = Number(ep.episode_number || 0);
            const isTarget = epNo === Number(ctx.episode);
            const epName = ep.name || `第 ${epNo} 集`;

            return {
                id: `tv.${show.id}`, tmdbId: show.id, type: "tmdb", mediaType: "tv", season: Number(ctx.season), episode: epNo,
                title: `E${epNo}. ${epName}`, duration: Number(ep.runtime || 0),
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
// 3. 并发工具与缓存
// ==========================================
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
function formatHistoryDateTime(value) {
    if (!value) return "未知时间";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ==========================================
// 4. OAuth 认证流
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
    if(token.access_token) return [{ id: "ok", type: "text", title: "Trakt 已登录", description: "享受极致纯净的同步体验吧！" }];
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
