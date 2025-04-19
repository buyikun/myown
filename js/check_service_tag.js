/**
 * @description
 * 该脚本用于检测代理节点是否支持以下服务：
 *   - GPT ([GPT])
 *   - Netflix ([NF])
 *   - Disney+ ([D+])
 *   - YouTube Premium ([YT])
 * 
 * 检测成功后，会在代理节点名称前添加对应服务前缀。
 *
 * 可用参数（均为可选，默认 false）：
 *  - g (boolean): 启用 GPT 检测（如 g: true）
 *  - n (boolean): 启用 Netflix 检测（如 n: true）
 *  - d (boolean): 启用 Disney+ 检测（如 d: true）
 *  - y (boolean): 启用 YouTube Premium 检测（如 y: true）
 *  - cache (boolean): 启用检测结果缓存（如 cache: true）
 *  - force_refresh (boolean): 忽略缓存、强制重新检测
 *  - concurrency (number): 并发数，默认 10
 *  - timeout (ms): 单个请求超时，默认 5000
 *  - retries (number): 请求失败重试次数，默认 1
 *  - retry_delay (ms): 重试间隔，默认 1000
 *
 * 示例参数配置：
 *  script:
 *    url: https://yourgist.githubusercontent.com/.../service_check.js
 *    arguments:
 *      g: true
 *      n: true
 *      y: true
 *      cache: true
 */

async function operator(proxies = [], targetPlatform, context) {
  const $ = $substore
  const { isLoon, isSurge } = $.env
  if (!isLoon && !isSurge) throw new Error('仅支持 Loon 和 Surge(ability=http-client-policy)')

  const cacheEnabled = $arguments.cache
  const forceRefresh = $arguments.force_refresh || false
  const concurrency = parseInt($arguments.concurrency || 10)
  const cache = scriptResourceCache

  const url_gpt = `https://ios.chat.openai.com`
  const url_netflix = `https://www.netflix.com`
  const url_disney = `https://www.disneyplus.com`
  const url_youtube = `https://www.youtube.com/premium`

  await executeAsyncTasks(
    proxies.map(proxy => async () => {
      await check(proxy)
    }),
    { concurrency }
  )

  return proxies

  async function check(proxy) {
    const id = cacheEnabled ? `service:${JSON.stringify(proxy)}` : undefined

    try {
      const node = ProxyUtils.produce([proxy], isLoon ? 'Loon' : 'Surge')
      if (!node) return

      const cached = cache.get(id)
      if (cacheEnabled && cached && !forceRefresh) {
        addPrefix(proxy, cached)
        return
      }

      const results = await Promise.all([
        $arguments.g ? checkService(url_gpt, proxy, 'GPT') : null,
        $arguments.n ? checkService(url_netflix, proxy, 'NF') : null,
        $arguments.d ? checkService(url_disney, proxy, 'D+') : null,
        $arguments.y ? checkService(url_youtube, proxy, 'YT') : null,
      ])

      const resultFlags = {}
      results.forEach(res => {
        if (res?.result) {
          proxy.name = `[${res.service}]${proxy.name}`
          resultFlags[res.service.toLowerCase()] = true
        }
      })

      if (cacheEnabled) cache.set(id, resultFlags)
    } catch (e) {
      $.error(`[${proxy.name}] ${e.message ?? e}`)
      if (cacheEnabled) cache.set(id, {})
    }
  }

  function addPrefix(proxy, flags = {}) {
    if (flags.gpt) proxy.name = `[GPT]${proxy.name}`
    if (flags.nf) proxy.name = `[NF]${proxy.name}`
    if (flags['d+']) proxy.name = `[D+]${proxy.name}`
    if (flags.yt) proxy.name = `[YT]${proxy.name}`
  }

  async function checkService(url, proxy, tag) {
    const startedAt = Date.now()
    try {
      const res = await http({
        method: 'get',
        url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        node: ProxyUtils.produce([proxy], isLoon ? 'Loon' : 'Surge'),
      })

      const status = parseInt(res.status ?? res.statusCode ?? 200)
      const latency = Date.now() - startedAt
      $.info(`[${proxy.name}] ${tag} status: ${status}, latency: ${latency}ms`)

      return { service: tag, result: status === 200 }
    } catch (e) {
      $.error(`[${proxy.name}] ${tag} 请求失败: ${e.message ?? e}`)
      return { service: tag, result: false }
    }
  }

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
