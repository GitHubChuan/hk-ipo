// 港股行情 & 新股日历 & 暗盘行情自动抓取
// 浏览器跨域限制下的多重容错策略：
//   1) 行情：用 JSONP 注入 <script> 拉腾讯 qt.gtimg.cn（原生免 CORS）
//   2) 新股日历：依次尝试多个公开 CORS 代理，全部失败时返回 []
//   3) 暗盘：AAStocks 暗盘页 / 雪球预上市 / 富途暗盘页 多源 + 缓存

import { useStore } from './store'

// ────────────────────────── 通用工具 ──────────────────────────

const CACHE_KEY_PREFIX = 'hk_ipo_market_cache_v1::'
const CACHE_DEFAULT_TTL = 60 * 60 * 1000 // 1h

export function readCache<T>(key: string, ttl = CACHE_DEFAULT_TTL): T | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + key)
    if (!raw) return null
    const { t, v } = JSON.parse(raw)
    if (Date.now() - t > ttl) return null
    return v as T
  } catch { return null }
}
export function writeCache<T>(key: string, value: T) {
  try { localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify({ t: Date.now(), v: value })) } catch {}
}

// ────────────────────────── 行情（JSONP，无需代理） ──────────────────────────

function toTencentKey(code: string): string {
  const num = code.replace(/[^0-9]/g, '').padStart(5, '0').slice(-5)
  return `r_hk${num}`
}

export type LiveQuote = {
  code: string
  name?: string
  price: number
  changePct: number
  open?: number
  prevClose?: number
  high?: number
  low?: number
  volume?: number
  fetchedAt: number
}

function jsonpFetch(url: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = url
    s.async = true
    let done = false
    const timer = setTimeout(() => { if (done) return; done = true; cleanup(); reject(new Error('JSONP timeout')) }, timeoutMs)
    const cleanup = () => { clearTimeout(timer); s.remove() }
    s.onload = () => { if (done) return; done = true; cleanup(); resolve('OK') }
    s.onerror = () => { if (done) return; done = true; cleanup(); reject(new Error('JSONP load error')) }
    document.head.appendChild(s)
  })
}

export async function fetchHKQuote(code: string): Promise<LiveQuote | null> {
  const key = toTencentKey(code)
  const varName = 'v_' + key
  try {
    await jsonpFetch(`https://qt.gtimg.cn/q=${key}`)
    const raw = (window as any)[varName] as string | undefined
    if (!raw) return null
    const fields = raw.split('~')
    if (fields.length < 6) return null
    const name = fields[1]
    const price = parseFloat(fields[3])
    const prevClose = parseFloat(fields[4])
    const open = parseFloat(fields[5])
    const high = parseFloat(fields[33] || fields[7] || '0')
    const low = parseFloat(fields[34] || fields[8] || '0')
    const volume = parseFloat(fields[6] || '0')
    const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0
    return { code, name, price, changePct, prevClose, open, high, low, volume, fetchedAt: Date.now() }
  } catch (e) {
    console.warn('[fetchHKQuote] failed', code, e)
    return null
  }
}

export async function fetchManyQuotes(codes: string[]): Promise<Record<string, LiveQuote | null>> {
  const map: Record<string, LiveQuote | null> = {}
  for (const c of codes) map[c] = await fetchHKQuote(c)
  return map
}

// ────────────────────────── 代理工具链 ──────────────────────────

function buildProxyUrls(target: string): string[] {
  const userProxy = useStore.getState().config.corsProxy?.trim()
  const enc = encodeURIComponent(target)
  const list: string[] = []
  if (userProxy) {
    if (userProxy.includes('?')) list.push(userProxy + enc)
    else list.push(userProxy.replace(/\/$/, '') + '/' + target)
  }
  list.push(
    `https://api.allorigins.win/raw?url=${enc}`,
    `https://api.codetabs.com/v1/proxy?quest=${target}`,
    `https://thingproxy.freeboard.io/fetch/${target}`,
    `https://corsproxy.io/?${enc}`,
  )
  return list
}

