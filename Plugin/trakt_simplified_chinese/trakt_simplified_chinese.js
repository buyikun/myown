const { body, method, url } = $request;
const { latestHistoryEpisodeOnly, commentTranslationEnabled, backendBaseUrl } = $argument;

let obj = {};
if (body) {
  try { obj = JSON.parse(body); } catch {}
}

// 原版播放器 + 严格按格式追加 SenPlayer
const players = [
  { name: "Infuse",     scheme: "infuse://x-callback-url/play?tmdb=" },
  { name: "EplayerX",   scheme: "eplayerx://play?tmdb=" },
  { name: "Forward",    scheme: "forward://play?tmdb=" },
  { name: "SenPlayer",  scheme: "senplayer://x-callback-url/play?tmdb=" }
];

const CACHE_KEY_PREFIX = "trakt_trans_";
const CACHE_TTL = 7 * 24 * 3600 * 1000;

function getCache(key) {
  const cached = $persistentStore.read(CACHE_KEY_PREFIX + key);
  if (!cached) return null;
  try {
    const { data, expire } = JSON.parse(cached);
    return Date.now() < expire ? data : null;
  } catch { return null; }
}

function setCache(key, data) {
  $persistentStore.write(JSON.stringify({ data, expire: Date.now() + CACHE_TTL }), CACHE_KEY_PREFIX + key);
}

async function translateText(text) {
  if (!text) return text;
  const cached = getCache(text);
  if (cached) return cached;
  try {
    const res = await $fetch(`${backendBaseUrl}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const result = res.data?.result || text;
    setCache(text, result);
    return result;
  } catch { return text; }
}

async function translateComments(comments) {
  if (!commentTranslationEnabled || !comments) return;
  for (const c of comments) {
    if (c.comment) c.comment = await translateText(c.comment);
    if (c.replies) await translateComments(c.replies);
  }
}

// 核心：完全按原版格式注入播放器
function patchWatchNow(items) {
  if (!items) return;
  for (const item of items) {
    const tmdb = item.ids?.tmdb;
    if (!tmdb) continue;

    const links = [];
    for (const p of players) {
      let u = p.scheme + tmdb;
      if (item.type === "episode" && item.season && item.number) {
        u += `&season=${item.season}&episode=${item.number}`;
      }
      links.push({
        name: p.name,
        icon: "",
        url: u,
        premium: false,
        free: true,
        source: p.name.toLowerCase()
      });
    }

    item.links = [...(item.links || []), ...links];
  }
}

function patchProviders(data) {
  if (!data?.results) return;
  for (const id of Object.keys(data.results)) {
    const item = data.results[id];
    const tmdb = parseInt(id);
    if (!tmdb) continue;

    const providers = [];
    for (const p of players) {
      providers.push({
        display_name: p.name,
        direct_url: p.scheme + tmdb,
        icon_url: "",
        platform: "ios"
      });
    }

    item.providers = [...(item.providers || []), ...providers];
  }
}

function patchSofaShow(data) {
  if (!data?.tmdb_id) return;
  const streaming = [];
  for (const p of players) {
    streaming.push({
      name: p.name,
      url: p.scheme + data.tmdb_id,
      icon: "",
      web_url: null
    });
  }
  data.streaming = [...(data.streaming || []), ...streaming];
}

function patchSofaCountries(data) {
  if (!data?.services) return;
  for (const p of players) {
    data.services[p.name] = { id: p.name, name: p.name, icon: "", home_page: "" };
  }
}

function filterLatestEpisodes(items) {
  if (!latestHistoryEpisodeOnly || !items) return items;
  const map = new Map();
  for (const item of items) {
    const key = item.show?.ids?.trakt;
    if (!key) continue;
    const curr = map.get(key);
    if (!curr) {
      map.set(key, item);
    } else {
      const s = item.season || 0, e = item.number || 0;
      const os = curr.season || 0, oe = curr.number || 0;
      if (s > os || (s === os && e > oe)) map.set(key, item);
    }
  }
  return Array.from(map.values());
}

function increaseLimit(uri) {
  if (!latestHistoryEpisodeOnly) return uri;
  const u = new URL(uri);
  u.searchParams.set("limit", "1000");
  return u.toString();
}

function prioritizeSimplifiedChinese(trans) {
  if (!trans) return trans;
  const cn = trans.filter(t => t.country === "CN" && t.language === "zh");
  if (cn.length) return cn;
  const tw = trans.filter(t => t.country === "TW" && t.language === "zh");
  return tw.length ? tw : trans;
}

async function process() {
  if (method === "GET") {
    if (url.includes("/sync/history/episodes") || /\/users\/[^/]+\/history\/episodes/.test(url)) {
      $done({ url: increaseLimit(url) });
      return;
    }
  }

  if (method === "RESPONSE") {
    if (/history\/episodes/.test(url)) {
      obj = filterLatestEpisodes(obj);
      $done({ body: JSON.stringify(obj) });
      return;
    }
    if (/translations\/zh$/.test(url)) {
      obj = prioritizeSimplifiedChinese(obj);
      $done({ body: JSON.stringify(obj) });
      return;
    }
    if (/comments|replies/.test(url)) {
      await translateComments(obj);
      $done({ body: JSON.stringify(obj) });
      return;
    }
    if (/watchnow($|\?)/.test(url)) {
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
      patchSofaShow(obj);
      $done({ body: JSON.stringify(obj) });
      return;
    }
    if (/streaming-availability\.p\.rapidapi\.com\/countries\/[a-z]{2}/.test(url)) {
      patchSofaCountries(obj);
      $done({ body: JSON.stringify(obj) });
      return;
    }
    if (/users\/settings/.test(url)) {
      if (obj) { obj.vip = true; obj.ads = false; }
      $done({ body: JSON.stringify(obj) });
      return;
    }
  }

  $done({});
}

process().catch(() => $done({}));
