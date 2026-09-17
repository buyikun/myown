/*
 * CapyPlayer Widget - Trakt 继续观看（免Key版 / 自定义显示格式）
 * 显示格式：纯剧名标题 + 季集/观看时间 + 集数进度/下集日期
 */
var WidgetMetadata = {
    id: "trakt_continue_username",
    title: "Trakt 继续观看 免Key版",
    author: "Based on MakkaPakka518 traktkey.js",
    description: "只填 Trakt 用户名，根据公开观看记录推算继续观看",
    version: "1.2.0",
    requiredVersion: "0.0.1",
    globalParams: [
        {
            name: "traktUser",
            label: "Trakt 用户名",
            type: "string",
            defaultValue: ""
        }
    ],
    modules: [
        {
            title: "我的片单",
            functionName: "loadContinueWatching",
            type: "media_list",
            cacheDuration: 300,
            params: [
                {
                    name: "page",
                    label: "页码",
                    type: "page"
                },
                {
                    name: "pageSize",
                    label: "每页数量",
                    type: "enum",
                    defaultValue: "15",
                    enumOptions: [
                        { title: "10", value: "10" },
                        { title: "15", value: "15" },
                        { title: "20", value: "20" }
                    ]
                }
            ]
        }
    ]
};

const INTERNAL_CLIENT_ID =
    "95b59922670c84040db3632c7aac6f33704f6ffe5cbf3113a056e37cb45cb482";
const TRAKT_BASE = "https://api.trakt.tv";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

const TMDB_CONCURRENCY = 3;
const tmdbShowCache = new Map();
const tmdbSeasonCache = new Map();

async function loadContinueWatching(params = {}) {
    const traktUser = String(params.traktUser || "").trim();
    const page = Math.max(1, parseInt(params.page || 1, 10) || 1);
    const pageSize = Math.max(1, parseInt(params.pageSize || 15, 10) || 15);

    if (!traktUser) {
        return [
            {
                id: "err-no-user",
                type: "text",
                title: "请在设置中填写 Trakt 用户名"
            }
        ];
    }

    try {
        const watched = await fetchWatchedShows(traktUser);
        if (!watched.length) {
            return [
                {
                    id: "empty",
                    type: "text",
                    title: "没有读取到观看记录",
                    description: "请检查 Trakt 用户名以及账号隐私设置"
                }
            ];
        }

        watched.sort((a, b) => {
            return safeTime(b?.last_watched_at) - safeTime(a?.last_watched_at);
        });

        const inProgress = watched.filter(item => {
            const watchedCount = countWatchedEpisodes(item);
            if (watchedCount <= 0) return false;
            const aired = Number(item?.show?.aired_episodes || 0);
            if (aired <= 0) return true;
            return watchedCount < aired;
        });

        const start = (page - 1) * pageSize;
        const slice = inProgress.slice(start, start + pageSize);

        if (!slice.length) {
            return page === 1
                ? [{ id: "empty-progress", type: "text", title: "暂无未看完的剧集" }]
                : [];
        }

        const results = await mapWithConcurrency(slice, TMDB_CONCURRENCY, async item => {
            try {
                const media = await buildMediaItem(item);
                return media || buildFallbackItem(item);
            } catch (e) {
                console.warn("构建条目失败:", e?.message || String(e));
                return buildFallbackItem(item);
            }
        });

        const output = results.filter(Boolean);
        if (!output.length) {
            return [
                {
                    id: "err-empty-output",
                    type: "text",
                    title: "片单暂时加载失败",
                    description: "请稍后重试"
                }
            ];
        }

        return output;
    } catch (e) {
        console.error("Trakt 加载失败:", e?.message || String(e));
        return [
            {
                id: "err-load",
                type: "text",
                title: "读取 Trakt 失败",
                description: (e?.message || String(e)) + "\n请稍后重试，并检查用户名和账号隐私设置"
            }
        ];
    }
}

