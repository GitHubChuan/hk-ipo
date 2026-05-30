import { useState, useMemo } from 'react'
import {
  getHistoricalIpos,
  saveHistoricalIpos,
  parseHistoricalPaste,
  type IpoCalendarEntry,
} from '@/lib/market'
import type { HistoricalIpo } from '@/lib/types'
import { profitExpectationScore, oneLotHitRate } from '@/lib/engine'
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

type Props = {
  onEvaluate?: (entry: IpoCalendarEntry) => void
}

/** 把 HistoricalIpo 转成 IpoCalendarEntry，给评估页使用 */
function toCalendarEntry(h: HistoricalIpo): IpoCalendarEntry {
  return {
    code: h.code,
    name: h.name,
    priceLow: h.priceLow ?? h.issuePrice,
    priceHigh: h.priceHigh ?? h.issuePrice,
    lotSize: h.lotSize,
    listingDate: h.listingDate,
    mechanism: h.mechanism,
    issueLots: h.issueLots,
    issueAmount: h.issueAmount,
    entryFeeMid: h.entryFee,
    source: 'i668',
    status: '已上市',
  }
}

/** 用我们的模型对历史 IPO 出预测，再与实际结果对比 */
function evaluateModel(h: HistoricalIpo): {
  predictedHitRate: number       // 模型预测一手中签率
  actualHitRate: number          // 实际一手中签率
  predictedReturn: number        // 模型预测一手期望利润
  actualReturn: number           // 实际一手盈利
  predictedRec: string           // 模型推荐档位
  actualOutcome: 'win' | 'loss' | 'flat'
  modelAccuracy: 'correct' | 'partial' | 'wrong'  // 决策正确性
} {
  const subMul = h.subscriptionMultiple
  const expectedRise = h.darkChangePct ?? h.firstDayChangePct ?? 10
  const fakeIpo: any = {
    id: 'eval-' + h.code,
    code: h.code, name: h.name, lotSize: h.lotSize,
    priceLow: h.priceLow ?? h.issuePrice ?? 0,
    priceHigh: h.priceHigh ?? h.issuePrice ?? 0,
    entryFee: h.entryFee ?? 0,
    aiQualityScore: 7,
    expectedRise,
    oversubMultiple: subMul,
    redShoeBoost: 1.4,
    status: 'listed',
    createdAt: 0, updatedAt: 0,
  }
  const score = profitExpectationScore(fakeIpo)
  const actualHitRate = h.applicants && h.winners ? h.winners / h.applicants : oneLotHitRate(subMul, 1.4)
  const actualReturn = h.profitPerLot ?? 0
  const actualOutcome: 'win' | 'loss' | 'flat' = actualReturn > 100 ? 'win' : actualReturn < -100 ? 'loss' : 'flat'

  // 决策正确性：
  // 推荐了 buy/strong_buy 但实际亏 → wrong
  // 推荐了 skip 但实际大涨 → wrong
  // 推荐了 buy 且实际赚 → correct
  // 中性 / 接近 → partial
  let modelAccuracy: 'correct' | 'partial' | 'wrong' = 'partial'
  if ((score.recommendation === 'strong_buy' || score.recommendation === 'buy') && actualOutcome === 'win') modelAccuracy = 'correct'
  else if (score.recommendation === 'skip' && actualOutcome === 'loss') modelAccuracy = 'correct'
  else if ((score.recommendation === 'strong_buy' || score.recommendation === 'buy') && actualOutcome === 'loss') modelAccuracy = 'wrong'
  else if (score.recommendation === 'skip' && actualOutcome === 'win') modelAccuracy = 'wrong'

  return {
    predictedHitRate: score.hitRate,
    actualHitRate,
    predictedReturn: score.expectedProfit,
    actualReturn,
    predictedRec: score.recommendation,
    actualOutcome,
    modelAccuracy,
  }
}

