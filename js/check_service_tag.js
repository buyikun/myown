// -------------------------
// 脚本功能：
// 该脚本用于检查代理节点是否支持以下服务，并为每个支持的服务添加相应的前缀标识：
// - GPT：[GPT]
// - Netflix：[NF]
// - Disney+：[D+]
// - YouTube Premium：[YT]
// 
// 根据传递的参数，脚本可以启用或禁用对这些服务的检测。
// 启用对应的服务后，节点的名称将会加上相应的前缀标识，以便区分哪些代理节点支持哪些服务。
// 
// 可用的参数:
// - g (default: true): 启用/禁用 GPT 检测。值为 `true` 表示启用，`false` 表示禁用。
// - n (default: true): 启用/禁用 Netflix 检测。值为 `true` 表示启用，`false` 表示禁用。
// - d (default: true): 启用/禁用 Disney+ 检测。值为 `true` 表示启用，`false` 表示禁用。
// - y (default: true): 启用/禁用 YouTube Premium 检测。值为 `true` 表示启用，`false` 表示禁用。
// - cache (default: false): 启用/禁用缓存功能。值为 `true` 表示启用缓存，`false` 表示禁用缓存。
// - force_refresh (default: false): 强制刷新缓存。值为 `true` 表示强制刷新缓存，`false` 表示不刷新缓存。
// - method (default: 'get'): 请求方法，默认为 'get'。
// - concurrency (default: 10): 控制并发执行的任务数，默认为 10。
// 
// 示例配置:
// - g: true   # 启用 GPT 检测
// - n: true   # 启用 Netflix 检测
// - d: true   # 启用 Disney+ 检测
// - y: true   # 启用 YouTube Premium 检测
// - cache: true  # 启用缓存功能
// -------------------------

