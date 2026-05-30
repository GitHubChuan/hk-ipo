// 港股行情 & 新股日历自动抓取
// 浏览器跨域限制下的多重容错策略：
//   1) 行情：用 JSONP 注入 <script> 拉腾讯 qt.gtimg.cn（原生免 CORS）
//   2) 新股日历：依次尝试多个公开 CORS 代理，全部失败时返回 []，由 UI 提示用户手工粘贴

import { useStore } from './store'

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

// 通过注入 <script> 标签直接拉腾讯接口，绕过 CORS
function jsonpFetch(url: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = url
    s.async = true
    let done = false
    const timer = setTimeout(() => {
      if (done) return
      done = true
      cleanup()
      reject(new Error('JSONP timeout'))
    }, timeoutMs)
    const cleanup = () => {
      clearTimeout(timer)
      s.remove()
    }
    s.onload = () => {
      if (done) return
      done = true
      cleanup()
      // qt.gtimg.cn 把数据写入全局变量 v_xxxx，我们从 window 读出来
      resolve('OK')
    }
    s.onerror = () => {
      if (done) return
      done = true
      cleanup()
      reject(new Error('JSONP load error'))
    }
    document.head.appendChild(s)
  })
}

export async function fetchHKQuote(code: string): Promise<LiveQuote | null> {
  const key = toTencentKey(code) // r_hk02555
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
  // 串行避免同时注入太多 script
  for (const c of codes) {
    map[c] = await fetchHKQuote(c)
  }
  return map
}

// ────────────────────────── 新股日历（多代理 + 兜底） ──────────────────────────

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
  source: 'aastocks' | 'xueqiu' | 'manual' | 'sample'
  rawSnippet?: string
}

// 候选 CORS 代理 — 任何一个能用即可
function buildProxyUrls(target: string): string[] {
  const userProxy = useStore.getState().config.corsProxy?.trim()
  const enc = encodeURIComponent(target)
  const list: string[] = []
  if (userProxy) {
    // 用户自己部署的（推荐 Cloudflare Worker）
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

async function fetchWithFallback(target: string): Promise<string | null> {
  for (const url of buildProxyUrls(target)) {
    try {
      const res = await fetch(url, { method: 'GET' })
      if (!res.ok) continue
      const text = await res.text()
      if (text && text.length > 200 && !text.includes('Server-side requests are not allowed')) {
        return text
      }
    } catch (e) {
      console.warn('[proxy failed]', url, e)
    }
  }
  return null
}

// 雪球 API 解析：返回结构化的 IPO 列表（cookie 一般也能从浏览器直接发，但跨域需走代理）
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
  } catch (e) {
    console.warn('[xueqiu parse]', e)
    return []
  }
}

// AAStocks 兜底（当雪球抓不到时再试）
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
  } catch (e) {
    console.warn('[aastocks parse]', e)
    return []
  }
}

export async function fetchIpoCalendar(): Promise<{ list: IpoCalendarEntry[]; source: string; error?: string }> {
  // 优先雪球（数据干净），失败再 AAStocks
  const xq = await fromXueqiu()
  if (xq.length) return { list: dedup(xq), source: '雪球 (snowball)' }
  const aas = await fromAAStocks()
  if (aas.length) return { list: dedup(aas), source: 'AAStocks' }
  return { list: [], source: '—', error: '所有数据源/代理均不可达。建议在「设置」配置自己的 Cloudflare Worker，或直接使用「粘贴 JSON / 示例数据」。' }
}

function dedup(arr: IpoCalendarEntry[]): IpoCalendarEntry[] {
  const seen = new Set<string>()
  return arr.filter((e) => {
    const k = e.code ?? e.name
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ────────────────────────── 兜底：示例 + 手工粘贴 ──────────────────────────

// 一份示例数据（用于演示与最差情况兜底）
export function sampleIpoCalendar(): IpoCalendarEntry[] {
  return [
    { code: '02555.HK', name: '茶百道', priceLow: 17.5, priceHigh: 17.5, lotSize: 200, listingDate: '2024-04-23', industry: '现制饮品', source: 'sample' },
    { code: '01810.HK', name: '小米集团-W', priceLow: 17, priceHigh: 22, lotSize: 200, listingDate: '示例', industry: '消费电子', source: 'sample' },
    { code: '02666.HK', name: '某科技-B', priceLow: 12.8, priceHigh: 14.5, lotSize: 500, listingDate: '2026-06-10', industry: '生物科技', source: 'sample' },
    { code: '06699.HK', name: '某新消费', priceLow: 8.0, priceHigh: 9.5, lotSize: 1000, listingDate: '2026-06-15', industry: '新茶饮', source: 'sample' },
  ]
}

// 让用户手工粘贴一段 JSON（雪球 API 返回原文 / 富途网页"复制为 JSON" / 自己整理的数组都行）
export function parseClipboardCalendar(raw: string): IpoCalendarEntry[] {
  if (!raw.trim()) return []
  try {
    const j = JSON.parse(raw)
    // 雪球 API 原始结构 { data: { items: [...] } }
    const items: any[] = Array.isArray(j) ? j : j?.data?.items ?? j?.items ?? []
    return items
      .map((x): IpoCalendarEntry | null => {
        const code = x.code ?? x.symbol ?? x.stock_code
        const name = x.name ?? x.stock_name ?? x.SECURITY_NAME
        if (!code || !name) return null
        const padCode = String(code).replace(/[^0-9.]/g, '').padStart(5, '0').slice(0, 5)
        const toDate = (v: any) => {
          if (!v) return undefined
          if (typeof v === 'number') return new Date(v).toISOString().slice(0, 10)
          return String(v).slice(0, 10)
        }
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
    // 不是 JSON，则按行做简单解析（"02555 茶百道 17.5-17.5 2024-04-23"）
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line): IpoCalendarEntry | null => {
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
      })
      .filter(Boolean) as IpoCalendarEntry[]
  }
}
