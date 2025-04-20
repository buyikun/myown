/**
 * check_service_tag.js
 * Sub-Store 专用节点服务能力检测脚本
 * 支持检测以下服务并自动加标签：
 *   - ChatGPT       → [GPT]
 *   - Netflix       → [NF]
 *   - Disney+       → [D+]
 *   - YouTube 高级  → [YT]
 *
 * 参数说明（可组合使用）：
 *   g=1 → 启用 GPT 检测（chat.openai.com）
 *   n=1 → 启用 Netflix 检测（指定影视页面）
 *   d=1 → 启用 Disney+ 检测（首页访问）
 *   y=1 → 启用 YouTube Premium 检测（premium 页面）
 *   cache=1 → 启用节点检测结果缓存，加快下次加载
 *   concurrency=10 → 并发数量，默认10
 *
 * 使用示例：
 *   https://sub.store/script?url=https://your.domain/check_service_tag.js&g=1&n=1&d=1&y=1
 *
 * 要求环境：
 *   Loon 或 Surge（需开启 ability=http-client-policy）
 */

const SERVICE_MAP = {
  g: {
    name: 'gpt',
    prefix: '[GPT]',
    url: 'https://chat.openai.com/',
    match: /chat\.openai/i,
    method: 'get',
  },
  n: {
    name: 'netflix',
    prefix: '[NF]',
    url: 'https://www.netflix.com/title/80018499',
    match: /netflix/i,
    method: 'get',
  },
  d: {
    name: 'disney',
    prefix: '[D+]',
    url: 'https://www.disneyplus.com/',
    match: /disney/i,
    method: 'get',
  },
  y: {
    name: 'youtube',
    prefix: '[YT]',
    url: 'https://www.youtube.com/premium',
    match: /premium|youtube/i,
    method: 'get',
  }
};

async function operator(proxies = [], _targetPlatform, context) {
  const $ = $substore;
  const { isLoon, isSurge } = $.env;
  if (!isLoon && !isSurge) throw new Error('仅支持 Loon 或 Surge 运行');

  const args = $arguments;
  const cacheEnabled = args.cache;
  const concurrency = parseInt(args.concurrency || 10);
  const cache = scriptResourceCache;

  // 筛选启用的检测类型
  const enabledKeys = Object.keys(SERVICE_MAP).filter(key => args[key]);

  if (enabledKeys.length === 0) {
    $.info('[脚本] 未启用任何服务检测');
    return proxies;
  }

  // 并发检测每个节点的服务支持情况
  await executeAsyncTasks(
    proxies.map(proxy => async () => {
      for (const key of enabledKeys) {
        await check(proxy, key);
      }
    }),
    { concurrency }
  );

  return proxies;

  /**
   * 对单个节点进行某服务检测
   */
  async function check(proxy, key) {
    const service = SERVICE_MAP[key];
    const node = ProxyUtils.produce([proxy], isLoon ? 'Loon' : 'Surge');
    if (!node) return;

    const id = cacheEnabled
      ? `svc:${key}:${JSON.stringify(
          Object.fromEntries(Object.entries(proxy).filter(([k]) => !/^(_|name|id|collectionName|subName)$/i.test(k)))
        )}`
      : null;

    // 命中缓存则直接返回
    if (cacheEnabled) {
      const cached = cache.get(id);
      if (cached?.ok) {
        proxy.name = `${service.prefix} ${proxy.name}`;
        proxy[`_${key}`] = true;
        proxy[`_${key}_latency`] = cached.latency;
        $.info(`[缓存命中] ${proxy.name} - ${service.name}`);
        return;
      }
    }

    // 发送请求检测服务支持
    try {
      const start = Date.now();
      const res = await $.http[service.method]({
        url: service.url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1'
        },
        'policy-descriptor': node,
        node,
        timeout: 5000
      });

      const latency = Date.now() - start;
      const status = res.status ?? res.statusCode ?? 200;
      const body = res.body || res.rawBody || '';

      if (status === 200 && service.match.test(body)) {
        proxy.name = `${service.prefix} ${proxy.name}`;
        proxy[`_${key}`] = true;
        proxy[`_${key}_latency`] = latency;
        $.info(`[通过] ${proxy.name} - ${service.name}, 延迟 ${latency}ms`);
        if (cacheEnabled) cache.set(id, { ok: true, latency });
      } else {
        $.info(`[未通过] ${proxy.name} - ${service.name}`);
        if (cacheEnabled) cache.set(id, { ok: false });
      }
    } catch (e) {
      $.error(`[异常] ${proxy.name} - ${service.name}: ${e.message}`);
      if (cacheEnabled) cache.set(id, { ok: false });
    }
  }

  /**
   * 异步任务执行器（控制并发数）
   */
  async function executeAsyncTasks(tasks, { concurrency = 1 } = {}) {
    return new Promise((resolve, reject) => {
      let running = 0, index = 0;
      const next = () => {
        while (running < concurrency && index < tasks.length) {
          running++;
          tasks[index++]().finally(() => {
            running--;
            next();
          });
        }
        if (running === 0 && index >= tasks.length) resolve();
      };
      next();
    });
  }
}