export default function ProfitBacktestTab({ onEvaluate }: Props) {
  const [list, setList] = useState<HistoricalIpo[]>(() => getHistoricalIpos())
  const [search, setSearch] = useState('')
  const [mechanismFilter, setMechanismFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('listingDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [lotsAssumed, setLotsAssumed] = useState(1)
  const [showModelCol, setShowModelCol] = useState(true)

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

  // 评估模型对每支历史 IPO 的判断
  const modelEvals = useMemo(() => {
    const map: Record<string, ReturnType<typeof evaluateModel>> = {}
    filtered.forEach((h) => { map[h.code] = evaluateModel(h) })
    return map
  }, [filtered])

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
    // 模型决策准确率
    const correct = filtered.filter((h) => modelEvals[h.code]?.modelAccuracy === 'correct').length
    const wrong = filtered.filter((h) => modelEvals[h.code]?.modelAccuracy === 'wrong').length
    const modelAcc = total > 0 ? (correct / total) * 100 : 0
    return {
      total, profitable,
      hitRate: (profitable / total) * 100,
      avgProfit: sumProfit / total,
      avgDark: sumDark / total,
      avgFirst: sumFirst / total,
      totalProfit, totalCost, roi,
      modelCorrect: correct, modelWrong: wrong, modelAcc,
    }
  }, [filtered, lotsAssumed, modelEvals])

  const submitPaste = () => {
    const parsed = parseHistoricalPaste(pasteText)
    if (parsed.length === 0) return alert('解析不到数据。每行示例：03388 创想三维 20260529 48,952 1.38亿 3829.42 +60.85%')
    const merged = [...parsed, ...list.filter((h) => !parsed.find((p) => p.code === h.code))]
    setList(merged); saveHistoricalIpos(merged)
    setShowPaste(false); setPasteText('')
    alert(`已加载 ${parsed.length} 条历史记录 ✓`)
  }

  const resetData = () => {
    if (!confirm('重置为内置回测数据集？')) return
    const fresh = getHistoricalIpos()
    setList(fresh); saveHistoricalIpos(fresh)
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
        desc="既看历史每支的实际收益，也用现在的评估模型回放它，验证模型决策是否靠谱。点击任意行进入标的评估页深度回测。"
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
            <GhostButton onClick={() => setShowModelCol((v) => !v)}>{showModelCol ? '隐藏模型评估列' : '显示模型评估列'}</GhostButton>
            <PrimaryButton onClick={() => setShowPaste((v) => !v)}>📋 粘贴历史</PrimaryButton>
            <GhostButton onClick={resetData}>重置内置数据</GhostButton>
          </div>
        </div>

        {showPaste && (
          <div className="mt-5 border border-rule p-4 bg-paper">
            <div className="text-[10px] uppercase tracking-widest text-ink-mute mb-2">PASTE · 粘贴一行行的历史数据</div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={6}
              placeholder="每行一支：03388 创想三维 2026-05-29 48,952 1.38亿 3829.42 +60.85% +58.94% 1663.82"
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
        <section className="grid grid-cols-2 md:grid-cols-7 gap-4">
          <div className="border-2 border-ink p-4 bg-paper-2/40">
            <div className="text-[10px] uppercase tracking-widest text-ink-mute">样本数</div>
            <div className="num display text-3xl">{stats.total}</div>
            <div className="text-[11px] text-ink-mute">最近 IPO</div>
          </div>
          <div className="border-2 border-ink p-4 bg-paper-2/40">
            <div className="text-[10px] uppercase tracking-widest text-ink-mute">
              <InfoTip title="实际盈利率" formula="单手盈利>0 的支数 / 总支数">实际盈利率</InfoTip>
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
              <InfoTip title="组合总收益" formula="Σ 每手盈利 × 假设中 N 手">组合总收益</InfoTip>
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
          <div className="border-2 border-accent p-4 bg-accent/5">
            <div className="text-[10px] uppercase tracking-widest text-accent">
              <InfoTip
                title="模型决策准确率"
                formula="模型推荐与实际结果一致的支数 / 总支数"
                steps={[
                  '★ correct：推荐 buy 且实际赚；或推荐 skip 且实际亏',
                  '✗ wrong：推荐 buy 却实际亏；或推荐 skip 却实际大赚',
                  '~ partial：中性观望或临界',
                  { label: '正确', value: stats.modelCorrect },
                  { label: '错误', value: stats.modelWrong },
                ]}
              >
                模型准确率
              </InfoTip>
            </div>
            <div className="num display text-3xl text-accent">{stats.modelAcc.toFixed(0)}<span className="text-base font-sans">%</span></div>
            <div className="text-[11px] text-ink-mute">{stats.modelCorrect}对 / {stats.modelWrong}错</div>
          </div>
        </section>
      )}

      {/* 表格 */}
      <section>
        {filtered.length === 0 ? (
          <EmptyState title="无回测数据" hint="点击「📋 粘贴历史」从外部表格复制行进来。" />
        ) : (
          <div className="overflow-x-auto border border-ink">
            <table className="w-full text-sm">
              <thead className="bg-ink text-paper">
                <tr className="text-left">
                  <th className="px-3 py-3 font-serif text-base">新股</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest cursor-pointer" onClick={() => toggleSort('listingDate')}>上市日{sortArrow('listingDate')}</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest">招股价</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest text-right">每手</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest text-right cursor-pointer" onClick={() => toggleSort('entryFee')}>入场费{sortArrow('entryFee')}</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest text-right cursor-pointer" onClick={() => toggleSort('subscriptionMultiple')}>超购{sortArrow('subscriptionMultiple')}</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest text-right cursor-pointer" onClick={() => toggleSort('darkChangePct')}>暗盘{sortArrow('darkChangePct')}</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest text-right cursor-pointer" onClick={() => toggleSort('firstDayChangePct')}>首日{sortArrow('firstDayChangePct')}</th>
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest text-right cursor-pointer" onClick={() => toggleSort('profitPerLot')}>每手盈利{sortArrow('profitPerLot')}</th>
                  {showModelCol && <th className="px-2 py-3 text-[10px] uppercase tracking-widest text-center bg-accent text-paper">模型判断</th>}
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h, idx) => {
                  const profitPositive = (h.profitPerLot ?? 0) > 0
                  const ev = modelEvals[h.code]
                  const recLabel: Record<string, string> = {
                    strong_buy: '强烈申购', buy: '推荐', neutral: '观望', skip: '放弃',
                  }
                  const accSymbol = ev?.modelAccuracy === 'correct' ? '✓' : ev?.modelAccuracy === 'wrong' ? '✗' : '~'
                  const accColor = ev?.modelAccuracy === 'correct' ? 'text-accent' : ev?.modelAccuracy === 'wrong' ? 'text-accent-2' : 'text-ink-mute'
                  return (
                    <tr
                      key={h.code}
                      className={`border-b border-rule transition-colors cursor-pointer ${idx % 2 === 0 ? 'bg-paper' : 'bg-paper-2/30'} hover:bg-accent/10`}
                      onClick={() => onEvaluate?.(toCalendarEntry(h))}
                      title="点击进入标的评估页深度回测"
                    >
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
                          (h.priceLow === h.priceHigh ? h.priceHigh.toFixed(2) : `${h.priceLow.toFixed(2)}–${h.priceHigh.toFixed(2)}`) : '—'}
                      </td>
                      <td className="px-2 py-3 text-right font-mono text-xs">{h.lotSize}</td>
                      <td className="px-2 py-3 text-right font-mono text-xs">{h.entryFee?.toLocaleString() ?? '—'}</td>
                      <td className="px-2 py-3 text-right font-mono text-xs">{h.subscriptionMultiple?.toFixed(0) ?? '—'}×</td>
                      <td className={`px-2 py-3 text-right font-mono ${(h.darkChangePct ?? 0) >= 0 ? 'text-accent' : 'text-accent-2'}`}>{h.darkChangePct !== undefined ? Pct(h.darkChangePct) : '—'}</td>
                      <td className={`px-2 py-3 text-right font-mono ${(h.firstDayChangePct ?? 0) >= 0 ? 'text-accent' : 'text-accent-2'}`}>{h.firstDayChangePct !== undefined ? Pct(h.firstDayChangePct) : '—'}</td>
                      <td className={`px-2 py-3 text-right font-mono font-bold ${profitPositive ? 'text-accent' : 'text-accent-2'}`}>{h.profitPerLot !== undefined ? HKD(h.profitPerLot, false) : '—'}</td>
                      {showModelCol && (
                        <td className="px-2 py-3 text-center">
                          {ev ? (
                            <InfoTip
                              title={`模型评估 — ${h.name}`}
                              formula="把实际超购倍数+实际暗盘涨幅喂给当前模型，看推荐档位是否与实际结果一致"
                              steps={[
                                { label: '模型推荐', value: recLabel[ev.predictedRec] ?? ev.predictedRec },
                                { label: '模型预测一手中签率', value: `${(ev.predictedHitRate * 100).toFixed(0)}%` },
                                { label: '实际一手中签率', value: `${(ev.actualHitRate * 100).toFixed(1)}%` },
                                { label: '模型预测一手期望', value: HKD(ev.predictedReturn) },
                                { label: '实际一手盈利', value: HKD(ev.actualReturn) },
                                { label: '实际结果', value: ev.actualOutcome === 'win' ? '✓ 赚 (>+100)' : ev.actualOutcome === 'loss' ? '✗ 亏 (<-100)' : '平' },
                              ]}
                            >
                              <span className={`text-base font-bold ${accColor}`}>{accSymbol}</span>{' '}
                              <span className="text-[10px] text-ink-mute">{recLabel[ev.predictedRec]?.slice(0, 2) ?? ''}</span>
                            </InfoTip>
                          ) : '—'}
                        </td>
                      )}
                      <td className="px-2 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); onEvaluate?.(toCalendarEntry(h)) }}
                          className="text-[10px] uppercase tracking-widest underline underline-offset-4 hover:text-accent"
                        >
                          评估 →
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
