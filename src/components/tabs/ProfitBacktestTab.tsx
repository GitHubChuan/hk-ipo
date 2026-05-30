import { useState, useMemo } from 'react'
import {
  getHistoricalIpos,
  saveHistoricalIpos,
  parseHistoricalPaste,
} from '@/lib/market'
import type { HistoricalIpo } from '@/lib/types'
import {
  SectionTitle,
  Tag,
  HKD,
  Pct,
  PrimaryButton,
  GhostButton,
  EmptyState,
  InfoTip,
  Select,
} from '@/components/shared/Editorial'

type SortKey = 'listingDate' | 'profitPerLot' | 'darkChangePct' | 'firstDayChangePct' | 'subscriptionMultiple' | 'entryFee'
type SortDir = 'asc' | 'desc'

export default function ProfitBacktestTab() {
  const [list, setList] = useState<HistoricalIpo[]>(() => getHistoricalIpos())
  const [search, setSearch] = useState('')
  const [mechanismFilter, setMechanismFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('listingDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [lotsAssumed, setLotsAssumed] = useState(1)  // 假设每支中签手数

  const filtered = useMemo(() => {
    let arr = [...list]
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      arr = arr.filter((h) => h.code.includes(s) || h.name.toLowerCase().includes(s))
    }
    if (mechanismFilter !== 'all') arr = arr.filter((h) => h.mechanism === mechanismFilter)
    arr.sort((a, b) => {
      const av = (a[sortKey] as any) ?? 0
      const bv = (b[sortKey] as any) ?? 0
      if (typeof av === 'string' && typeof bv === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return arr
  }, [list, search, mechanismFilter, sortKey, sortDir])

  const stats = useMemo(() => {
    if (filtered.length === 0) return null
    const total = filtered.length
    const profitable = filtered.filter((h) => (h.profitPerLot ?? 0) > 0).length
    const sumProfit = filtered.reduce((a, b) => a + (b.profitPerLot ?? 0), 0)
    const sumDark = filtered.reduce((a, b) => a + (b.darkChangePct ?? 0), 0)
    const sumFirst = filtered.reduce((a, b) => a + (b.firstDayChangePct ?? 0), 0)
    const sumCost = filtered.reduce((a, b) => a + (b.entryFee ?? 0), 0)
    const totalProfit = sumProfit * lotsAssumed
    const totalCost = sumCost * lotsAssumed
    const roi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0
    return {
      total,
      profitable,
      hitRate: (profitable / total) * 100,
      avgProfit: sumProfit / total,
      avgDark: sumDark / total,
      avgFirst: sumFirst / total,
      totalProfit, totalCost, roi,
    }
  }, [filtered, lotsAssumed])

  const submitPaste = () => {
    const parsed = parseHistoricalPaste(pasteText)
    if (parsed.length === 0) return alert('解析不到数据。每行示例：03388 创想三维 20260529 48,952 1.38亿 3829.42 +60.85%')
    const merged = [...parsed, ...list.filter((h) => !parsed.find((p) => p.code === h.code))]
    setList(merged)
    saveHistoricalIpos(merged)
    setShowPaste(false)
    setPasteText('')
    alert(`已加载 ${parsed.length} 条历史记录 ✓`)
  }

  const resetData = () => {
    if (!confirm('重置为内置回测数据集？')) return
    const fresh = getHistoricalIpos()
    setList(fresh)
    saveHistoricalIpos(fresh)
  }

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    else { setSortKey(k); setSortDir('desc') }
  }

  const sortArrow = (k: SortKey) => sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''

  return (
    <div className="space-y-10">
      <SectionTitle
        index="IV"
        en="Profit Backtest"
        zh="打新收益回测"
        desc='参考 i668.vip/profit 的格式。验证不同策略（机制/募集量级/超购档位）下的实盘收益。'
      />

      {/* 控制条 */}
      <section className="border border-ink p-5 bg-paper-2/40">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-3">
            <div className="text-[10px] tracking-[0.25em] uppercase text-ink-soft mb-1.5">搜索（代码 / 名称）</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="例：03388 / 创想"
              className="w-full bg-transparent border-b border-ink/50 focus:border-accent outline-none py-1.5 text-sm font-mono"
            />
          </div>
          <div className="md:col-span-2">
            <div className="text-[10px] tracking-[0.25em] uppercase text-ink-soft mb-1.5">机制过滤</div>
            <Select
              value={mechanismFilter}
              onChange={(e) => setMechanismFilter(e.target.value)}
              options={[
                { value: 'all', label: '全部机制' },
                { value: 'B', label: '机制B' },
                { value: '18C', label: '18C' },
                { value: 'A', label: '机制A' },
                { value: 'SPAC', label: 'SPAC' },
                { value: 'GEM', label: 'GEM' },
              ]}
            />
          </div>
          <div className="md:col-span-2">
            <div className="text-[10px] tracking-[0.25em] uppercase text-ink-soft mb-1.5">
              <InfoTip title="假设中签手数" formula="组合收益 = Σ (单手盈利 × 中签手数)">假设每支中 N 手</InfoTip>
            </div>
            <input
              type="number"
              min={1}
              value={lotsAssumed}
              onChange={(e) => setLotsAssumed(Math.max(1, +e.target.value || 1))}
              className="w-full bg-transparent border-b border-ink/50 focus:border-accent outline-none py-1.5 text-sm font-mono"
            />
          </div>
          <div className="md:col-span-5 flex gap-2 flex-wrap justify-end">
            <PrimaryButton onClick={() => setShowPaste((v) => !v)}>📋 粘贴历史</PrimaryButton>
            <GhostButton onClick={resetData}>重置内置数据</GhostButton>
          </div>
        </div>

        {showPaste && (
          <div className="mt-5 border border-rule p-4 bg-paper">
            <div className="text-[10px] uppercase tracking-widest text-ink-mute mb-2">PASTE · 粘贴 i668.vip/profit 的表格行</div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              placeholder='每行一支：03388 创想三维 2026-05-29 48,952 1.38亿 3829.42 +60.85% +58.94% 1663.82'
              className="w-full font-mono text-xs border border-rule p-2 bg-paper-2"
            />
            <div className="flex gap-2 mt-2">
              <PrimaryButton onClick={submitPaste}>解析并加载</PrimaryButton>
              <GhostButton onClick={() => { setShowPaste(false); setPasteText('') }}>取消</GhostButton>
            </div>
          </div>
        )}
      </section>

      {/* 统计 */}
      {stats && (
        <section className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="border-2 border-ink p-4 bg-paper-2/40">
            <div className="text-[10px] uppercase tracking-widest text-ink-mute">样本数</div>
            <div className="num display text-3xl">{stats.total}</div>
            <div className="text-[11px] text-ink-mute">最近 IPO</div>
          </div>
          <div className="border-2 border-ink p-4 bg-paper-2/40">
            <div className="text-[10px] uppercase tracking-widest text-ink-mute">
              <InfoTip title="盈利率" formula="单手盈利>0 的支数 / 总支数">盈利率</InfoTip>
            </div>
            <div className="num display text-3xl text-accent">{stats.hitRate.toFixed(0)}<span className="text-base font-sans">%</span></div>
            <div className="text-[11px] text-ink-mute">{stats.profitable}/{stats.total} 支</div>
          </div>
          <div className="border-2 border-ink p-4 bg-paper-2/40">
            <div className="text-[10px] uppercase tracking-widest text-ink-mute">平均暗盘</div>
            <div className={`num display text-3xl ${stats.avgDark >= 0 ? 'text-accent' : 'text-accent-2'}`}>{Pct(stats.avgDark)}</div>
          </div>
          <div className="border-2 border-ink p-4 bg-paper-2/40">
            <div className="text-[10px] uppercase tracking-widest text-ink-mute">平均首日</div>
            <div className={`num display text-3xl ${stats.avgFirst >= 0 ? 'text-accent' : 'text-accent-2'}`}>{Pct(stats.avgFirst)}</div>
          </div>
          <div className="border-2 border-ink p-4 bg-paper-2/40">
            <div className="text-[10px] uppercase tracking-widest text-ink-mute">
              <InfoTip
                title="组合总收益"
                formula="Σ 每手盈利 × 假设中 N 手"
                steps={[
                  { label: '样本支数', value: stats.total },
                  { label: '每支假设中', value: `${lotsAssumed} 手` },
                  { label: '= 组合收益', value: HKD(stats.totalProfit) },
                ]}
              >
                组合总收益
              </InfoTip>
            </div>
            <div className={`num display text-3xl ${stats.totalProfit >= 0 ? 'text-accent' : 'text-accent-2'}`}>{HKD(stats.totalProfit, false)}</div>
            <div className="text-[11px] text-ink-mute">总投入 {HKD(stats.totalCost, false)}</div>
          </div>
          <div className="border-2 border-ink p-4 bg-paper-2/40">
            <div className="text-[10px] uppercase tracking-widest text-ink-mute">
              <InfoTip title="组合 ROI" formula="组合收益 / 组合投入 × 100%">ROI</InfoTip>
            </div>
            <div className={`num display text-3xl ${stats.roi >= 0 ? 'text-accent' : 'text-accent-2'}`}>{Pct(stats.roi)}</div>
            <div className="text-[11px] text-ink-mute">均价 {HKD(stats.avgProfit, false)} / 手</div>
          </div>
        </section>
      )}

      {/* 表格 */}
      <section>
        {filtered.length === 0 ? (
          <EmptyState title="无回测数据" hint="点击「📋 粘贴历史」从 i668.vip/profit 复制行进来。" />
        ) : (
          <div className="overflow-x-auto border border-ink">
            <table className="w-full text-sm">
              <thead className="bg-ink text-paper">
                <tr className="text-left">
                  <th className="px-3 py-3 font-serif text-base">新股</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest cursor-pointer" onClick={() => toggleSort('listingDate')}>上市日{sortArrow('listingDate')}</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest">招股价</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest">发行价</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest text-right">每手股数</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest text-right cursor-pointer" onClick={() => toggleSort('entryFee')}>入场费{sortArrow('entryFee')}</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest text-right cursor-pointer" onClick={() => toggleSort('darkChangePct')}>暗盘{sortArrow('darkChangePct')}</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest text-right cursor-pointer" onClick={() => toggleSort('firstDayChangePct')}>首日{sortArrow('firstDayChangePct')}</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest text-right cursor-pointer" onClick={() => toggleSort('profitPerLot')}>每手盈利{sortArrow('profitPerLot')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h, idx) => {
                  const profitPositive = (h.profitPerLot ?? 0) > 0
                  return (
                    <tr key={h.code} className={`border-b border-rule transition-colors ${idx % 2 === 0 ? 'bg-paper' : 'bg-paper-2/30'} hover:bg-accent/5`}>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-ink-mute">{h.code}</span>
                          <span className="font-serif text-base">{h.name}</span>
                          {h.mechanism && <Tag variant="mute">{h.mechanism === 'B' ? '机制B' : h.mechanism}</Tag>}
                        </div>
                      </td>
                      <td className="px-2 py-3 font-mono text-xs">{h.listingDate}</td>
                      <td className="px-2 py-3 font-mono text-xs">
                        {h.priceLow !== undefined && h.priceHigh !== undefined ?
                          (h.priceLow === h.priceHigh ? h.priceHigh.toFixed(3) : `${h.priceLow.toFixed(2)}–${h.priceHigh.toFixed(2)}`) : '—'}
                      </td>
                      <td className="px-2 py-3 font-mono text-xs">{h.issuePrice?.toFixed(3) ?? '—'}</td>
                      <td className="px-2 py-3 text-right font-mono text-xs">{h.lotSize}</td>
                      <td className="px-2 py-3 text-right font-mono text-xs">{h.entryFee?.toLocaleString() ?? '—'}</td>
                      <td className={`px-2 py-3 text-right font-mono ${(h.darkChangePct ?? 0) >= 0 ? 'text-accent' : 'text-accent-2'}`}>{h.darkChangePct !== undefined ? Pct(h.darkChangePct) : '—'}</td>
                      <td className={`px-2 py-3 text-right font-mono ${(h.firstDayChangePct ?? 0) >= 0 ? 'text-accent' : 'text-accent-2'}`}>{h.firstDayChangePct !== undefined ? Pct(h.firstDayChangePct) : '—'}</td>
                      <td className={`px-2 py-3 text-right font-mono font-bold ${profitPositive ? 'text-accent' : 'text-accent-2'}`}>
                        <InfoTip
                          title="每手盈利"
                          formula="每手股数 × 收盘价 - 入场费"
                          steps={[
                            { label: '每手股数', value: h.lotSize },
                            { label: '发行价', value: h.issuePrice ?? '—' },
                            { label: '首日涨跌', value: h.firstDayChangePct !== undefined ? Pct(h.firstDayChangePct) : '—' },
                            { label: '入场费', value: HKD(h.entryFee ?? 0) },
                            { label: '= 每手盈利', value: HKD(h.profitPerLot ?? 0) },
                          ]}
                        >
                          {h.profitPerLot !== undefined ? HKD(h.profitPerLot, false) : '—'}
                        </InfoTip>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[11px] text-ink-mute italic">
        数据来源：内置历史回测 + 你手工粘贴的 <a href="https://www.i668.vip/profit" target="_blank" rel="noreferrer" className="underline hover:text-accent">i668.vip/profit</a> 行。本地缓存 7 天。
      </p>
    </div>
  )
}