async function fetchWithFallback(target: string, minLen = 200): Promise<string | null> {
  for (const url of buildProxyUrls(target)) {
    try {
      const res = await fetch(url, { method: 'GET' })
      if (!res.ok) continue
      const text = await res.text()
      if (text && text.length >= minLen && !text.includes('Server-side requests are not allowed')) return text
    } catch (e) {
      console.warn('[proxy failed]', url, e)
    }
  }
  return null
}

// ────────────────────────── 新股日历 ──────────────────────────

export type IpoCalendarEntry = {
  code?: string
  name: string
  priceLow?: number
  priceHigh?: number
  lotSize?: number
  subscriptionStart?: string
  subscriptionEnd?: string
  listingDate?: string
  industry?: string
  source: 'aastocks' | 'xueqiu' | 'manual' | 'sample' | 'cache'
  rawSnippet?: string
}

async function fromXueqiu(): Promise<IpoCalendarEntry[]> {
  const url = 'https://stock.xueqiu.com/v5/stock/preipo/hk/list.json?type=4&order_by=onl_subbeg_date&order=desc&page=1&size=30'
  const text = await fetchWithFallback(url)
  if (!text) return []
  try {
    const json = JSON.parse(text)
    const items: any[] = json?.data?.items ?? []
    return items.map((x) => ({
      code: String(x.symbol).padStart(5, '0') + '.HK',
      name: x.name,
      priceLow: x.issprice_min,
      priceHigh: x.issprice_max,
      lotSize: x.lot_size,
      subscriptionStart: x.apply_begin_date ? new Date(x.apply_begin_date).toISOString().slice(0, 10) : undefined,
      subscriptionEnd: x.apply_end_date ? new Date(x.apply_end_date).toISOString().slice(0, 10) : undefined,
      listingDate: x.list_date ? new Date(x.list_date).toISOString().slice(0, 10) : undefined,
      industry: x.business?.slice(0, 30),
      source: 'xueqiu' as const,
      rawSnippet: x.business?.slice(0, 160),
    }))
  } catch (e) { console.warn('[xueqiu parse]', e); return [] }
}

async function fromAAStocks(): Promise<IpoCalendarEntry[]> {
  const target = 'https://www.aastocks.com/sc/stocks/market/ipo/upcomingipo/listing-date'
  const html = await fetchWithFallback(target)
  if (!html) return []
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const rows = doc.querySelectorAll('table tr')
    const out: IpoCalendarEntry[] = []
    rows.forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').trim())
      if (cells.length < 4) return
      const codeMatch = cells.join(' ').match(/\b(\d{4,5})\b/)
      const dateMatch = cells.join(' ').match(/\d{4}\/\d{1,2}\/\d{1,2}/g)
      const priceMatch = cells.join(' ').match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/)
      const nameCell = cells.find((c) => /[\u4e00-\u9fa5]/.test(c) && c.length < 30) ?? cells[1]
      if (!nameCell || !codeMatch) return
      out.push({
        code: codeMatch[1].padStart(5, '0') + '.HK',
        name: nameCell.replace(/[\d\.\-\s]+$/g, '').trim(),
        priceLow: priceMatch ? parseFloat(priceMatch[1]) : undefined,
        priceHigh: priceMatch ? parseFloat(priceMatch[2]) : undefined,
        listingDate: dateMatch?.[0],
        source: 'aastocks',
        rawSnippet: cells.join(' | ').slice(0, 160),
      })
    })
    return out
  } catch (e) { console.warn('[aastocks parse]', e); return [] }
}

export async function fetchIpoCalendar(opts?: { useCache?: boolean }): Promise<{ list: IpoCalendarEntry[]; source: string; error?: string; fetchedAt?: number }> {
  if (opts?.useCache !== false) {
    const cached = readCache<{ list: IpoCalendarEntry[]; source: string; fetchedAt: number }>('ipo_calendar')
    if (cached && cached.list.length) return { ...cached }
  }
  const xq = await fromXueqiu()
  if (xq.length) {
    const r = { list: dedup(xq), source: '雪球 (snowball)', fetchedAt: Date.now() }
    writeCache('ipo_calendar', r)
    return r
  }
  const aas = await fromAAStocks()
  if (aas.length) {
    const r = { list: dedup(aas), source: 'AAStocks', fetchedAt: Date.now() }
    writeCache('ipo_calendar', r)
    return r
  }
  // 兜底返回上次任何成功缓存（最长 7 天）
  const stale = readCache<{ list: IpoCalendarEntry[]; source: string; fetchedAt: number }>('ipo_calendar', 7 * 24 * 3600 * 1000)
  if (stale && stale.list.length) {
    return { list: stale.list.map((e) => ({ ...e, source: 'cache' })), source: `(过期缓存) ${stale.source}`, fetchedAt: stale.fetchedAt, error: '当前所有数据源/代理均不可达，展示的是历史缓存。' }
  }
  return { list: [], source: '—', error: '所有数据源/代理均不可达。建议在「设置」配置自己的 Cloudflare Worker，或使用「粘贴 JSON / 示例数据」。' }
}

