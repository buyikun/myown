// Sub-Store 节点检测脚本 - GPT 检测版
// 本脚本基于 HTTP Meta 检测 GPT 服务可用性，支持 Surge 和 Loon
// 支持参数控制：
//   &cache           启用缓存，加快后续加载速度
//   &disable_failed_cache 或 &ignore_failed_error 忽略失败缓存
//   &gpt_prefix=[前缀] 设置标签前缀，默认 [GPT]
//   &client=[Android|iOS] 设置检测网址（默认 iOS）
//   &method=[GET|HEAD] 请求方法
//   &concurrency=10 并发数（默认10）

async function operator(proxies = [], targetPlatform, context) {
  const $ = $substore
  const { isLoon, isSurge } = $.env
  if (!isLoon && !isSurge) throw new Error('仅支持 Loon 和 Surge(ability=http-client-policy)')

  // 参数解析
  const cacheEnabled = $arguments.cache                                      // 是否启用缓存
  const disableFailedCache = $arguments.disable_failed_cache || $arguments.ignore_failed_error // 是否忽略失败缓存
  const gptPrefix = $arguments.gpt_prefix ?? '[GPT] '                        // 标签前缀
  const method = $arguments.method || 'get'                                  // 请求方法
  const url = $arguments.client === 'Android' 
    ? `https://android.chat.openai.com` 
    : `https://ios.chat.openai.com`                                          // 检测地址（根据 client 参数切换）
  const target = isLoon ? 'Loon' : isSurge ? 'Surge' : undefined             // 当前平台
  const concurrency = parseInt($arguments.concurrency || 10)                // 并发检测数量
  const cache = scriptResourceCache                                          // Sub-Store 提供的缓存对象

  // 拉取远程脚本（检测是否更新）
  const scriptUrl = 'https://raw.githubusercontent.com/xream/scripts/main/surge/modules/sub-store-scripts/check/http_meta_gpt.js'
  const scriptCacheKey = `script_etag:${scriptUrl}`                         // 脚本版本缓存 key
  const resultCacheKey = `gpt:result:last`                                  // 结果缓存 key
  const previous = cache.get(scriptCacheKey)

  try {
    const res = await $.http.get({
      url: scriptUrl,
      headers: previous?.etag ? { 'If-None-Match': previous.etag } : {},
      timeout: 5000,
    })

    // 如果脚本未变更，直接从缓存读取结果
    if (res.status === 304) {
      $.info(`[脚本] 未变更，跳过检测流程`)
      const last = cache.get(resultCacheKey)
      if (last) {
        $.info(`[脚本] 载入上次检测标记结果，共 ${last.length} 个`)
        return last
      }
      $.info(`[脚本] 无可用结果缓存，返回原始列表`)
      return proxies
    }

    // 脚本有更新，缓存 ETag
    const etag = res.headers?.etag
    if (etag) {
      cache.set(scriptCacheKey, { etag })
      $.info(`[脚本] 检测到更新，执行检测逻辑`)
    }
  } catch (e) {
    $.info(`[脚本] 拉取失败，按默认继续执行检测`)
  }

  // 执行并发检测
  await executeAsyncTasks(
    proxies.map(proxy => async () => {
      await check(proxy)
    }),
    { concurrency }
  )

  // 缓存检测结果
  if (cacheEnabled) {
    cache.set(resultCacheKey, proxies)
  }

  return proxies

  // 检测函数：判断节点是否支持 GPT
  async function check(proxy) {
    // 构建节点的唯一缓存 key（剔除无关字段）
    const id = cacheEnabled
      ? `gpt:${url}:${JSON.stringify(
          Object.fromEntries(
            Object.entries(proxy).filter(([key]) => !/^(name|collectionName|subName|id|_.*)$/i.test(key))
          )
        )}`
      : undefined

    try {
      const node = ProxyUtils.produce([proxy], target)
      if (node) {
        const cached = cache.get(id)

        // 使用缓存（成功或失败）
        if (cacheEnabled && cached) {
          if (cached.gpt) {
            proxy.name = `${gptPrefix}${proxy.name}`
            proxy._gpt = true
            proxy._gpt_latency = cached.gpt_latency
            $.info(`[${proxy.name}] 使用成功缓存`)
            return
          } else if (disableFailedCache) {
            $.info(`[${proxy.name}] 不使用失败缓存`)
          } else {
            $.info(`[${proxy.name}] 使用失败缓存`)
            return
          }
        }

        // 发起请求检测
        const startedAt = Date.now()
        const res = await http({
          method,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1',
          },
          url,
          'policy-descriptor': node,
          node,
        })

        const status = parseInt(res.status ?? res.statusCode ?? 200)
        let body = String(res.body ?? res.rawBody)
        try {
          body = JSON.parse(body)
        } catch (e) {}

        const msg = body?.error?.code || body?.error?.error_type || body?.cf_details
        const latency = Date.now() - startedAt
        $.info(`[${proxy.name}] status: ${status}, msg: ${msg}, latency: ${latency}`)

        // 判断是否支持 GPT
        if (status === 403 && !/unsupported_country/.test(msg)) {
          proxy.name = `${gptPrefix}${proxy.name}`
          proxy._gpt = true
          proxy._gpt_latency = latency
          if (cacheEnabled) cache.set(id, { gpt: true, gpt_latency: latency })
        } else {
          if (cacheEnabled) cache.set(id, {})
        }
      }
    } catch (e) {
      $.error(`[${proxy.name}] ${e.message ?? e}`)
      if (cacheEnabled) cache.set(id, {})
    }
  }

  // 自定义 HTTP 请求函数，支持重试机制
  async function http(opt = {}) {
    const METHOD = opt.method || 'get'
    const TIMEOUT = parseFloat(opt.timeout || $arguments.timeout || 5000)
    const RETRIES = parseFloat(opt.retries ?? $arguments.retries ?? 1)
    const RETRY_DELAY = parseFloat(opt.retry_delay ?? $arguments.retry_delay ?? 1000)

    let count = 0
    const fn = async () => {
      try {
        return await $.http[METHOD]({ ...opt, timeout: TIMEOUT })
      } catch (e) {
        if (count < RETRIES) {
          count++
          await $.wait(RETRY_DELAY * count)
          return await fn()
        } else {
          throw e
        }
      }
    }
    return await fn()
  }

  // 并发执行器（限制最大并发数）
  function executeAsyncTasks(tasks, { wrap, result, concurrency = 1 } = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        let running = 0
        const results = []
        let index = 0

        function executeNextTask() {
          while (index < tasks.length && running < concurrency) {
            const taskIndex = index++
            const currentTask = tasks[taskIndex]
            running++

            currentTask()
              .then(data => {
                if (result) results[taskIndex] = wrap ? { data } : data
              })
              .catch(error => {
                if (result) results[taskIndex] = wrap ? { error } : error
              })
              .finally(() => {
                running--
                executeNextTask()
              })
          }

          if (running === 0) {
            return resolve(result ? results : undefined)
          }
        }

        await executeNextTask()
      } catch (e) {
        reject(e)
      }
    })
  }
}
