/*
 * CapyPlayer Widget - Trakt 继续观看（免授权稳定版）
 * 只填用户名，三行显示格式，稳定不报错
 */

var WidgetMetadata = {
  id: "trakt_continue_stable",
  title: "Trakt 继续观看（免Key版）",
  description: "仅需Trakt用户名，稳定读取公开观看记录",
  version: "1.2.0",
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
      title: "继续观看",
      functionName: "loadContinueWatching",
      type: "media_list",
      cacheDuration: 300,
      params: [
        { name: "page", label: "页码", type: "page" },
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

const INTERNAL_CLIENT_ID = "95b59922670c84040db3632c7aac6f33704f6ffe5cbf3113a056e37cb45cb482";
const TRAKT_BASE = "https://api.trakt.tv";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const TMDB_CONCURRENCY = 3;
const tmdbShowCache = new Map();

function pad2(n) {
  n = Number(n || 0);
  return n < 10 ? "0" + n : String(n);
}

function formatPercent(n) {
  n = Number(n || 0);
  const one = Math.round(n * 10) / 10;
  return Number.isInteger(one) ? String(one) : one.toFixed(1);
}

function formatDate(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

async function mapWithConcurrency(items, concurrency, worker) {
  const list = ensureArray(items);
  if (!list.length) return [];
  const results = new Array(list.length);
  let cursor = 0;
  const runnerCount = Math.min(Math.max(1, concurrency), list.length);
  const runners = new Array(runnerCount).fill(0).map(async () => {
    while (true) {
      const index = cursor++;
      if (index >= list.length) return;
      try { results[index] = await worker(list[index], index); }
      catch (e) { console.warn("任务失败:", e.message); results[index] = null; }
    }
  });
  await Promise.all(runners);
  return results;
}

async function fetchWatchedShows(user) {
  const all = [];
  const limit = 100;
  for (let page = 1; page <= 3; page++) {
    const url = `${TRAKT_BASE}/users/${encodeURIComponent(user)}/watched/shows?extended=progress&page=${page}&limit=${limit}`;
    const resp = await Widget.http.get(url, {
      headers: {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": INTERNAL_CLIENT_ID
      }
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status + " - 请检查用户名是否正确、账号是否公开");
    const rows = ensureArray(resp.data);
    all.push(...rows);
    if (rows.length < limit) break;
  }
  return all;
}

function getLastWatchedEpisode(item) {
  let best = null;
  for (const season of ensureArray(item.seasons)) {
    const s = Number(season.number || 0);
    if (s <= 0) continue;
    for (const ep of ensureArray(season.episodes)) {
      if (Number(ep.plays || 0) <= 0) continue;
      const e = Number(ep.number || 0);
      if (!best || s > best.season || (s === best.season && e > best.episode)) {
        best = { season: s, episode: e };
      }
    }
  }
  return best;
}

function countWatchedEpisodes(item) {
  let count = 0;
  for (const season of ensureArray(item.seasons)) {
    if (Number(season.number || 0) === 0) continue;
    for (const ep of ensureArray(season.episodes)) {
      if (Number(ep.plays || 0) > 0) count++;
    }
  }
  return count;
}

async function fetchTmdbShow(tmdbId) {
  const key = String(tmdbId);
  if (tmdbShowCache.has(key)) return tmdbShowCache.get(key);
  try {
    const promise = Widget.tmdb.get(`/tv/${tmdbId}`, { params: { language: "zh-CN" } });
    tmdbShowCache.set(key, promise);
    const data = await promise;
    tmdbShowCache.set(key, data || null);
    return data || null;
  } catch (e) {
    tmdbShowCache.delete(key);
    return null;
  }
}

async function buildMediaItem(item) {
  const show = item.show || {};
  const last = getLastWatchedEpisode(item);
  if (!last) return null;

  const tmdbId = show.ids?.tmdb ? String(show.ids.tmdb) : null;
  const tmdbShow = tmdbId ? await fetchTmdbShow(tmdbId) : null;
  const watchedCount = countWatchedEpisodes(item);
  const aired = Number(show.aired_episodes || tmdbShow?.number_of_episodes || 0);
  const pct = aired > 0 ? Math.min(100, watchedCount / aired * 100) : 0;
  const title = tmdbShow?.name || show.title || "未知剧集";
  const lastWatched = formatDate(item.last_watched_at);
  const seLabel = `S${pad2(last.season)}E${pad2(last.episode)}`;
  const epTitle = `第 ${last.episode} 集`;

  // 三行标准格式
  const line1 = `继续观看：${seLabel} · ${epTitle}`;
  const line2 = `剧集观看进度：${formatPercent(pct)}%（${watchedCount}/${aired} 集）`;
  const line3 = `上次观看：${lastWatched || "未知"}`;

  return {
    id: String(tmdbId || show.ids?.trakt || title),
    type: "tmdb",
    mediaType: "tv",
    title: title,
    year: show.year ? String(show.year) : null,
    tmdbId: tmdbId,
    currentSeason: last.season,
    currentEpisode: last.episode,
    posterUrl: tmdbShow?.poster_path ? TMDB_IMG + tmdbShow.poster_path : "",
    description: [line1, line2, line3].join("\n")
  };
}

async function loadContinueWatching(params = {}) {
  const user = String(params.traktUser || "").trim();
  if (!user) {
    return [{ id: "tip", type: "text", title: "请先填写 Trakt 用户名" }];
  }

  try {
    const watched = await fetchWatchedShows(user);
    if (!watched.length) {
      return [{ id: "empty", type: "text", title: "暂无观看记录", description: "请检查用户名和账号隐私设置" }];
    }

    watched.sort((a, b) => new Date(b.last_watched_at || 0) - new Date(a.last_watched_at || 0));

    const inProgress = watched.filter(item => {
      const watchedCount = countWatchedEpisodes(item);
      const aired = Number(item.show?.aired_episodes || 0);
      return watchedCount > 0 && (aired <= 0 || watchedCount < aired);
    });

    const page = Math.max(1, parseInt(params.page || 1, 10) || 1);
    const pageSize = Math.max(1, parseInt(params.pageSize || 15, 10) || 15);
    const start = (page - 1) * pageSize;
    const slice = inProgress.slice(start, start + pageSize);

    if (!slice.length) return page === 1 ? [{ id: "done", type: "text", title: "所有剧集都已看完" }] : [];

    const results = await mapWithConcurrency(slice, TMDB_CONCURRENCY, buildMediaItem);
    return results.filter(Boolean);
  } catch (e) {
    console.error("加载失败:", e.message);
    return [{
      id: "error",
      type: "text",
      title: "读取失败",
      description: e.message || "请稍后重试"
    }];
  }
}