async function operator(proxies = [], targetPlatform, context) {
  const $ = $substore;
  const { isLoon, isSurge } = $.env;

  // 检查是否为 Loon 或 Surge 环境
  if (!isLoon && !isSurge) throw new Error('仅支持 Loon 和 Surge(ability=http-client-policy)');

  const cacheEnabled = $arguments.cache;  // 启用缓存功能
  const disableFailedCache = $arguments.disable_failed_cache || $arguments.ignore_failed_error;  // 禁用失败缓存
  const cache = scriptResourceCache;

  // 服务前缀配置（可自定义）
  const gptPrefix = $arguments.gpt_prefix ?? '[GPT] ';
  const nfPrefix = $arguments.nf_prefix ?? '[NF] ';
  const ytPrefix = $arguments.yt_prefix ?? '[YT] ';
  const dPlusPrefix = $arguments.dPlus_prefix ?? '[D+] ';

  const method = $arguments.method || 'get';  // 请求方法
  const url = $arguments.client === 'Android' ? `https://android.chat.openai.com` : `https://ios.chat.openai.com`;  // GPT API 请求的 URL
  
  const concurrency = parseInt($arguments.concurrency || 10);  // 并发数

  // 执行所有任务
  await executeAsyncTasks(
    proxies.map(proxy => () => check(proxy)),
    { concurrency }
  );

  // 检查代理节点的函数
  async function check(proxy) {
    const id = cacheEnabled
      ? `gpt:${url}:${JSON.stringify(
          Object.fromEntries(
            Object.entries(proxy).filter(([key]) => !/^(name|collectionName|subName|id|_.*)$/i.test(key))
          )
        )}`
      : undefined;

    try {
      const node = ProxyUtils.produce([proxy], targetPlatform);
      if (node) {
        const cached = cache.get(id);  // 获取缓存
        if (cacheEnabled && cached) {
          // 如果缓存存在且服务可用，直接使用缓存
          if (cached.gpt) {
            proxy.name = `${gptPrefix}${proxy.name}`;
            proxy._gpt = true;
            proxy._gpt_latency = cached.gpt_latency;
            $.info(`[${proxy.name}] 使用成功缓存`);
            return;
          } else if (disableFailedCache) {
            $.info(`[${proxy.name}] 不使用失败缓存`);
          } else {
            $.info(`[${proxy.name}] 使用失败缓存`);
            return;
          }
        }

        const startedAt = Date.now();
        const res = await http({
          method,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1',
          },
          url,
          'policy-descriptor': node,
          node,
        });

        const status = parseInt(res.status ?? res.statusCode ?? 200);
        let body = String(res.body ?? res.rawBody);
        try {
          body = JSON.parse(body);
        } catch (e) {}

        const msg = body?.error?.code || body?.error?.error_type || body?.cf_details;
        const latency = Date.now() - startedAt;
        $.info(`[${proxy.name}] status: ${status}, msg: ${msg}, latency: ${latency}`);

        // 进行服务检测，根据状态判断是否给节点添加相应的前缀
        if (status == 403 && !/unsupported_country/.test(msg)) {
          // 启用 GPT 检测
          if ($arguments.g) {
            proxy.name = `${gptPrefix}${proxy.name}`;
            proxy._gpt = true;
            proxy._gpt_latency = latency;
          }
          // 启用 Netflix 检测
          if ($arguments.n) {
            proxy.name = `${nfPrefix}${proxy.name}`;
            proxy._nf = true;
          }
          // 启用 Disney+ 检测
          if ($arguments.d) {
            proxy.name = `${dPlusPrefix}${proxy.name}`;
            proxy._dplus = true;
          }
          // 启用 YouTube Premium 检测
          if ($arguments.y) {
            proxy.name = `${ytPrefix}${proxy.name}`;
            proxy._yt = true;
          }

          if (cacheEnabled) {
            $.info(`[${proxy.name}] 设置成功缓存`);
            cache.set(id, { gpt: true, gpt_latency: latency });
          }
        } else {
          if (cacheEnabled) {
            $.info(`[${proxy.name}] 设置失败缓存`);
            cache.set(id, {});
          }
        }
      }
    } catch (e) {
      $.error(`[${proxy.name}] ${e.message ?? e}`);
      if (cacheEnabled) {
        $.info(`[${proxy.name}] 设置失败缓存`);
        cache.set(id, {});
      }
    }
  }

  // HTTP 请求函数，带重试机制
  async function http(opt = {}) {
    const METHOD = opt.method || 'get';
    const TIMEOUT = parseFloat(opt.timeout || $arguments.timeout || 5000);
    const RETRIES = parseFloat(opt.retries ?? $arguments.retries ?? 1);
    const RETRY_DELAY = parseFloat(opt.retry_delay ?? $arguments.retry_delay ?? 1000);

    let count = 0;
    const fn = async () => {
      try {
        return await $.http[METHOD]({ ...opt, timeout: TIMEOUT });
      } catch (e) {
        if (count < RETRIES) {
          count++;
          const delay = RETRY_DELAY * count;
          await $.wait(delay);
          return await fn();
        } else {
          throw e;
        }
      }
    };
    return await fn();
  }

  // 执行并发任务
  function executeAsyncTasks(tasks, { wrap, result, concurrency = 1 } = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        let running = 0;
        const results = [];
        let index = 0;

        function executeNextTask() {
          while (index < tasks.length && running < concurrency) {
            const taskIndex = index++;
            const currentTask = tasks[taskIndex];
            running++;

            currentTask()
              .then(data => {
                if (result) {
                  results[taskIndex] = wrap ? { data } : data;
                }
              })
              .catch(error => {
                if (result) {
                  results[taskIndex] = wrap ? { error } : error;
                }
              })
              .finally(() => {
                running--;
                executeNextTask();
              });
          }

          if (running === 0) {
            return resolve(result ? results : undefined);
          }
        }

        await executeNextTask();
      } catch (e) {
        reject(e);
      }
    });
  }
}