function dedup<T extends { code?: string; name: string }>(arr: T[]): T[] {
  const seen = new Set<string>()
  return arr.filter((e) => {
    const k = e.code ?? e.name
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ────────────────────────── 兜底：示例 + 手工粘贴 ──────────────────────────

export function sampleIpoCalendar(): IpoCalendarEntry[] {
  return [
    { code: '02555.HK', name: '茶百道', priceLow: 17.5, priceHigh: 17.5, lotSize: 200, listingDate: '2024-04-23', industry: '现制饮品', source: 'sample' },
    { code: '01810.HK', name: '小米集团-W', priceLow: 17, priceHigh: 22, lotSize: 200, listingDate: '示例', industry: '消费电子', source: 'sample' },
    { code: '02666.HK', name: '某科技-B', priceLow: 12.8, priceHigh: 14.5, lotSize: 500, listingDate: '2026-06-10', industry: '生物科技', source: 'sample' },
    { code: '06699.HK', name: '某新消费', priceLow: 8.0, priceHigh: 9.5, lotSize: 1000, listingDate: '2026-06-15', industry: '新茶饮', source: 'sample' },
  ]
}

export function parseClipboardCalendar(raw: string): IpoCalendarEntry[] {
  if (!raw.trim()) return []
  try {
    const j = JSON.parse(raw)
    const items: any[] = Array.isArray(j) ? j : j?.data?.items ?? j?.items ?? []
    return items
      .map((x): IpoCalendarEntry | null => {
        const code = x.code ?? x.symbol ?? x.stock_code
        const name = x.name ?? x.stock_name ?? x.SECURITY_NAME
        if (!code || !name) return null
        const padCode = String(code).replace(/[^0-9.]/g, '').padStart(5, '0').slice(0, 5)
        const toDate = (v: any) => !v ? undefined : (typeof v === 'number' ? new Date(v).toISOString().slice(0, 10) : String(v).slice(0, 10))
        return {
          code: padCode + '.HK',
          name: String(name),
          priceLow: x.priceLow ?? x.issprice_min ?? x.price_min,
          priceHigh: x.priceHigh ?? x.issprice_max ?? x.price_max,
          lotSize: x.lotSize ?? x.lot_size,
          subscriptionStart: toDate(x.apply_begin_date ?? x.subStart ?? x.subscriptionStart),
          subscriptionEnd: toDate(x.apply_end_date ?? x.subEnd ?? x.subscriptionEnd),
          listingDate: toDate(x.list_date ?? x.listingDate ?? x.LISTING_DATE),
          industry: x.industry ?? x.business?.slice(0, 30),
          source: 'manual',
          rawSnippet: x.business?.slice(0, 160),
        }
      })
      .filter(Boolean) as IpoCalendarEntry[]
  } catch {
    return raw.split('\n').map((line) => line.trim()).filter(Boolean).map((line): IpoCalendarEntry | null => {
      const codeMatch = line.match(/\b(\d{4,5})\b/)
      const priceMatch = line.match(/(\d+\.?\d*)\s*[-–~]\s*(\d+\.?\d*)/)
      const dateMatch = line.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/)
      const nameMatch = line.match(/[\u4e00-\u9fa5][\u4e00-\u9fa5A-Za-z\-\s]{1,15}/)
      if (!codeMatch && !nameMatch) return null
      return {
        code: codeMatch ? codeMatch[1].padStart(5, '0') + '.HK' : undefined,
        name: nameMatch?.[0]?.trim() ?? '未知',
        priceLow: priceMatch ? parseFloat(priceMatch[1]) : undefined,
        priceHigh: priceMatch ? parseFloat(priceMatch[2]) : undefined,
        listingDate: dateMatch?.[0],
        source: 'manual',
        rawSnippet: line,
      }
    }).filter(Boolean) as IpoCalendarEntry[]
  }
}

// ────────────────────────── 暗盘行情 ──────────────────────────

export type DarkPoolQuote = {
  code: string
  name: string
  issuePrice?: number     // 招股价（上限）
  darkPrice: number       // 暗盘最新价
  changePct: number       // 相对招股价涨幅
  high?: number
  low?: number
  volume?: number
  source: 'aastocks-dark' | 'futu-dark' | 'manual' | 'sample'
  fetchedAt: number
  rawSnippet?: string
}

// 从 AAStocks 暗盘页抓取
//   1) 即将上市的暗盘（昨日定价、今晚 4:15-6:30 PM 交易）
//   2) 已上市当天的开盘前数据
async function darkFromAAStocks(): Promise<DarkPoolQuote[]> {
  const target = 'https://www.aastocks.com/sc/stocks/market/ipo/listed/grey-market'
  const html = await fetchWithFallback(target)
  if (!html) return []
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const rows = doc.querySelectorAll('table tr')
    const out: DarkPoolQuote[] = []
    rows.forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').trim())
      if (cells.length < 4) return
      const joined = cells.join(' ')
      const codeMatch = joined.match(/\b(\d{4,5})\b/)
      const nameCell = cells.find((c) => /[\u4e00-\u9fa5]/.test(c) && c.length < 30)
      const nums = cells.map((c) => parseFloat(c.replace(/[^\d.\-]/g, ''))).filter((n) => !isNaN(n) && n > 0)
      if (!codeMatch || !nameCell || nums.length < 2) return
      const issuePrice = nums[0]
      const darkPrice = nums[1]
      const changePct = issuePrice > 0 ? ((darkPrice - issuePrice) / issuePrice) * 100 : 0
      out.push({
        code: codeMatch[1].padStart(5, '0') + '.HK',
        name: nameCell,
        issuePrice,
        darkPrice,
        changePct,
        source: 'aastocks-dark',
        fetchedAt: Date.now(),
        rawSnippet: joined.slice(0, 160),
      })
    })
    return out
  } catch (e) { console.warn('[aastocks-dark parse]', e); return [] }
}

