import { useState } from 'react'
import { useStore, useIsAdmin } from '@/lib/store'
import {
  fetchIpoCalendar,
  fetchManyQuotes,
  parseClipboardCalendar,
  sampleIpoCalendar,
  type IpoCalendarEntry,
} from '@/lib/market'
import {
  SectionTitle,
  Tag,
  PrimaryButton,
  GhostButton,
  Field,
  TextInput,
  EmptyState,
  Pct,
  InfoTip,
} from '@/components/shared/Editorial'

export default function CalendarTab() {
  const { ipos, addIpo, updateIpo, config, updateConfig } = useStore()
  const isAdmin = useIsAdmin()
  const [calendar, setCalendar] = useState<IpoCalendarEntry[]>([])
  const [source, setSource] = useState<string>('—')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshingQuotes, setRefreshingQuotes] = useState(false)
  const [lastSync, setLastSync] = useState<number | null>(null)
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const sync = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetchIpoCalendar()
      setCalendar(r.list)
      setSource(r.source)
      setLastSync(Date.now())
      if (r.list.length === 0) {
        setError(r.error ?? '未抓到任何数据。可能因为公开 CORS 代理被限流或目标站防爬。建议改用「粘贴 JSON」或「加载示例」。')
      }
    } catch (e: any) {
      setError(`抓取失败：${e?.message ?? '未知错误'}`)
    }
    setLoading(false)
  }

  const loadSample = () => {
    setCalendar(sampleIpoCalendar())
    setSource('示例数据')
    setLastSync(Date.now())
    setError(null)
  }

  const submitPaste = () => {
    const list = parseClipboardCalendar(pasteText)
    if (list.length === 0) {
      alert('解析不到有效数据。可粘贴雪球新股 API 的 JSON，或每行一支「02555 茶百道 17.5-17.5 2024-04-23」格式')
      return
    }
    setCalendar(list)
    setSource('手工粘贴')
    setLastSync(Date.now())
    setShowPaste(false)
    setPasteText('')
  }

  const refreshQuotes = async () => {
    setRefreshingQuotes(true)
    const liveCodes = ipos.filter((i) => ['subscribed', 'listed'].includes(i.status)).map((i) => i.code)
    if (liveCodes.length === 0) {
      alert('当前没有「已申购 / 已上市」状态的标的，无须刷新行情')
      setRefreshingQuotes(false)
      return
    }
    const map = await fetchManyQuotes(liveCodes)
    let updated = 0
    ipos.forEach((i) => {
      const q = map[i.code]
      if (q && !isNaN(q.price)) {
        updateIpo(i.id, {
          liveQuote: { price: q.price, changePct: q.changePct, fetchedAt: q.fetchedAt },
          listingOpenPrice: i.listingOpenPrice ?? q.open ?? q.price,
        })
        updated++
      }
    })
    setRefreshingQuotes(false)
    alert(`已刷新 ${updated} / ${liveCodes.length} 支行情 ✓`)
  }

  const importEntry = (e: IpoCalendarEntry) => {
    if (!isAdmin) return alert('只有超级管理员可以批量导入')
    const exists = ipos.find((x) => e.code && x.code === e.code)
    if (exists) {
      updateIpo(exists.id, {
        priceLow: e.priceLow ?? exists.priceLow,
        priceHigh: e.priceHigh ?? exists.priceHigh,
        listingDate: e.listingDate,
      })
      return alert(`${e.name} 已存在，已合并更新`)
    }
    const priceHigh = e.priceHigh ?? 0
    addIpo({
      code: e.code ?? '',
      name: e.name,
      industry: e.industry,
      priceLow: e.priceLow ?? 0,
      priceHigh,
      lotSize: e.lotSize ?? 100,
      entryFee: priceHigh * (e.lotSize ?? 100) * 1.0077,
      status: 'watching',
      listingDate: e.listingDate,
      aiQualityScore: 6,
      expectedRise: 8,
      oversubMultiple: 30,
      redShoeBoost: 1.4,
    })
  }

  const importAll = () => {
    if (!isAdmin || calendar.length === 0) return
    if (!confirm(`确定批量导入 ${calendar.length} 支新股到评估台？已存在的会合并更新。`)) return
    calendar.forEach(importEntry)
    alert(`完成 ✓`)
  }

  const liveListings = ipos.filter((i) => i.liveQuote)

  return (
    <div className="space-y-12">
      <SectionTitle
        index="II"
        en="IPO Calendar & Live Quotes"
        zh="新股日历 · 实时行情"
        desc="自动抓取雪球 / AAStocks 新股行情，腾讯港股盘中报价。如代理不通，可粘贴 JSON 或加载示例数据兜底。"
      />

      {/* 数据源 + 操作 */}
      <section className="border border-ink p-5 bg-paper-2/40">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">DATA SOURCE · 数据源</div>
          <div className="flex items-center gap-2">
            <Tag variant="mute">来源：{source}</Tag>
            <Tag variant="mute">{lastSync ? `${new Date(lastSync).toLocaleTimeString()}` : '尚未同步'}</Tag>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
          <div className="md:col-span-5">
            <Field label="自定义代理（可选，留空则自动尝试公开代理）" hint="推荐部署自己的 Cloudflare Worker；URL 末尾 ? 或 / 自动适配">
              <TextInput
                value={config.corsProxy}
                onChange={(e) => updateConfig({ corsProxy: e.target.value })}
                disabled={!isAdmin}
                placeholder="留空自动 / 或填 https://your-worker.workers.dev/?"
              />
            </Field>
          </div>
          <div className="md:col-span-7 flex flex-wrap gap-2">
            <PrimaryButton onClick={sync} disabled={loading}>
              {loading ? '抓取中…' : '抓取新股日历'}
            </PrimaryButton>
            <GhostButton onClick={refreshQuotes} disabled={refreshingQuotes}>
              {refreshingQuotes ? '刷新中…' : '刷新港股行情'}
            </GhostButton>
            <GhostButton onClick={() => setShowPaste((v) => !v)}>粘贴 JSON</GhostButton>
            <GhostButton onClick={loadSample}>加载示例</GhostButton>
            {isAdmin && calendar.length > 0 && (
              <PrimaryButton onClick={importAll} className="bg-accent">一键全部导入</PrimaryButton>
            )}
          </div>
        </div>

        {showPaste && (
          <div className="mt-5 border border-rule p-4 bg-paper">
            <div className="text-[10px] uppercase tracking-widest text-ink-mute mb-2">PASTE JSON · 粘贴雪球 / 富途新股 API 原始数据</div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              placeholder='示例：在浏览器打开 https://stock.xueqiu.com/v5/stock/preipo/hk/list.json?type=4&page=1&size=30 把整个 JSON 复制到这里。或每行一支：02555 茶百道 17.5-17.5 2024-04-23'
              className="w-full font-mono text-xs border border-rule p-2 bg-paper-2"
            />
            <div className="flex gap-2 mt-2">
              <PrimaryButton onClick={submitPaste}>解析并加载</PrimaryButton>
              <GhostButton onClick={() => { setShowPaste(false); setPasteText('') }}>取消</GhostButton>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 border-l-4 border-accent pl-3 py-2 text-sm text-accent bg-accent/5">
            {error}
            <div className="text-xs text-ink-soft mt-2 italic">
              建议：① 在 Cloudflare 部署一个 5 行的 Worker 做你专属代理；② 直接用「粘贴 JSON」从浏览器手动喂数据；③ 用「加载示例」先体验 UI。
            </div>
          </div>
        )}
      </section>

      {/* 实时行情 */}
      <section>
        <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
          <h3 className="font-serif text-2xl">持仓盘中行情</h3>
          <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">LIVE QUOTES</span>
        </div>
        {liveListings.length === 0 ? (
          <EmptyState title="暂无行情数据" hint="点击右上「刷新港股行情」拉取已申购/已上市标的（直连腾讯，无需代理）。" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {liveListings.map((ipo) => {
              const q = ipo.liveQuote!
              const up = q.changePct >= 0
              return (
                <div key={ipo.id} className="border border-rule p-4 bg-paper-2/40">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-serif text-lg leading-tight">{ipo.name}</div>
                    <Tag variant={up ? 'accent' : 'success'}>{up ? '涨' : '跌'}</Tag>
                  </div>
                  <div className="text-xs font-mono text-ink-mute mb-3">{ipo.code}</div>
                  <div className={`num display text-3xl ${up ? 'text-accent' : 'text-accent-2'}`}>
                    HK$ {q.price.toFixed(2)}
                  </div>
                  <div className={`text-sm font-mono mt-1 ${up ? 'text-accent' : 'text-accent-2'}`}>
                    <InfoTip
                      title="对发行价的相对涨幅"
                      formula="(今价 - 招股价上限) / 招股价上限 × 100%"
                      steps={[
                        { label: '今价', value: `HK$ ${q.price.toFixed(2)}` },
                        { label: '招股价上限', value: `HK$ ${ipo.priceHigh.toFixed(2)}` },
                        { label: '涨幅', value: Pct(((q.price - ipo.priceHigh) / ipo.priceHigh) * 100) },
                      ]}
                    >
                      vs 发行价 {Pct(((q.price - ipo.priceHigh) / ipo.priceHigh) * 100)}
                    </InfoTip>
                  </div>
                  <div className="text-[10px] text-ink-mute mt-2">
                    {new Date(q.fetchedAt).toLocaleTimeString()} · 日内 {Pct(q.changePct)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* 新股清单 */}
      <section>
        <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
          <h3 className="font-serif text-2xl">即将上市 / 招股中</h3>
          <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">UPCOMING IPO · {calendar.length}</span>
        </div>
        {calendar.length === 0 ? (
          <EmptyState
            title="尚未抓取"
            hint='第一次使用建议先点「加载示例」体验 UI；正式使用建议「粘贴 JSON」或部署 Cloudflare Worker。'
          />
        ) : (
          <div className="space-y-2">
            {calendar.map((e, i) => (
              <article key={`${e.code ?? e.name}-${i}`} className="grid grid-cols-12 gap-3 items-center border border-rule p-3 bg-paper">
                <div className="col-span-1 text-center font-serif text-2xl text-ink-mute">{String(i + 1).padStart(2, '0')}</div>
                <div className="col-span-3">
                  <div className="font-serif text-lg">{e.name}</div>
                  <div className="text-xs font-mono text-ink-mute">{e.code ?? '—'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] uppercase tracking-widest text-ink-mute">招股价</div>
                  <div className="num text-sm">{e.priceLow && e.priceHigh ? `HK$ ${e.priceLow}–${e.priceHigh}` : '—'}</div>
                  {e.lotSize && <div className="text-[10px] text-ink-soft">每手 {e.lotSize}</div>}
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] uppercase tracking-widest text-ink-mute">上市日期</div>
                  <div className="num text-sm">{e.listingDate ?? '—'}</div>
                  {e.subscriptionEnd && <div className="text-[10px] text-ink-soft">截止 {e.subscriptionEnd}</div>}
                </div>
                <div className="col-span-3 text-xs text-ink-mute font-mono italic truncate" title={e.rawSnippet}>
                  {e.industry ?? e.rawSnippet}
                </div>
                <div className="col-span-1 text-right">
                  {isAdmin && (
                    <button
                      onClick={() => importEntry(e)}
                      className="text-[10px] uppercase tracking-widest underline underline-offset-4 hover:text-accent"
                    >
                      导入 →
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 部署自己的代理指南 */}
      {isAdmin && (
        <section className="border-2 border-dashed border-rule p-5 bg-paper-2/30">
          <h3 className="font-serif text-2xl mb-3">⚡ 想要稳定抓取？部署你自己的 5 行 Cloudflare Worker</h3>
          <p className="text-sm text-ink-soft mb-3">
            公开 CORS 代理经常被限流或下线。30 秒在 <span className="font-mono">workers.cloudflare.com</span> 部署一个永久免费的代理：
          </p>
          <pre className="font-mono text-xs bg-paper-2 border border-rule p-3 overflow-x-auto whitespace-pre-wrap">
{`// Cloudflare Worker — 简易 CORS 代理
export default {
  async fetch(req) {
    const url = new URL(req.url).searchParams.get('url')
    if (!url) return new Response('?url=', { status: 400 })
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const t = await r.text()
    return new Response(t, {
      headers: { 'access-control-allow-origin': '*', 'content-type': r.headers.get('content-type') ?? 'text/plain' },
    })
  },
}`}
          </pre>
          <p className="text-sm text-ink-soft mt-3">
            部署后，把代理地址 <span className="font-mono">https://你的子域名.workers.dev/?url=</span> 填到上方「自定义代理」。
          </p>
        </section>
      )}
    </div>
  )
}