async function fetchWatchedShows(user) {
    const all = [];
    const limit = 100;

    for (let page = 1; page <= 3; page++) {
        const url =
            `${TRAKT_BASE}/users/` +
            `${encodeURIComponent(user)}` +
            `/watched/shows` +
            `?extended=progress` +
            `&page=${page}` +
            `&limit=${limit}`;

        let res;
        try {
            res = await Widget.http.get(url, {
                headers: {
                    "Content-Type": "application/json",
                    "trakt-api-version": "2",
                    "trakt-api-key": INTERNAL_CLIENT_ID
                }
            });
        } catch (e) {
            throw new Error("Trakt 网络请求失败: " + (e?.message || String(e)));
        }

        if (!res) throw new Error("Trakt 返回为空");
        if (res.ok === false) {
            throw new Error("Trakt HTTP " + String(res.status || "unknown"));
        }

        const raw = Array.isArray(res) ? res : res.data;
        const rows = Array.isArray(raw) ? raw : [];
        all.push(...rows);

        if (rows.length < limit) break;
    }

    return all;
}

async function buildMediaItem(item) {
    const show = item?.show || {};
    const tmdbId = Number(show?.ids?.tmdb || 0) || null;
    const last = getLastWatchedEpisode(item);

    if (!last) return null;

    const tmdbShow = tmdbId ? await fetchTmdbShow(tmdbId) : null;
    const next = await inferNextEpisode(last, tmdbId, tmdbShow);
    const watchedCount = countWatchedEpisodes(item);
    const aired = getAiredEpisodeCount(show, tmdbShow);

    // 纯剧名标题，不带季集后缀
    const title =
        tmdbShow?.name ||
        tmdbShow?.original_name ||
        show.title ||
        "未知剧集";
    const year = String(
        show.year ||
        String(tmdbShow?.first_air_date || "").slice(0, 4) ||
        ""
    );

    // 目标集：优先下一集，没有则用最后已看集
    const targetSeason = next?.season ?? last.season;
    const targetEpisode = next?.episode ?? last.episode;
    const se = `S${pad2(targetSeason)}E${pad2(targetEpisode)}`;
    const lastWatchedDate = formatDate(item?.last_watched_at);

    // 第一行：季集号 + 上次观看时间
    const line1 = `${se} · 上次观看：${lastWatchedDate || '未知'}`;

    // 第二行：已看/总集数 + 下一集播出日期
    let line2 = `${watchedCount}/${aired} 集`;
    if (next?.airDate) {
        line2 += ` · 下集：${formatDate(next.airDate)}`;
    } else if (!next) {
        line2 += ` · 暂无下一集`;
    }

    const media = {
        id: String(tmdbId || show?.ids?.trakt || `${title}-${targetSeason}-${targetEpisode}`),
        type: "tmdb",
        mediaType: "tv",
        title: title, // 纯剧名
        year: year,
        releaseDate: year,
        genreTitle: "继续观看",
        description: [line1, line2].join("\n"),
        currentSeason: targetSeason,
        currentEpisode: targetEpisode,
        currentEpisodeName: next?.title || ""
    };

    if (tmdbId) media.tmdbId = tmdbId;
    if (tmdbShow?.poster_path) media.posterUrl = TMDB_IMG + tmdbShow.poster_path;

    return media;
}

function buildFallbackItem(item) {
    const show = item?.show || {};
    const last = getLastWatchedEpisode(item);
    if (!last) return null;

    const watchedCount = countWatchedEpisodes(item);
    const aired = Number(show.aired_episodes || 0);
    const tmdbId = Number(show?.ids?.tmdb || 0) || null;
    const title = show.title || "未知剧集";
    const se = `S${pad2(last.season)}E${pad2(last.episode)}`;
    const lastWatchedDate = formatDate(item?.last_watched_at);

    const line1 = `${se} · 上次观看：${lastWatchedDate || '未知'}`;
    const line2 = `${watchedCount}/${aired} 集 · 暂无下一集`;

    return {
        id: String(tmdbId || show?.ids?.trakt || title),
        type: "tmdb",
        mediaType: "tv",
        title: title, // 纯剧名
        year: String(show.year || ""),
        releaseDate: String(show.year || ""),
        genreTitle: "继续观看",
        description: [line1, line2].join("\n"),
        currentSeason: last.season,
        currentEpisode: last.episode,
        tmdbId: tmdbId || undefined
    };
}