// 从富途暗盘页面抓取（HTML 比较稳定）
async function darkFromFutu(): Promise<DarkPoolQuote[]> {
  const target = 'https://www.futunn.com/quote/hk/ipo'
  const html = await fetchWithFallback(target)
  if (!html) return []
  // 富途页面以 Next.js 渲染，原始 HTML 里含一段 JSON __NEXT_DATA__，从中提 darkQuoteList
  try {
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/)
    if (!m) return []
    const data = JSON.parse(m[1])
    const candidates: any[] =
      data?.props?.pageProps?.darkPool ??
      data?.props?.pageProps?.darkQuoteList ??
      data?.props?.pageProps?.list ?? []
    return candidates
      .map((x: any) => {
        const code = String(x.code ?? x.stockCode ?? '').replace(/[^0-9]/g, '').padStart(5, '0')
        const darkPrice = parseFloat(x.lastPrice ?? x.darkPrice ?? x.price ?? '0')
        const issuePrice = parseFloat(x.issuePrice ?? x.issPrice ?? '0')
        if (!code || isNaN(darkPrice) || darkPrice <= 0) return null
        const changePct = issuePrice > 0 ? ((darkPrice - issuePrice) / issuePrice) * 100 : parseFloat(x.changeRatio ?? '0')
        return {
          code: code + '.HK',
          name: x.name ?? x.stockName ?? '—',
          issuePrice: issuePrice || undefined,
          darkPrice,
          changePct,
          source: 'futu-dark' as const,
          fetchedAt: Date.now(),
        }
      })
      .filter(Boolean) as DarkPoolQuote[]
  } catch (e) { console.warn('[futu-dark parse]', e); return [] }
}

