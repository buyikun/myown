const { body, headers, method, url } = $request;
const { latestHistoryEpisodeOnly, commentTranslationEnabled, backendBaseUrl } = $argument;

let obj = {};
if (body) {
  try {
    obj = JSON.parse(body);
  } catch {}
}

// 播放器定义（按你提供的官方 SenPlayer URL Scheme 修正）
const PLAYERS = {
  infuse: { name: "Infuse", scheme: "infuse://x-callback-url/play?tmdb=" },
  eplayerx: { name: "EplayerX", scheme: "eplayerx://play?tmdb=" },
  forward: { name: "Forward", scheme: "forward://play?tmdb=" },
  senplayer: { name: "SenPlayer", scheme: "senplayer://x-callback-url/play?tmdb=" }
};

const CACHE_KEY_PREFIX = "trakt_trans_";
const CACHE_TTL = 7 * 24 * 3600 * 1000;

function getCache(key) {
  const cached = $persistentStore.read(CACHE_KEY_PREFIX + key);
  if (!cached) return null;
  try {
    const { data, expire } = JSON.parse(cached);
    if (Date.now() > expire) {
      $persistentStore.write(null, CACHE_KEY_PREFIX + key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  $persistentStore.write(
    JSON.stringify({ data, expire: Date.now() + CACHE_TTL }),
    CACHE_KEY_PREFIX + key
  );
}

async function translateText(text) {
  if (!text) return text;
  const cacheKey = text;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  try {
    const res = await $fetch(`${backendBaseUrl}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const result = res.data?.result || text;
    setCache(cacheKey, result);
    return result;
  } catch {
    return text;
  }
}

async function translateComments(comments) {
  if (!commentTranslationEnabled || !comments) return;
  for (const c of comments) {
    if (c.comment) c.comment = await translateText(c.comment);
    if (c.replies) await translateComments(c.replies);
  }
}

// 注入播放器到 Trakt watchnow
function patchWatchNow(data) {
  if (!data || !data.length) return;
  for (const item of data) {
    const tmdb = item.ids?.tmdb;
    if (!tmdb) continue;

    const newLinks = [];
    for (const key of Object.keys(PLAYERS)) {
      const p = PLAYERS[key];
      let link = p.scheme + tmdb;
      if (item.type === "episode" && item.season && item.number) {
        link += `&season=${item.season}&episode=${item.number}`;
      }
      newLinks.push({
        name: p.name,
        icon: "",
        url: link,
        premium: false,
        free: true,
        source: key
      });
    }

    item.links = [...(item.links || []), ...newLinks];
  }
}

// 注入 Sofa Time / TMDB 提供商
function patchProviders(data) {
  if (!data?.results) return;
  for (const id of Object.keys(data.results)) {
    const item = data.results[id];
    const tmdb = parseInt(id);
    if (!tmdb) continue;

    const newLinks = [];
    for (const key of Object.keys(PLAYERS)) {
      const p = PLAYERS[key];
      newLinks.push({
        display_name: p.name,
        direct_url: p.scheme + tmdb,
        icon_url: "",
        platform: "ios"
      });
    }

    item.providers = [...(item.providers || []), ...newLinks];
  }
}

// 注入 Sofa Time 详情
function patchSofaStreaming(data) {
  if (!data) return;
  const tmdb = data.tmdb_id;
  if (!tmdb) return;

  const newLinks = [];
  for (const key of Object.keys(PLAYERS)) {
    const p = PLAYERS[key];
    newLinks.push({
      name: p.name,
      url: p.scheme + tmdb,
      icon: "",
      web_url: null
    });
  }

  data.streaming = [...(data.streaming || []), ...newLinks];
}

function patchSofaCountries(data) {
  if (!data?.services) return;
  for (const key of Object.keys(PLAYERS)) {
    const p = PLAYERS[key];
    data.services[p.name] = {
      id: p.name,
      name: p.name,
      icon: "",
      home_page: ""
    };
  }
}

// 历史剧集只保留最新一集
function filterLatestEpisodes(items) {
  if (!latestHistoryEpisodeOnly || !items || !items.length) return items;
  const map = new Map();
  for (const item of items) {
    const sid = item.show?.ids?.trakt;
    if (!sid) {
      map.set(Math.random(), item);
      continue;
    }
    const exist = map.get(sid);
    if (!exist) {
      map.set(sid, item);
    } else {
      const currSeason = item.season || 0;
      const currEp = item.number || 0;
      const oldSeason = exist.season || 0;
      const oldEp = exist.number || 0;
      if (currSeason > oldSeason || (currSeason === oldSeason && currEp > oldEp)) {
        map.set(sid, item);
      }
    }
  }
  return Array.from(map.values());
}

// 请求条数放大到 1000
function increaseLimit(uri) {
  if (!latestHistoryEpisodeOnly) return uri;
  const u = new URL(uri);
  u.searchParams.set("limit", "1000");
  return u.toString();
}

// 优先简体中文翻译
function prioritizeSimplifiedChinese(trans) {
  if (!trans) return trans;
  const cn = trans.filter(t => t.country === "CN" && t.language === "zh");
  if (cn.length) return cn;
  const tw = trans.filter(t => t.country === "TW" && t.language === "zh");
  if (tw.length) return tw;
  return trans;
}

async function process() {
  if (method === "GET") {
    if (url.includes("/sync/history/episodes") || /\/users\/[^/]+\/history\/episodes/.test(url)) {
      $done({ url: increaseLimit(url) });
      return;
    }
  }

  if (method === "RESPONSE") {
    if (/\/history\/episodes($|\?)/.test(url)) {
      obj = filterLatestEpisodes(obj);
      $done({ body: JSON.stringify(obj) });
      return;
    }

    if (/\/translations\/zh$/.test(url)) {
      obj = prioritizeSimplifiedChinese(obj);
      $done({ body: JSON.stringify(obj) });
      return;
    }

    if (/\/comments|\/replies/.test(url)) {
      await translateComments(obj);
      $done({ body: JSON.stringify(obj) });
      return;
    }

    if (/\/watchnow($|\?)/.test(url)) {
      patchWatchNow(obj);
      $done({ body: JSON.stringify(obj) });
      return;
    }

    if (/watch\/providers\/(movie|tv)/.test(url)) {
      patchProviders(obj);
      $done({ body: JSON.stringify(obj) });
      return;
    }

    if (/streaming-availability\.p\.rapidapi\.com\/shows\/tt/.test(url)) {
      patchSofaStreaming(obj);
      $done({ body: JSON.stringify(obj) });
      return;
    }

    if (/streaming-availability\.p\.rapidapi\.com\/countries\/[a-z]{2}/.test(url)) {
      patchSofaCountries(obj);
      $done({ body: JSON.stringify(obj) });
      return;
    }

    if (/\/users\/settings/.test(url)) {
      if (obj) {
        obj.vip = true;
        obj.ads = false;
      }
      $done({ body: JSON.stringify(obj) });
      return;
    }
  }

  $done({});
}

process().catch(() => $done({}));