function countWatchedEpisodes(item) {
    let count = 0;
    const seasons = Array.isArray(item?.seasons) ? item.seasons : [];
    for (const season of seasons) {
        if (Number(season?.number || 0) === 0) continue;
        const episodes = Array.isArray(season?.episodes) ? season.episodes : [];
        for (const ep of episodes) {
            if (Number(ep?.plays || 0) > 0) count++;
        }
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
            if (!best || s > best.season || (s === best.season && e > best.episode)) {
                best = { season: s, episode: e };
            }
        }
    }
    return best;
}

async function inferNextEpisode(last, tmdbId, tmdbShow) {
    if (!last || !tmdbId) return null;

    try {
        const seasonData = await fetchTmdbSeason(tmdbId, last.season);
        const eps = Array.isArray(seasonData?.episodes) ? seasonData.episodes : [];

        const nextInSameSeason = eps.find(ep => {
            return Number(ep?.episode_number) === last.episode + 1
                && hasAired(ep?.air_date);
        });

        if (nextInSameSeason) {
            return {
                season: last.season,
                episode: Number(nextInSameSeason.episode_number),
                title: nextInSameSeason.name || "",
                airDate: nextInSameSeason.air_date || ""
            };
        }

        const nextSeasonNo = last.season + 1;
        const hasNextSeason = Array.isArray(tmdbShow?.seasons)
            && tmdbShow.seasons.some(s => {
                return Number(s?.season_number) === nextSeasonNo
                    && Number(s?.episode_count || 0) > 0;
            });

        if (!hasNextSeason) return null;

        const nextSeason = await fetchTmdbSeason(tmdbId, nextSeasonNo);
        const ep1 = Array.isArray(nextSeason?.episodes)
            ? nextSeason.episodes.find(ep => {
                return Number(ep?.episode_number) === 1 && hasAired(ep?.air_date);
            })
            : null;

        if (!ep1) return null;

        return {
            season: nextSeasonNo,
            episode: 1,
            title: ep1.name || "",
            airDate: ep1.air_date || ""
        };
    } catch (e) {
        console.warn("推算下一集失败:", e?.message || String(e));
        return null;
    }
}

async function fetchTmdbShow(tmdbId) {
    const key = String(tmdbId);
    if (tmdbShowCache.has(key)) return tmdbShowCache.get(key);

    try {
        const promise = Widget.tmdb.get(`/tv/${tmdbId}`, {
            params: { language: "zh-CN" }
        });
        tmdbShowCache.set(key, promise);
        const data = await promise;
        tmdbShowCache.set(key, data || null);
        return data || null;
    } catch (e) {
        tmdbShowCache.delete(key);
        console.warn(`TMDB 剧集详情失败 ${tmdbId}:`, e?.message || String(e));
        return null;
    }
}

async function fetchTmdbSeason(tmdbId, seasonNo) {
    const key = `${tmdbId}:${seasonNo}`;
    if (tmdbSeasonCache.has(key)) return tmdbSeasonCache.get(key);

    try {
        const promise = Widget.tmdb.get(`/tv/${tmdbId}/season/${seasonNo}`, {
            params: { language: "zh-CN" }
        });
        tmdbSeasonCache.set(key, promise);
        const data = await promise;
        tmdbSeasonCache.set(key, data || null);
        return data || null;
    } catch (e) {
        tmdbSeasonCache.delete(key);
        console.warn(`TMDB 季详情失败 ${tmdbId} S${seasonNo}:`, e?.message || String(e));
        return null;
    }
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
            try {
                results[index] = await worker(list[index], index);
            } catch (e) {
                console.warn("并发任务失败:", e?.message || String(e));
                results[index] = null;
            }
        }
    });

    await Promise.all(runners);
    return results;
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

function pad2(n) {
    n = Number(n || 0);
    return n < 10 ? "0" + n : String(n);
}

function formatPercent(n) {
    n = Number(n || 0);
    const one = Math.round(n * 10) / 10;
    return Number.isInteger(one) ? String(one) : one.toFixed(1);
}
