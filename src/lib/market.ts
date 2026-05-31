// 港股行情 & 新股日历 & 暗盘行情 & 历史回测自动抓取
//   1) 行情：用 JSONP 注入 <script> 拉腾讯 qt.gtimg.cn（原生免 CORS）
//   2) 新股日历：依次尝试多个公开 CORS 代理，失败用缓存
//   3) 暗盘：AAStocks 暗盘页 / 富途暗盘 多源 + 缓存
//   4) 历史回测：内置数据集 + 手工粘贴（可参考 i668.vip）

import { useStore } from './store'
import type { HistoricalIpo } from './types'

// ────────────────────────── 通用工具 ──────────────────────────

const CACHE_KEY_PREFIX = 'hk_ipo_market_cache_v6::'
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
  mechanism?: 'B' | '18C' | 'A' | 'SPAC' | 'GEM' | 'OTHER'
  issueLots?: number
  issueAmount?: number      // 万 HKD
  entryFeeMid?: number      // HKD
  status?: '招股中' | '待上市' | '已上市' | '即将招股'
  source: 'aastocks' | 'xueqiu' | 'manual' | 'sample' | 'cache' | 'i668'
  rawSnippet?: string
}

async function fromI668(): Promise<IpoCalendarEntry[]> {
  // i668.vip/stocks 是手工维护的权威源，有 status 列（招股中/待上市/已上市）
  const target = 'https://www.i668.vip/stocks'
  const html = await fetchWithFallback(target, 500)
  if (!html) return []
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const rows = doc.querySelectorAll('table tr')
    const out: IpoCalendarEntry[] = []
    rows.forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').trim())
      if (cells.length < 5) return
      // i668 例：02290 龙丰集团 | 机制B | 招股中 | 5.180-6.380 | 500 | 3,223 | 25,000 | 2026-06-05
      const codeNameMatch = cells[0].match(/(\d{4,5})\s+(.+)/)
      if (!codeNameMatch) return
      const code = codeNameMatch[1].padStart(5, '0') + '.HK'
      const name = codeNameMatch[2].trim()
      const mechCell = cells[1] || ''
      const statusCell = cells[2] || ''
      const priceCell = cells[3] || ''
      const lotSize = parseInt(cells[4]?.replace(/[,\s]/g, '') || '0', 10) || undefined
      const entryFee = parseInt(cells[5]?.replace(/[,\s]/g, '') || '0', 10) || undefined
      const issueLots = parseInt(cells[6]?.replace(/[,\s]/g, '') || '0', 10) || undefined
      const listingDate = cells[7]?.match(/\d{4}-\d{2}-\d{2}/)?.[0]

      const priceMatch = priceCell.match(/(\d+\.?\d*)\s*[-–—]?\s*(\d+\.?\d*)?/)
      const priceLow = priceMatch?.[1] ? parseFloat(priceMatch[1]) : undefined
      const priceHigh = priceMatch?.[2] ? parseFloat(priceMatch[2]) : priceLow

      const mechanism: any = mechCell.includes('18C') ? '18C' :
        mechCell.includes('SPAC') ? 'SPAC' :
        mechCell.includes('GEM') ? 'GEM' :
        mechCell.includes('B') ? 'B' :
        mechCell.includes('A') ? 'A' : undefined

      const status: any = statusCell.includes('招股中') ? '招股中' :
        statusCell.includes('待上市') ? '待上市' :
        statusCell.includes('已上市') ? '已上市' :
        statusCell.includes('即将') ? '即将招股' : undefined

      out.push({
        code, name,
        priceLow, priceHigh, lotSize,
        listingDate,
        mechanism,
        issueLots,
        entryFeeMid: entryFee,
        status,
        source: 'i668',
      })
    })
    return out
  } catch (e) { console.warn('[i668 parse]', e); return [] }
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
      const joined = cells.join(' ')
      const codeMatch = joined.match(/\b(\d{4,5})\b/)
      const dateMatch = joined.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
      const priceMatch = joined.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/)
      const nameCell = cells.find((c) => /[\u4e00-\u9fa5]/.test(c) && c.length < 30) ?? cells[1]
      if (!nameCell || !codeMatch) return
      // 统一日期格式为 ISO 8601 YYYY-MM-DD
      const isoDate = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
        : undefined
      // 尝试抽 lot size（每手）：典型为 100/200/500/1000，且后面常带「股」字或紧跟数量列
      const lotMatch = joined.match(/\b(50|100|200|250|500|1000|2000)\s*(?:股)?\b/)
      // 尝试抽 issueLots（公开发售手数）：通常 5 位以上整数 + 千分位
      const issueLotsMatch = joined.match(/(\d{1,3}(?:,\d{3}){1,2})\s*(?:手|lots)?/i)
      out.push({
        code: codeMatch[1].padStart(5, '0') + '.HK',
        name: nameCell.replace(/[\d\.\-\s]+$/g, '').trim(),
        priceLow: priceMatch ? parseFloat(priceMatch[1]) : undefined,
        priceHigh: priceMatch ? parseFloat(priceMatch[2]) : undefined,
        lotSize: lotMatch ? parseInt(lotMatch[1], 10) : undefined,
        issueLots: issueLotsMatch ? parseInt(issueLotsMatch[1].replace(/,/g, ''), 10) : undefined,
        listingDate: isoDate,
        source: 'aastocks',
        rawSnippet: joined.slice(0, 160),
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

  // ⭐ 关键：拿到的远端数据，对相同 code 的标的，用 sample 的 status / lotSize / mechanism / listingDate 覆盖
  // 因为远端（AAStocks）通常没有 status，且经常滞后；sample 是手工对照富途/i668 维护的最权威源
  const sampleByCode = getSampleStatusMap()
  const merge = (list: IpoCalendarEntry[]): IpoCalendarEntry[] => {
    // 1. 用 sample 覆盖远端
    const out = list.map((e) => {
      if (!e.code) return e
      const s = sampleByCode[e.code]
      if (!s) return e
      return {
        ...e,
        // sample 字段优先，远端 fallback
        name: s.name || e.name,
        priceLow: s.priceLow ?? e.priceLow,
        priceHigh: s.priceHigh ?? e.priceHigh,
        lotSize: s.lotSize ?? e.lotSize,
        listingDate: s.listingDate ?? e.listingDate,
        subscriptionEnd: s.subscriptionEnd ?? e.subscriptionEnd,
        mechanism: s.mechanism ?? e.mechanism,
        issueLots: s.issueLots ?? e.issueLots,
        issueAmount: s.issueAmount ?? e.issueAmount,
        entryFeeMid: s.entryFeeMid ?? e.entryFeeMid,
        status: s.status,  // 一定用 sample 的 status（最准）
      }
    })
    // 2. 把 sample 中远端没拉到的标的补进来（招股中容易被远端漏）
    const remoteCodes = new Set(out.map((e) => e.code).filter(Boolean))
    for (const [code, s] of Object.entries(sampleByCode)) {
      if (!remoteCodes.has(code)) out.unshift(s)
    }
    return out
  }

  // 优先级：i668（有 status 手工维护权威）→ 雪球 → AAStocks → 全失败时直接用 sample
  const i668 = await fromI668()
  if (i668.length) {
    const r = { list: dedup(merge(i668)), source: 'i668.vip + 手工校对', fetchedAt: Date.now() }
    writeCache('ipo_calendar', r)
    return r
  }
  const xq = await fromXueqiu()
  if (xq.length) {
    const r = { list: dedup(merge(xq)), source: '雪球 + 手工校对', fetchedAt: Date.now() }
    writeCache('ipo_calendar', r)
    return r
  }
  const aas = await fromAAStocks()
  if (aas.length) {
    const r = { list: dedup(merge(aas)), source: 'AAStocks + 手工校对', fetchedAt: Date.now() }
    writeCache('ipo_calendar', r)
    return r
  }
  // 全部代理都挂了 → 直接返回 sample（手工维护的权威源）
  const fallback = sampleIpoCalendar()
  if (fallback.length) {
    const r = { list: fallback, source: '手工维护源（i668 + 富途 校对）', fetchedAt: Date.now() }
    return { ...r, error: '远端代理均不可达，已加载手工维护数据。' }
  }
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

// ────────────────────────── 示例 + 手工粘贴 ──────────────────────────

export function sampleIpoCalendar(): IpoCalendarEntry[] {
  // 数据源：富途 + i668.vip/stocks（手工维护的权威源，每次部署前刷新）
  // status 由 sample 维护，CalendarTab.inferStatus 第一条铁律会用 today > listingDate 自动覆盖过期为「已上市」
  // 与抓取的 AAStocks/雪球数据按 code 合并，sample 的 status 字段优先（更准）
  // ⚠ 维护说明：每次新股上市后，把"招股中"的标的状态改为"已上市"并保留至少 7 天，便于用户复盘
  return [
    // ─── 招股中（subscribing） ───
    { code: '02290.HK', name: '龙丰集团',  priceLow: 5.18,  priceHigh: 6.38,  lotSize: 500, listingDate: '2026-06-05', subscriptionEnd: '2026-06-02', mechanism: 'B', issueLots: 25000, issueAmount: 1450,  entryFeeMid: 3223, status: '招股中', source: 'i668' },
    { code: '01081.HK', name: '大金重工',  priceLow: 66.4,  priceHigh: 66.4,  lotSize: 100, listingDate: '2026-06-05', subscriptionEnd: '2026-06-02', mechanism: 'B', issueLots: 86966, issueAmount: 57746, entryFeeMid: 6707, status: '招股中', source: 'i668' },
    { code: '01779.HK', name: '天辰生物-B', priceLow: 96.06, priceHigh: 96.06, lotSize: 50,  listingDate: '2026-06-05', subscriptionEnd: '2026-06-02', mechanism: 'B', issueLots: 28387, issueAmount: 13632, entryFeeMid: 4852, status: '招股中', source: 'i668' },
    { code: '02553.HK', name: '首钢朗泽',  priceLow: 14.6,  priceHigh: 17.1,  lotSize: 200, listingDate: '2026-06-03', subscriptionEnd: '2026-05-29', mechanism: 'B', issueLots: 20000, issueAmount: 3420,  entryFeeMid: 3455, status: '待上市', source: 'i668' },
    // ─── 最近 7 天已上市（用于复盘 / 暗盘对照 / 防止误归"待上市"） ───
    { code: '03418.HK', name: '华夏数字黄金',     priceLow: 7.78,  priceHigh: 7.78,  lotSize: 100, listingDate: '2026-05-29', mechanism: 'OTHER', status: '已上市', source: 'i668' },
    { code: '09418.HK', name: '华夏数字黄金-U',   priceLow: 1.0,   priceHigh: 1.0,   lotSize: 100, listingDate: '2026-05-29', mechanism: 'OTHER', status: '已上市', source: 'i668' },
    { code: '83418.HK', name: '华夏数字黄金-R',   priceLow: 7.78,  priceHigh: 7.78,  lotSize: 100, listingDate: '2026-05-29', mechanism: 'OTHER', status: '已上市', source: 'i668' },
    { code: '03388.HK', name: '创想三维',          priceLow: 18.8,  priceHigh: 18.8,  lotSize: 200, listingDate: '2026-05-29', mechanism: 'B', status: '已上市', source: 'i668' },
    { code: '03310.HK', name: '云英谷科技',        priceLow: 20.81, priceHigh: 20.81, lotSize: 200, listingDate: '2026-05-27', mechanism: 'B', status: '已上市', source: 'i668' },
  ]
}

// 从 sample 中提取最近上市/招股的 code → status 映射，作为与抓取数据融合时的权威覆盖
export function getSampleStatusMap(): Record<string, IpoCalendarEntry> {
  const map: Record<string, IpoCalendarEntry> = {}
  for (const e of sampleIpoCalendar()) {
    if (e.code) map[e.code] = e
  }
  return map
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
          mechanism: x.mechanism,
          issueLots: x.issueLots ?? x.issue_lots,
          issueAmount: x.issueAmount ?? x.issue_amount,
          entryFeeMid: x.entryFeeMid ?? x.entry_fee_mid,
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
  issuePrice?: number
  darkPrice: number
  changePct: number
  high?: number
  low?: number
  volume?: number
  source: 'aastocks-dark' | 'futu-dark' | 'manual' | 'sample'
  fetchedAt: number
  rawSnippet?: string
}

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

async function darkFromFutu(): Promise<DarkPoolQuote[]> {
  const target = 'https://www.futunn.com/quote/hk/ipo'
  const html = await fetchWithFallback(target)
  if (!html) return []
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
    const cached = readCache<{ list: DarkPoolQuote[]; source: string; fetchedAt: number }>('dark_pool', 10 * 60 * 1000)
    if (cached && cached.list.length) return { ...cached }
  }
  const aa = await darkFromAAStocks()
  const ft = await darkFromFutu()
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

// ────────────────────────── 历史招股回测（参考 i668.vip） ──────────────────────────

// 内置基础数据集 — 来自 i668.vip/stocks + /subscription + /profit 横切
// 数据格式：[code, name, listingDate, mechanism, priceLow, priceHigh, issuePrice, lotSize,
//            entryFee, issueLots, issueAmount(万), subscriptionMultiple,
//            subscriptionAmount(亿), applicants, winners, intlAllocMultiple,
//            darkChangePct, firstDayChangePct, profitPerLot]
const HISTORICAL_SEED: HistoricalIpo[] = [
  { code: '03388', name: '创想三维',   listingDate: '2026-05-29', mechanism: 'B',   priceLow: 18.8,  priceHigh: 18.8,   issuePrice: 18.8,   lotSize: 150, entryFee: 2849,  issueLots: 48952, issueAmount: 13800, subscriptionMultiple: 3829.42, subscriptionAmount: 5286.31, applicants: 251375, winners: 44336, intlAllocMultiple: 26.80, darkChangePct: 60.85, firstDayChangePct: 58.94, profitPerLot: 1663.82 },
  { code: '03310', name: '云英谷科技', listingDate: '2026-05-27', mechanism: 'B',   priceLow: 20.81, priceHigh: 20.81,  issuePrice: 20.81,  lotSize: 200, entryFee: 4204,  issueLots: 26430, issueAmount: 11000, subscriptionMultiple: 3559.68, subscriptionAmount: 3915.71, applicants: 242444, winners: 25707, intlAllocMultiple:  7.05, darkChangePct: 20.52, firstDayChangePct: 18.93, profitPerLot:  787.10 },
  { code: '02723', name: '深演智能',   listingDate: '2026-05-27', mechanism: 'B',   priceLow: 43.5,  priceHigh: 55.5,   issuePrice: 55.5,   lotSize: 100, entryFee: 5606,  issueLots:  9068, issueAmount:  5033, subscriptionMultiple: 5480.23, subscriptionAmount: 2758.06, applicants: 232456, winners:  9068, intlAllocMultiple:  3.41, darkChangePct: 168.47, firstDayChangePct: 165.13, profitPerLot: 9256.31 },
  { code: '00901', name: '华曦达',     listingDate: '2026-05-27', mechanism: 'B',   priceLow: 32.8,  priceHigh: 32.8,   issuePrice: 32.8,   lotSize: 100, entryFee: 3314,  issueLots: 19208, issueAmount:  6300, subscriptionMultiple: 1971.99, subscriptionAmount: 1242.40, applicants: 177196, winners: 17058, intlAllocMultiple:  2.23, darkChangePct: 93.60, firstDayChangePct: 91.78, profitPerLot: 3010.49 },
  { code: '06872', name: '丹诺医药',   listingDate: '2026-05-22', mechanism: 'B',   priceLow: 75.7,  priceHigh: 75.7,   issuePrice: 75.7,   lotSize:  50, entryFee: 3824,  issueLots: 16562, issueAmount:  6269, subscriptionMultiple: 9015.11, subscriptionAmount: 5651.32, applicants: 275978, winners: 16562, intlAllocMultiple:  9.24, darkChangePct: 94.19, firstDayChangePct: 92.55, profitPerLot: 3499.01 },
  { code: '07688', name: '拓璞数控',   listingDate: '2026-05-20', mechanism: 'B',   priceLow: 26.39, priceHigh: 26.39,  issuePrice: 26.39,  lotSize: 100, entryFee: 2666,  issueLots: 65330, issueAmount: 17200, subscriptionMultiple: 3764.63, subscriptionAmount: 6490.44, applicants: 344049, winners: 56482, intlAllocMultiple: 30.46, darkChangePct: 47.78, firstDayChangePct: 45.93, profitPerLot: 1211.89 },
  { code: '01511', name: '驭势科技',   listingDate: '2026-05-20', mechanism: '18C', priceLow: 60.3,  priceHigh: 60.3,   issuePrice: 60.3,   lotSize:  50, entryFee: 3046,  issueLots: 14462, issueAmount:  4360, subscriptionMultiple: 6777.29, subscriptionAmount: 2955.10, applicants: 285972, winners: 48689, intlAllocMultiple:  5.66, darkChangePct:  0.08, firstDayChangePct: -1.66, profitPerLot:  -50.06 },
  { code: '06871', name: '翼菲科技',   listingDate: '2026-05-18', mechanism: '18C', priceLow: 30.5,  priceHigh: 30.5,   issuePrice: 30.5,   lotSize: 100, entryFee: 3081,  issueLots: 12300, issueAmount:  3752, subscriptionMultiple:14855.40, subscriptionAmount: 5573.00, applicants: 330334, winners: 48611, intlAllocMultiple:  9.77, darkChangePct: 75.57, firstDayChangePct: 73.05, profitPerLot: 2249.19 },
  { code: '07666', name: '剂泰科技',   listingDate: '2026-05-13', mechanism: '18C', priceLow: 10.5,  priceHigh: 10.5,   issuePrice: 10.5,   lotSize: 500, entryFee: 5303,  issueLots: 20123, issueAmount: 10600, subscriptionMultiple: 6910.96, subscriptionAmount: 7301.14, applicants: 383309, winners: 65740, intlAllocMultiple: 33.86, darkChangePct: 188.76, firstDayChangePct: 185.10, profitPerLot: 9818.24 },
  { code: '07630', name: '英派药业',   listingDate: '2026-05-13', mechanism: 'B',   priceLow: 19.75, priceHigh: 21.75,  issuePrice: 20.10,  lotSize: 200, entryFee: 4394,  issueLots: 20989, issueAmount:  8438, subscriptionMultiple: 2282.40, subscriptionAmount: 1925.79, applicants: 221788, winners: 18774, intlAllocMultiple: 24.58, darkChangePct: 60.70, firstDayChangePct: 58.92, profitPerLot: 2372.98 },
  { code: '01236', name: '乐动机器人', listingDate: '2026-05-11', mechanism: 'B',   priceLow: 24.0,  priceHigh: 30.0,   issuePrice: 26.36,  lotSize: 200, entryFee: 6061,  issueLots: 16667, issueAmount:  8787, subscriptionMultiple: 6707.66, subscriptionAmount: 5893.92, applicants: 296740, winners: 16667, intlAllocMultiple:  9.54, darkChangePct: 88.92, firstDayChangePct: 86.20, profitPerLot: 4604.01 },
  { code: '01187', name: '可孚医疗',   listingDate: '2026-05-06', mechanism: 'B',   priceLow: 39.33, priceHigh: 39.33,  issuePrice: 39.33,  lotSize: 100, entryFee: 3973,  issueLots: 27000, issueAmount: 10600, subscriptionMultiple:  399.08, subscriptionAmount:  423.79, applicants: 105939, winners: 15008, intlAllocMultiple:  3.40, darkChangePct:  1.86, firstDayChangePct:  0.25, profitPerLot:   10.00 },
  { code: '01609', name: '天星医疗',   listingDate: '2026-05-05', mechanism: 'B',   priceLow: 98.5,  priceHigh: 98.5,   issuePrice: 98.5,   lotSize:  50, entryFee: 4975,  issueLots: 16844, issueAmount:  8296, subscriptionMultiple: 7823.13, subscriptionAmount: 6489.81, applicants: 300735, winners: 16844, intlAllocMultiple: 10.41, darkChangePct: 194.42, firstDayChangePct: 190.55, profitPerLot: 9487.97 },
  { code: '06810', name: '商米科技-W', listingDate: '2026-04-29', mechanism: 'B',   priceLow: 24.86, priceHigh: 24.86,  issuePrice: 24.86,  lotSize: 100, entryFee: 2512,  issueLots: 42627, issueAmount: 10600, subscriptionMultiple: 2003.16, subscriptionAmount: 2122.76, applicants: 204939, winners: 32542, intlAllocMultiple:  7.91, darkChangePct: 276.71, firstDayChangePct: 271.65, profitPerLot: 6823.34 },
  { code: '01879', name: '曦智科技-P', listingDate: '2026-04-28', mechanism: '18C', priceLow: 166.6, priceHigh: 183.2,  issuePrice: 183.2,  lotSize:  15, entryFee: 2776,  issueLots: 45985, issueAmount: 12600, subscriptionMultiple: 5784.70, subscriptionAmount: 7309.94, applicants: 378085, winners:134609, intlAllocMultiple: 53.83, darkChangePct: 351.15, firstDayChangePct: 345.50, profitPerLot: 9587.14 },
  { code: '02493', name: '迈威生物-B', listingDate: '2026-04-28', mechanism: 'B',   priceLow: 27.64, priceHigh: 30.71,  issuePrice: 27.64,  lotSize: 200, entryFee: 6204,  issueLots: 23566, issueAmount: 13000, subscriptionMultiple:  481.71, subscriptionAmount:  627.54, applicants: 126378, winners: 14808, intlAllocMultiple:  3.46, darkChangePct:  2.89, firstDayChangePct:  1.30, profitPerLot:   78.87 },
  { code: '03296', name: '华勤技术',   listingDate: '2026-04-23', mechanism: 'B',   priceLow: 77.7,  priceHigh: 77.7,   issuePrice: 77.7,   lotSize: 100, entryFee: 7849,  issueLots: 58549, issueAmount: 45500, subscriptionMultiple:  531.33, subscriptionAmount: 2417.16, applicants: 140150, winners: 42660, intlAllocMultiple: 13.34, darkChangePct: 20.98, firstDayChangePct: 19.40, profitPerLot: 1521.13 },
  { code: '02476', name: '胜宏科技',   listingDate: '2026-04-21', mechanism: 'B',   priceLow: 209.88,priceHigh: 209.88, issuePrice: 209.88, lotSize: 100, entryFee: 21200, issueLots: 83348, issueAmount:174900, subscriptionMultiple:  431.15, subscriptionAmount: 7542.14, applicants: 250606, winners: 57137, intlAllocMultiple:  1.00, darkChangePct: 58.66, firstDayChangePct: 57.35, profitPerLot:12036.17 },
  { code: '00068', name: '群核科技',   listingDate: '2026-04-17', mechanism: 'B',   priceLow:  6.72, priceHigh:  7.62,  issuePrice:  7.62,  lotSize: 500, entryFee: 3849,  issueLots: 32124, issueAmount: 12200, subscriptionMultiple: 1590.56, subscriptionAmount: 1946.73, applicants: 240700, winners: 28487, intlAllocMultiple: 14.46, darkChangePct: 157.22, firstDayChangePct: 153.85, profitPerLot: 5920.82 },
  { code: '03277', name: '长光辰芯',   listingDate: '2026-04-17', mechanism: 'B',   priceLow: 39.88, priceHigh: 39.88,  issuePrice: 39.88,  lotSize: 100, entryFee: 4029,  issueLots: 65295, issueAmount: 26000, subscriptionMultiple: 1138.21, subscriptionAmount: 2963.86, applicants: 266501, winners: 45516, intlAllocMultiple: 22.69, darkChangePct: 71.26, firstDayChangePct: 69.95, profitPerLot: 2774.96 },
]

export function getHistoricalIpos(): HistoricalIpo[] {
  const cached = readCache<HistoricalIpo[]>('historical_ipos', 7 * 24 * 3600 * 1000)
  if (cached && cached.length) return cached
  return HISTORICAL_SEED
}

export function saveHistoricalIpos(list: HistoricalIpo[]) {
  writeCache('historical_ipos', list)
}

// 解析手工粘贴的 i668 表格行
// 支持："03388 创想三维 20260529 48,952 1.38亿 3829.42 5286.31亿 251,375 44,336 26.80 +60.85%"
export function parseHistoricalPaste(raw: string): HistoricalIpo[] {
  if (!raw.trim()) return []
  // JSON 优先
  try {
    const j = JSON.parse(raw)
    if (Array.isArray(j)) return j as HistoricalIpo[]
  } catch {}
  // 行解析
  const parseAmount = (s: string): number | undefined => {
    if (!s) return undefined
    const cleaned = s.replace(/,/g, '').trim()
    const m = cleaned.match(/^([\d.]+)\s*(亿|万)?/)
    if (!m) return undefined
    const n = parseFloat(m[1])
    if (isNaN(n)) return undefined
    if (m[2] === '亿') return n * 10000   // 转为「万」
    return n
  }
  const out: HistoricalIpo[] = []
  for (const lineRaw of raw.split('\n')) {
    const line = lineRaw.trim()
    if (!line) continue
    const codeMatch = line.match(/\b(\d{4,5})\b/)
    if (!codeMatch) continue
    const nameMatch = line.match(/[\u4e00-\u9fa5][\u4e00-\u9fa5A-Za-z\-]{1,15}/)
    const dateMatch = line.match(/(\d{4})[-/]?(\d{2})[-/]?(\d{2})/)
    const pctMatches = [...line.matchAll(/([+-]?[\d.]+)\s*%/g)]
    const restNums = line.replace(/[\u4e00-\u9fa5\-/]/g, ' ').split(/\s+/).filter(Boolean)
      .map((t) => parseFloat(t.replace(/[,亿万]/g, ''))).filter((n) => !isNaN(n))

    out.push({
      code: codeMatch[1].padStart(5, '0'),
      name: nameMatch?.[0] ?? '—',
      listingDate: dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '',
      lotSize: 100,
      darkChangePct: pctMatches.length ? parseFloat(pctMatches[0][1]) : undefined,
      firstDayChangePct: pctMatches.length > 1 ? parseFloat(pctMatches[1][1]) : undefined,
      issueLots: restNums.find((n) => n > 1000 && n < 1000000),
      issueAmount: parseAmount(line.match(/[\d.,]+\s*亿/)?.[0] ?? ''),
      subscriptionMultiple: restNums.find((n) => n > 50 && n < 100000),
    })
  }
  return out
}