export async function fetchDarkPool(opts?: { useCache?: boolean }): Promise<{ list: DarkPoolQuote[]; source: string; error?: string; fetchedAt?: number }> {
  if (opts?.useCache !== false) {
    const cached = readCache<{ list: DarkPoolQuote[]; source: string; fetchedAt: number }>('dark_pool', 10 * 60 * 1000) // 10min
    if (cached && cached.list.length) return { ...cached }
  }
  const aa = await darkFromAAStocks()
  const ft = await darkFromFutu()
  // 合并去重，富途优先
  const map = new Map<string, DarkPoolQuote>()
  ft.forEach((q) => map.set(q.code, q))
  aa.forEach((q) => { if (!map.has(q.code)) map.set(q.code, q) })
  const list = Array.from(map.values())
  if (list.length) {
    const r = { list, source: `富途+AAStocks (${list.length} 支)`, fetchedAt: Date.now() }
    writeCache('dark_pool', r)
    return r
  }
  return { list: [], source: '—', error: '暗盘数据源全部不可达。如今晚有暗盘，可手工粘贴：「02555 茶百道 17.5 → 21.5」' }
}

// 暗盘手工粘贴解析（容错：JSON 或行格式 "code name issuePrice -> darkPrice"）
export function parseClipboardDarkPool(raw: string): DarkPoolQuote[] {
  if (!raw.trim()) return []
  try {
    const j = JSON.parse(raw)
    const items: any[] = Array.isArray(j) ? j : j?.data?.items ?? j?.items ?? []
    return items.map((x: any): DarkPoolQuote | null => {
      const code = x.code ?? x.symbol ?? x.stockCode
      const darkPrice = parseFloat(x.darkPrice ?? x.lastPrice ?? x.price ?? '0')
      if (!code || !darkPrice) return null
      const padCode = String(code).replace(/[^0-9]/g, '').padStart(5, '0').slice(0, 5)
      const issuePrice = parseFloat(x.issuePrice ?? x.issPrice ?? '0')
      const changePct = issuePrice > 0 ? ((darkPrice - issuePrice) / issuePrice) * 100 : parseFloat(x.changePct ?? x.changeRatio ?? '0')
      return {
        code: padCode + '.HK',
        name: x.name ?? x.stockName ?? '—',
        issuePrice: issuePrice || undefined,
        darkPrice,
        changePct,
        source: 'manual',
        fetchedAt: Date.now(),
      }
    }).filter(Boolean) as DarkPoolQuote[]
  } catch {
    return raw.split('\n').map((l) => l.trim()).filter(Boolean).map((line): DarkPoolQuote | null => {
      // 支持："02555 茶百道 17.5 -> 21.5" 或 "02555 茶百道 17.5 21.5"
      const codeMatch = line.match(/\b(\d{4,5})\b/)
      const nums = (line.match(/\d+\.?\d*/g) ?? []).map(parseFloat).filter((n) => !isNaN(n) && n > 0 && n < 10000)
      const priceNums = nums.slice(codeMatch ? 1 : 0)
      const nameMatch = line.match(/[\u4e00-\u9fa5][\u4e00-\u9fa5A-Za-z\-\s]{1,15}/)
      if (!codeMatch || priceNums.length < 2) return null
      const issuePrice = priceNums[0]
      const darkPrice = priceNums[1]
      const changePct = issuePrice > 0 ? ((darkPrice - issuePrice) / issuePrice) * 100 : 0
      return {
        code: codeMatch[1].padStart(5, '0') + '.HK',
        name: nameMatch?.[0]?.trim() ?? '—',
        issuePrice, darkPrice, changePct,
        source: 'manual', fetchedAt: Date.now(),
        rawSnippet: line,
      }
    }).filter(Boolean) as DarkPoolQuote[]
  }
}

export function sampleDarkPool(): DarkPoolQuote[] {
  return [
    { code: '02555.HK', name: '茶百道', issuePrice: 17.5, darkPrice: 14.6, changePct: -16.6, source: 'sample', fetchedAt: Date.now() },
    { code: '02666.HK', name: '某科技-B', issuePrice: 14.5, darkPrice: 18.8, changePct: 29.7, source: 'sample', fetchedAt: Date.now() },
    { code: '06699.HK', name: '某新消费', issuePrice: 9.5, darkPrice: 11.2, changePct: 17.9, source: 'sample', fetchedAt: Date.now() },
  ]
}
