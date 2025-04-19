/**
 * @description
 * 检测代理节点是否为“送中节点”（即出口 IP 属于中国大陆）
 * 
 * 检测成功后，节点名称会添加前缀 [CN]
 * 
 * 可用参数（均为可选）：
 *  - mark_cn (boolean): 启用送中检测，默认 true
 *  - cache (boolean): 是否启用缓存（默认 false）
 *  - force_refresh (boolean): 忽略缓存强制重新检测，默认 false
 *  - concurrency (number): 并发检测数，默认 10
 */

async function operator(proxies = [], targetPlatform, context) {
  const $ = $substore
  const { isLoon, isSurge } = $.env
  if (!isLoon && !isSurge) throw new Error('仅支持 Loon 和 Surge(ability=http-client-policy)')

  const enableCN = $arguments.mark_cn !== false
  const cacheEnabled = $arguments.cache
  const forceRefresh = $arguments.force_refresh
  const concurrency = parseInt($arguments.concurrency || 10)
  const cache = scriptResourceCache

  if (!enableCN) return proxies

  await executeAsyncTasks(
    proxies.map(proxy => async () => {
      await check(proxy)
    }),
    { concurrency }
  )

  return proxies

  async function check(proxy) {
    const id = cacheEnabled ? `send_cn:${JSON.stringify(proxy)}` : undefined

    try {
      const node = ProxyUtils.produce([proxy], isLoon ? 'Loon' : 'Surge')
      if (!node) return

      const cached = cache.get(id)
      if (cacheEnabled && cached !== undefined && !forceRefresh) {
        if (cached === true) proxy.name = `[CN]${proxy.name}`
        return
      }

      const res = await http({
        method: 'get',
        url: 'https://ip-api.com/json',
        headers: {
          'User-Agent': 'curl/8.0',
        },
        node,
      })

      const data = JSON.parse(res.body)
      const isCN = data?.countryCode === 'CN'

      if (isCN) {
        proxy.name = `[CN]${proxy.name}`
        $.info(`[${proxy.name}] 为送中节点：${data.query} - ${data.as}`)
      } else {
        $.info(`[${proxy.name}] 非送中：${data.query} - ${data.country}`)
      }

      if (cacheEnabled) cache.set(id, isCN)
    } catch (e) {
      $.error(`[${proxy.name}] 检测失败: ${e.message || e}`)
      if (cacheEnabled) cache.set(id, false)
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
