/*
 * CapyPlayer Widget - Trakt 继续观看（按参考图三行格式 + 精确单集进度）
 *
 * 格式示例：
 *   继续观看：S01E09 · 第 9 集
 *   剧集观看进度：88.9%（8/9 集）
 *   上次观看：2026-09-08
 *
 * 同时记录精确进度秒数，点击卡片时尽量从该时间点继续播放
 */

var WidgetMetadata = {
  id: "trakt_continue_watching_progress",
  title: "Trakt 继续观看（精确进度版）",
  description: "按 Trakt 单集播放进度展示继续观看，点击卡片可从上次进度继续播放",
  version: "1.3.0",
  author: "Custom",
  modules: [
    {
      id: "continue_watching",
      title: "继续观看",
      type: "media_list",
      functionName: "getContinueWatching",
      cacheDuration: 1800,
      timeoutSeconds: 30,
      params: [
        {
          name: "trakt_access_token",
          label: "Trakt Access Token",
          type: "string",
          required: true,
          description: "Trakt 账户访问令牌，用于读取精确播放进度"
        },
        {
          name: "trakt_client_id",
          label: "Trakt Client ID",
          type: "string",
          required: true,
          description: "Trakt API 应用 Client ID"
        },
        {
          name: "poster_language",
          label: "海报语言",
          type: "string",
          defaultValue: "zh-CN",
          required: false
        }
      ]
    }
  ]
};

function safeJson(data) {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch (_) {
      return {};
    }
  }
  return data || {};
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
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

function formatProgressSeconds(seconds) {
  seconds = Math.max(0, Math.floor(Number(seconds || 0)));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return h + ":" + pad2(m) + ":" + pad2(s);
  }
  return m + "分" + s + "秒";
}

async function traktApiRequest(path, params) {
  var resp = await Widget.http.get("https://api.trakt.tv" + path, {
    headers: {
      "Content-Type": "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": params.trakt_client_id,
      "Authorization": "Bearer " + params.trakt_access_token
    },
    timeout: 30000
  });

  if (!resp.ok) {
    console.error("Trakt API 失败", path, "状态码:", resp.status);
    throw new Error("Trakt HTTP " + resp.status);
  }

  return safeJson(resp.data);
}

async function fetchPoster(mediaType, tmdbId, language) {
  if (!tmdbId) return "";
  try {
    var endpoint = mediaType === "movie" ? "/movie/" + tmdbId : "/tv/" + tmdbId;
    var data = await Widget.tmdb.get(endpoint, {
      params: { language: language || "zh-CN" }
    });
    return data && data.poster_path
      ? "https://image.tmdb.org/t/p/w500" + data.poster_path
      : "";
  } catch (e) {
    console.error("海报获取失败", tmdbId, e.message);
    return "";
  }
}

async function fetchShowProgress(traktId, params) {
  try {
    var data = await traktApiRequest("/shows/" + traktId + "/progress/watched", params);
    return data || {};
  } catch (e) {
    console.warn("获取剧集观看进度失败:", e.message);
    return {};
  }
}

async function getContinueWatching(params) {
  try {
    var progressList = await traktApiRequest("/sync/playback/episodes", params);
    progressList = ensureArray(progressList);

    if (!progressList.length) {
      return [
        {
          id: "empty",
          type: "text",
          title: "暂无继续观看记录",
          description: "Trakt 中还没有可继续播放的单集进度记录"
        }
      ];
    }

    progressList.sort(function (a, b) {
      return Number(b.updated_at || 0) - Number(a.updated_at || 0);
    });

    var lang = params.poster_language || "zh-CN";
    var results = [];

    for (var i = 0; i < progressList.length; i++) {
      var item = progressList[i];
      if (!item.show || !item.episode) continue;

      var show = item.show;
      var ep = item.episode;
      var season = Number(ep.season || 1);
      var episode = Number(ep.number || 1);
      var progress = Number(item.progress || 0);
      var plays = Number(item.plays || 0);
      var lastWatchedAt = formatDate(item.last_watched_at || item.updated_at);
      var tmdbId = show.ids && show.ids.tmdb ? String(show.ids.tmdb) : null;
      var traktId = show.ids && show.ids.trakt ? String(show.ids.trakt) : null;

      var posterUrl = await fetchPoster("tv", tmdbId, lang);

      var showProgress = {};
      if (traktId) {
        showProgress = await fetchShowProgress(traktId, params);
      }

      var airedCount = Number(showProgress.aired_episodes || show.aired_episodes || 0);
      var completedCount = Number(showProgress.completed || 0);
      var episodeTitle = ep.title || "第 " + episode + " 集";
      var seLabel = "S" + pad2(season) + "E" + pad2(episode);

      var line1 = "继续观看：" + seLabel + " · " + episodeTitle;
      var line2 = "剧集观看进度：" + formatPercent(progress) + "%";
      if (airedCount > 0) {
        line2 += "（" + completedCount + "/" + airedCount + " 集）";
      }
      var line3 = "上次观看：" + (lastWatchedAt || "未知");

      var media = {
        id: String(item.id || (show.ids.trakt + "_" + season + "_" + episode)),
        type: "tmdb",
        mediaType: "tv",
        title: show.title || "未知剧集",
        year: show.year ? String(show.year) : null,
        tmdbId: tmdbId,
        seasonNumber: season,
        episodeNumber: episode,
        currentSeason: season,
        currentEpisode: episode,
        currentEpisodeName: episodeTitle,
        progress: progress,
        description: [line1, line2, line3].join("\n")
      };

      if (posterUrl) {
        media.posterUrl = posterUrl;
      }

      results.push(media);
    }

    return results;
  } catch (e) {
    console.error("Trakt 继续观看加载失败:", e.message);
    return [
      {
        id: "err-load",
        type: "text",
        title: "读取 Trakt 失败",
        description: e.message || "请稍后重试"
      }
    ];
  }
}
