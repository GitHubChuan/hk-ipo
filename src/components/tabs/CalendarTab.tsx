import { useState, useEffect, useRef, useMemo } from 'react'
import { useStore, useIsAdmin } from '@/lib/store'
import {
  fetchIpoCalendar,
  fetchManyQuotes,
  parseClipboardCalendar,
  sampleIpoCalendar,
  fetchDarkPool,
  parseClipboardDarkPool,
  sampleDarkPool,
  type IpoCalendarEntry,
  type DarkPoolQuote,
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
  HKD,
  InfoTip,
} from '@/components/shared/Editorial'

const AUTO_REFRESH_MS = 5 * 60 * 1000 // 5 分钟

type Props = {
  onJumpEval?: (entry: IpoCalendarEntry) => void
}

export default function CalendarTab({ onJumpEval }: Props) {
  const { ipos, addIpo, updateIpo, config, updateConfig } = useStore()
  const isAdmin = useIsAdmin()

  // 新股日历
  const [calendar, setCalendar] = useState<IpoCalendarEntry[]>([])
  const [source, setSource] = useState<string>('—')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<number | null>(null)
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')

  // 行情
  const [refreshingQuotes, setRefreshingQuotes] = useState(false)

  // 暗盘
  const [darkPool, setDarkPool] = useState<DarkPoolQuote[]>([])
  const [darkSource, setDarkSource] = useState<string>('—')
  const [darkError, setDarkError] = useState<string | null>(null)
  const [darkLoading, setDarkLoading] = useState(false)
  const [darkLastSync, setDarkLastSync] = useState<number | null>(null)
  const [showDarkPaste, setShowDarkPaste] = useState(false)
  const [darkPasteText, setDarkPasteText] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  // 自动加载
  useEffect(() => {
    void syncCalendar(true)
    void syncDark(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tickRef = useRef<number | null>(null)
  useEffect(() => {
    if (!autoRefresh) return
    tickRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncDark(true)
      }
    }, AUTO_REFRESH_MS)
    return () => { if (tickRef.current) window.clearInterval(tickRef.current) }
  }, [autoRefresh])

  const syncCalendar = async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const r = await fetchIpoCalendar()
      setCalendar(r.list)
      setSource(r.source)
      setLastSync(r.fetchedAt ?? Date.now())
      if (r.list.length === 0) setError(r.error ?? '未抓到任何数据。')
      else if (r.error) setError(r.error)
    } catch (e: any) {
      if (!silent) setError(`抓取失败：${e?.message ?? '未知错误'}`)
    }
    if (!silent) setLoading(false)
  }

  const syncDark = async (silent = false) => {
    if (!silent) setDarkLoading(true)
    setDarkError(null)
    try {
      const r = await fetchDarkPool()
      setDarkPool(r.list)
      setDarkSource(r.source)
      setDarkLastSync(r.fetchedAt ?? Date.now())
      if (r.list.length === 0) setDarkError(r.error ?? '未抓到暗盘数据。')
    } catch (e: any) {
      if (!silent) setDarkError(`暗盘抓取失败：${e?.message ?? '未知错误'}`)
    }
    if (!silent) setDarkLoading(false)
  }

  const loadSample = () => {
    setCalendar(sampleIpoCalendar()); setSource('示例数据'); setLastSync(Date.now()); setError(null)
  }
  const loadDarkSample = () => {
    setDarkPool(sampleDarkPool()); setDarkSource('示例数据'); setDarkLastSync(Date.now()); setDarkError(null)
  }

  const submitPaste = () => {
    const list = parseClipboardCalendar(pasteText)
    if (list.length === 0) return alert('解析不到有效数据。可粘贴雪球新股 API 的 JSON，或每行一支「02555 茶百道 17.5-17.5 2024-04-23」')
    setCalendar(list); setSource('手工粘贴'); setLastSync(Date.now()); setShowPaste(false); setPasteText('')
  }
  const submitDarkPaste = () => {
    const list = parseClipboardDarkPool(darkPasteText)
    if (list.length === 0) return alert('解析不到暗盘数据。可粘贴 JSON，或每行一支「02555 茶百道 17.5 21.5」')
    setDarkPool(list); setDarkSource('手工粘贴'); setDarkLastSync(Date.now()); setShowDarkPaste(false); setDarkPasteText('')
  }

  const refreshQuotes = async () => {
    setRefreshingQuotes(true)
    const liveCodes = ipos.filter((i) => ['subscribed', 'listed'].includes(i.status)).map((i) => i.code)
    if (liveCodes.length === 0) { alert('当前没有「已申购 / 已上市」状态的标的，无须刷新行情'); setRefreshingQuotes(false); return }
    const map = await fetchManyQuotes(liveCodes)
    let updated = 0
    ipos.forEach((i) => {
      const q = map[i.code]
      if (q && !isNaN(q.price)) {
        updateIpo(i.id, { liveQuote: { price: q.price, changePct: q.changePct, fetchedAt: q.fetchedAt }, listingOpenPrice: i.listingOpenPrice ?? q.open ?? q.price })
        updated++
      }
    })
    setRefreshingQuotes(false)
    alert(`已刷新 ${updated} / ${liveCodes.length} 支行情 ✓`)
  }

  const importEntry = (e: IpoCalendarEntry) => {
    if (!isAdmin) { alert('只有主理人可以导入'); return null }
    const exists = ipos.find((x) => e.code && x.code === e.code)
    if (exists) {
      updateIpo(exists.id, {
        priceLow: e.priceLow ?? exists.priceLow,
        priceHigh: e.priceHigh ?? exists.priceHigh,
        listingDate: e.listingDate,
        subscriptionEnd: e.subscriptionEnd ?? exists.subscriptionEnd,
        mechanism: e.mechanism ?? exists.mechanism,
        issueLots: e.issueLots ?? exists.issueLots,
        issueAmount: e.issueAmount ?? exists.issueAmount,
      } as any)
      return exists.id
    }
    const priceHigh = e.priceHigh ?? 0
    const lotSize = e.lotSize ?? 100
    const id = addIpo({
      code: e.code ?? '',
      name: e.name,
      industry: e.industry,
      priceLow: e.priceLow ?? 0,
      priceHigh,
      lotSize,
      entryFee: e.entryFeeMid ?? priceHigh * lotSize * 1.0077,
      status: 'evaluating',
      listingDate: e.listingDate,
      subscriptionEnd: e.subscriptionEnd,
      mechanism: e.mechanism,
      issueLots: e.issueLots,
      issueAmount: e.issueAmount,
      aiQualityScore: 6,
      expectedRise: 8,
      oversubMultiple: 30,
      redShoeBoost: 1.4,
    } as any)
    return id
  }

  const importAll = () => {
    if (!isAdmin || calendar.length === 0) return
    if (!confirm(`确定批量导入 ${calendar.length} 支新股到评估台？已存在的会合并更新。`)) return
    calendar.forEach(importEntry)
    alert(`完成 ✓ 共 ${calendar.length} 支`)
  }

  const handleEvaluate = (e: IpoCalendarEntry) => {
    importEntry(e)
    onJumpEval?.(e)
  }

  const syncDarkToIpos = () => {
    if (!isAdmin) return
    if (darkPool.length === 0) return alert('暗盘数据为空')
    let matched = 0
    darkPool.forEach((d) => {
      const ipo = ipos.find((i) => i.code === d.code)
      if (ipo) {
        updateIpo(ipo.id, { darkPrice: d.darkPrice, darkChangePct: d.changePct, darkFetchedAt: d.fetchedAt } as any)
        matched++
      }
    })
    alert(`已把暗盘价同步到 ${matched} / ${darkPool.length} 个匹配的标的 ✓`)
  }

  const liveListings = ipos.filter((i) => i.liveQuote)
  const fmtTime = (t?: number | null) => t ? new Date(t).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric' }) : '未'

  // 招股中 / 待上市 / 已上市 分组：用 today 实时推断，不信任 e.status（可能是缓存的旧值）
  const today = new Date().toISOString().slice(0, 10)
  const inferStatus = (e: IpoCalendarEntry): '招股中' | '待上市' | '已上市' | '未知' => {
    // 1) 已上市：listingDate <= today
    if (e.listingDate && today > e.listingDate) return '已上市'
    // 2) 招股中：今天落在 [subscriptionStart, subscriptionEnd] 区间
    if (e.subscriptionStart && e.subscriptionEnd) {
      if (today >= e.subscriptionStart && today <= e.subscriptionEnd) return '招股中'
    }
    // 3) 待上市：还没到上市日，但也不在申购窗口内（或没有申购窗口信息）
    if (e.listingDate && today <= e.listingDate) return '待上市'
    // 4) 实在没日期就 fallback 到原始 status
    if (e.status) return e.status as any
    return '未知'
  }
  const grouped = useMemo(() => {
    const subscribing: IpoCalendarEntry[] = []
    const upcoming: IpoCalendarEntry[] = []
    const listed: IpoCalendarEntry[] = []
    calendar.forEach((e) => {
      const st = inferStatus(e)
      if (st === '招股中') subscribing.push(e)
      else if (st === '待上市') upcoming.push(e)
      else if (st === '已上市') listed.push(e)
      else upcoming.push(e)
    })
    return { subscribing, upcoming, listed }
  }, [calendar])

  const renderRow = (e: IpoCalendarEntry, i: number, opts?: { dim?: boolean }) => {
    const st = inferStatus(e)
    const stColor = st === '招股中' ? 'accent' : st === '待上市' ? 'warn' : 'mute'
    const lotsAmt = e.issueLots ? (e.issueLots >= 10000 ? `${(e.issueLots / 10000).toFixed(1)}万` : e.issueLots.toLocaleString()) : '—'
    const fundsAmt = e.issueAmount ? (e.issueAmount >= 10000 ? `${(e.issueAmount / 10000).toFixed(2)}亿` : `${e.issueAmount.toFixed(0)}万`) : '—'
    return (
      <article
        key={`${e.code ?? e.name}-${i}`}
        className={`grid grid-cols-12 gap-3 items-center border p-3 transition-colors cursor-pointer ${opts?.dim ? 'border-rule bg-paper/40 opacity-70 hover:opacity-100' : 'border-ink bg-paper hover:bg-paper-2/60'}`}
        onClick={() => handleEvaluate(e)}
        title="点击：导入并打开标的评估"
      >
        <div className="col-span-1 text-center">
          <Tag variant={stColor as any}>{st}</Tag>
        </div>
        <div className="col-span-3">
          <div className="font-serif text-lg leading-tight">{e.name}</div>
          <div className="text-xs font-mono text-ink-mute">{e.code ?? '—'} {e.mechanism && <span className="ml-1 inline-block px-1 border border-rule">{e.mechanism === 'B' ? '机制B' : e.mechanism}</span>}</div>
        </div>
        <div className="col-span-2">
          <div className="text-[10px] uppercase tracking-widest text-ink-mute">招股价 / 每手</div>
          <div className="num text-sm">{e.priceLow && e.priceHigh ? (e.priceLow === e.priceHigh ? `HK$ ${e.priceHigh}` : `HK$ ${e.priceLow}–${e.priceHigh}`) : '—'}</div>
          {e.lotSize && <div className="text-[10px] text-ink-soft">每手 {e.lotSize} 股 · 入场 {e.entryFeeMid ? HKD(e.entryFeeMid) : '—'}</div>}
        </div>
        <div className="col-span-2">
          <div className="text-[10px] uppercase tracking-widest text-ink-mute">截止 / 上市</div>
          <div className="num text-sm text-accent">{e.subscriptionEnd ?? '—'}</div>
          <div className="text-[10px] text-ink-soft">上市 {e.listingDate ?? '—'}</div>
        </div>
        <div className="col-span-2">
          <div className="text-[10px] uppercase tracking-widest text-ink-mute">发行 / 募集</div>
          <div className="num text-sm">{lotsAmt} 手</div>
          <div className="text-[10px] text-ink-soft">{fundsAmt}</div>
        </div>
        <div className="col-span-2 text-right">
          <button
            onClick={(ev) => { ev.stopPropagation(); handleEvaluate(e) }}
            className="text-[10px] uppercase tracking-widest underline underline-offset-4 hover:text-accent"
          >
            评估 →
          </button>
          {isAdmin && (
            <button
              onClick={(ev) => { ev.stopPropagation(); importEntry(e); alert('已导入到评估台 ✓') }}
              className="block mt-1 text-[10px] uppercase tracking-widest text-ink-mute hover:text-accent"
            >
              仅导入
            </button>
          )}
        </div>
      </article>
    )
  }

  return (
    <div className="space-y-12">
      <SectionTitle
        index="II"
        en="IPO Calendar · Live Quotes · Dark Pool"
        zh="新股日历 · 实时行情 · 暗盘行情"
        desc="招股中标的优先展示。点击任意行可直接进入「标的评估」。"
      />

      {/* 数据源 + 操作 */}
      <section className="border border-ink p-5 bg-paper-2/40">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">DATA SOURCE · 数据源</div>
          <div className="flex items-center gap-2 flex-wrap">
            <Tag variant="mute">日历：{source} · {fmtTime(lastSync)}</Tag>
            <Tag variant="mute">暗盘：{darkSource} · {fmtTime(darkLastSync)}</Tag>
            <label className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-ink-mute cursor-pointer">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="accent-accent" />
              暗盘自动轮询 5min
            </label>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
          <div className="md:col-span-5">
            <Field label="自定义代理（可选，留空自动尝试公开代理）" hint="部署 Cloudflare Worker 最稳；URL 末尾 ? 或 / 自动适配">
              <TextInput
                value={config.corsProxy}
                onChange={(e) => updateConfig({ corsProxy: e.target.value })}
                disabled={!isAdmin}
                placeholder="留空自动 / 或填 https://your-worker.workers.dev/?url="
              />
            </Field>
          </div>
          <div className="md:col-span-7 flex flex-wrap gap-2">
            <PrimaryButton onClick={() => syncCalendar()} disabled={loading}>
              {loading ? '抓取中…' : '↻ 抓新股日历'}
            </PrimaryButton>
            <PrimaryButton onClick={() => syncDark()} disabled={darkLoading} className="bg-accent">
              {darkLoading ? '抓暗盘中…' : '🌙 抓暗盘'}
            </PrimaryButton>
            <GhostButton onClick={refreshQuotes} disabled={refreshingQuotes}>
              {refreshingQuotes ? '行情中…' : '↻ 港股行情'}
            </GhostButton>
            <GhostButton onClick={() => setShowPaste((v) => !v)}>📋 粘贴日历</GhostButton>
            <GhostButton onClick={() => setShowDarkPaste((v) => !v)}>📋 粘贴暗盘</GhostButton>
            <GhostButton onClick={loadSample}>示例日历</GhostButton>
            <GhostButton onClick={loadDarkSample}>示例暗盘</GhostButton>
          </div>
        </div>

        {showPaste && (
          <div className="mt-5 border border-rule p-4 bg-paper">
            <div className="text-[10px] uppercase tracking-widest text-ink-mute mb-2">PASTE CALENDAR · 粘贴新股日历</div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              placeholder='可粘贴雪球新股 JSON，或每行一支：02555 茶百道 17.5-17.5 2024-04-23'
              className="w-full font-mono text-xs border border-rule p-2 bg-paper-2"
            />
            <div className="flex gap-2 mt-2">
              <PrimaryButton onClick={submitPaste}>解析并加载</PrimaryButton>
              <GhostButton onClick={() => { setShowPaste(false); setPasteText('') }}>取消</GhostButton>
            </div>
          </div>
        )}

        {showDarkPaste && (
          <div className="mt-5 border border-accent/40 p-4 bg-accent/5">
            <div className="text-[10px] uppercase tracking-widest text-accent mb-2">PASTE DARK POOL · 粘贴暗盘行情</div>
            <textarea
              value={darkPasteText}
              onChange={(e) => setDarkPasteText(e.target.value)}
              rows={6}
              placeholder='例：每行一支「02555 茶百道 17.5 21.5」前面是招股价、后面是暗盘价。也支持 JSON。'
              className="w-full font-mono text-xs border border-accent/30 p-2 bg-paper"
            />
            <div className="flex gap-2 mt-2">
              <PrimaryButton onClick={submitDarkPaste} className="bg-accent">解析并加载</PrimaryButton>
              <GhostButton onClick={() => { setShowDarkPaste(false); setDarkPasteText('') }}>取消</GhostButton>
            </div>
          </div>
        )}

        {error && <div className="mt-4 border-l-4 border-accent pl-3 py-2 text-sm text-accent bg-accent/5">日历：{error}</div>}
        {darkError && <div className="mt-2 border-l-4 border-accent-2 pl-3 py-2 text-sm text-accent-2 bg-accent-2/5">暗盘：{darkError}</div>}
      </section>

      {/* ① 招股中 — 置顶 */}
      <section>
        <div className="border-b-2 border-accent pb-3 mb-6 flex items-baseline justify-between">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-accent">SUBSCRIBING · 当下可申购</div>
            <h3 className="font-serif text-3xl">招股中 · {grouped.subscribing.length}</h3>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && grouped.subscribing.length > 0 && (
              <button onClick={() => grouped.subscribing.forEach(importEntry)} className="text-[10px] uppercase tracking-widest underline underline-offset-4 hover:text-accent">
                全部导入 →
              </button>
            )}
          </div>
        </div>
        {grouped.subscribing.length === 0 ? (
          <EmptyState title="近期暂无招股中标的" hint='点上方「↻ 抓新股日历」或「示例日历」获取最新。' />
        ) : (
          <div className="space-y-2">
            {grouped.subscribing.map((e, i) => renderRow(e, i))}
          </div>
        )}
      </section>

      {/* ② 暗盘 — 次优 */}
      <section>
        <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
          <h3 className="font-serif text-2xl">🌙 暗盘行情 · {darkPool.length}</h3>
          <div className="flex items-center gap-3">
            {isAdmin && darkPool.length > 0 && (
              <button onClick={syncDarkToIpos} className="text-[10px] uppercase tracking-widest underline underline-offset-4 hover:text-accent">
                同步到标的 →
              </button>
            )}
            <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">DARK POOL · 16:15–18:30</span>
          </div>
        </div>
        {darkPool.length === 0 ? (
          <EmptyState title="暂无暗盘数据" hint="点「🌙 抓暗盘」拉富途+AAStocks；今晚有暗盘的话推荐 17:00 后再抓。" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {darkPool.map((d) => {
              const up = d.changePct >= 0
              return (
                <div key={d.code} className={`border-2 p-4 bg-paper-2/40 ${up ? 'border-accent' : 'border-accent-2'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-serif text-lg leading-tight">{d.name}</div>
                    <Tag variant={up ? 'accent' : 'success'}>{up ? '溢' : '破'}</Tag>
                  </div>
                  <div className="text-xs font-mono text-ink-mute mb-3">{d.code}</div>
                  <div className={`num display text-3xl ${up ? 'text-accent' : 'text-accent-2'}`}>HK$ {d.darkPrice.toFixed(2)}</div>
                  {d.issuePrice !== undefined && (
                    <div className={`text-sm font-mono mt-1 ${up ? 'text-accent' : 'text-accent-2'}`}>
                      <InfoTip
                        title="暗盘相对招股价涨幅"
                        formula="(暗盘价 - 招股价) / 招股价 × 100%"
                        steps={[
                          { label: '招股价', value: `HK$ ${d.issuePrice.toFixed(2)}` },
                          { label: '暗盘价', value: `HK$ ${d.darkPrice.toFixed(2)}` },
                          { label: '涨幅', value: Pct(d.changePct) },
                        ]}
                      >
                        vs 招股 {Pct(d.changePct)}
                      </InfoTip>
                    </div>
                  )}
                  <div className="text-[10px] text-ink-mute mt-2">{new Date(d.fetchedAt).toLocaleTimeString()} · {d.source.replace('-dark', '')}</div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ③ 待上市 */}
      {grouped.upcoming.length > 0 && (
        <section>
          <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
            <h3 className="font-serif text-2xl">待上市 · {grouped.upcoming.length}</h3>
            <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">UPCOMING LISTINGS</span>
          </div>
          <div className="space-y-2">
            {grouped.upcoming.map((e, i) => renderRow(e, i))}
          </div>
        </section>
      )}

      {/* ④ 持仓盘中行情 */}
      <section>
        <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
          <h3 className="font-serif text-2xl">持仓盘中行情</h3>
          <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">LIVE QUOTES</span>
        </div>
        {liveListings.length === 0 ? (
          <EmptyState title="暂无行情数据" hint="点击「↻ 港股行情」拉取已申购/已上市标的（直连腾讯）。" />
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
                  <div className={`num display text-3xl ${up ? 'text-accent' : 'text-accent-2'}`}>HK$ {q.price.toFixed(2)}</div>
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
                  <div className="text-[10px] text-ink-mute mt-2">{new Date(q.fetchedAt).toLocaleTimeString()} · 日内 {Pct(q.changePct)}</div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ⑤ 已上市（折叠展示） */}
      {grouped.listed.length > 0 && (
        <section>
          <div className="border-b border-rule pb-3 mb-6 flex items-baseline justify-between">
            <h3 className="font-serif text-2xl text-ink-mute">已上市 · {grouped.listed.length}</h3>
            <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">RECENT LISTINGS</span>
          </div>
          <div className="space-y-2">
            {grouped.listed.slice(0, 8).map((e, i) => renderRow(e, i, { dim: true }))}
          </div>
        </section>
      )}

      {/* 一键导入全部 */}
      {isAdmin && calendar.length > 0 && (
        <div className="flex justify-end">
          <button onClick={importAll} className="text-xs uppercase tracking-widest underline underline-offset-4 hover:text-accent">
            一键全部导入到评估台 ({calendar.length}) →
          </button>
        </div>
      )}
    </div>
  )
}
