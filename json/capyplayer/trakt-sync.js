var WidgetMetadata = {
  id: "trakt_continue_watching",
  title: "Trakt 继续观看",
  description: "同步 Trakt 播放进度，首页展示继续观看列表，点击搜索全量片源",
  version: "1.0.0",
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
          description: "Trakt 账户访问令牌"
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

async function getContinueWatching(params) {
  try {
    var [moviePlayback, episodePlayback] = await Promise.all([
      traktApiRequest("/sync/playback/movies", params),
      traktApiRequest("/sync/playback/episodes", params)
    ]);

    var mediaList = [];

    ensureArray(moviePlayback).forEach(function (item) {
      if (!item.movie) return;
      var movie = item.movie;
      mediaList.push({
        rawType: "movie",
        id: String(movie.ids.trakt || item.id),
        title: movie.title || "未知电影",
        year: movie.year ? String(movie.year) : null,
        tmdbId: movie.ids.tmdb ? String(movie.ids.tmdb) : null,
        imdbId: movie.ids.imdb || null,
        progress: item.progress || 0,
        mediaType: "movie"
      });
    });

    ensureArray(episodePlayback).forEach(function (item) {
      if (!item.show || !item.episode) return;
      var show = item.show;
      var ep = item.episode;
      var season = ep.season || 1;
      var episode = ep.number || 1;
      var displayTitle = show.title + " · S" + season + "E" + episode;

      mediaList.push({
        rawType: "episode",
        id: String(item.id || (show.ids.trakt + "_s" + season + "e" + episode)),
        title: displayTitle,
        showTitle: show.title,
        year: show.year ? String(show.year) : null,
        tmdbId: show.ids.tmdb ? String(show.ids.tmdb) : null,
        seasonNumber: season,
        episodeNumber: episode,
        episodeTitle: ep.title || "",
        progress: item.progress || 0,
        mediaType: "tv"
      });
    });

    var lang = params.poster_language || "zh-CN";
    var result = await Promise.all(
      mediaList.map(async function (item) {
        var posterUrl = await fetchPoster(item.mediaType, item.tmdbId, lang);
        var progressText = "已播放 " + item.progress.toFixed(1) + "%";
        var desc = item.rawType === "episode" && item.episodeTitle
          ? item.episodeTitle + " · " + progressText
          : progressText;

        return {
          id: item.id,
          title: item.title,
          mediaType: item.mediaType,
          posterUrl: posterUrl,
          description: desc,
          year: item.year,
          tmdbId: item.tmdbId,
          type: "tmdb",
          progress: item.progress
        };
      })
    );

    return result;
  } catch (e) {
    console.error("Trakt 列表加载失败:", e.message);
    return [];
  }
}
