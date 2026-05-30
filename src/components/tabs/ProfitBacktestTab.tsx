import { useState, useMemo } from 'react'
import { useLeverageParams, useStore } from '@/lib/store'
import {
  getHistoricalIpos,
  saveHistoricalIpos,
  parseHistoricalPaste,
  type IpoCalendarEntry,
} from '@/lib/market'
import type { HistoricalIpo } from '@/lib/types'
import {
  profitExpectationScore,
  oneLotHitRate,
  leveragedActualProfit,
  leveragedExpectedProfit,
  DEFAULT_LEVERAGE,
} from '@/lib/engine'
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
  const globalLev = useLeverageParams()
  const updateConfig = useStore((s) => s.updateConfig)
  const [list, setList] = useState<HistoricalIpo[]>(() => getHistoricalIpos())
  const [search, setSearch] = useState('')
  const [mechanismFilter, setMechanismFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('listingDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [lotsAssumed, setLotsAssumed] = useState(1)
  const [showModelCol, setShowModelCol] = useState(true)

  // 杠杆参数：本地草稿 ← 全局（§IX 设置）。改完点「同步回全局」让其他页面跟着变
  const [leverage, setLeverage] = useState(globalLev.leverage)
  const [marginRate, setMarginRate] = useState(globalLev.marginRate)
  const [daysHeld, setDaysHeld] = useState(globalLev.daysHeld)
  const [redShoeDecay, setRedShoeDecay] = useState(globalLev.redShoeDecay)
  const leverageParams = { leverage, marginRate, daysHeld, redShoeDecay }
  const dirty = leverage !== globalLev.leverage || marginRate !== globalLev.marginRate
    || daysHeld !== globalLev.daysHeld || redShoeDecay !== globalLev.redShoeDecay
  const syncToGlobal = () => updateConfig({
    leverageMultiple: leverage,
    leverageMarginRate: marginRate,
    leverageDaysHeld: daysHeld,
    leverageRedShoeDecay: redShoeDecay,
  })
  const resetFromGlobal = () => {
    setLeverage(globalLev.leverage); setMarginRate(globalLev.marginRate)
    setDaysHeld(globalLev.daysHeld); setRedShoeDecay(globalLev.redShoeDecay)
  }

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

  // 杠杆回放：用真实历史数据 + 当前杠杆参数算「如果开 N 倍杠杆当时能赚多少」
  const levEvals = useMemo(() => {
    const map: Record<string, ReturnType<typeof leveragedActualProfit>> = {}
    filtered.forEach((h) => {
      const base = h.entryFee ?? 0
      const actualHit = h.applicants && h.winners ? h.winners / h.applicants : oneLotHitRate(h.subscriptionMultiple, 1.4)
      map[h.code] = leveragedActualProfit(h.profitPerLot ?? 0, actualHit, base, leverageParams)
    })
    return map
  }, [filtered, leverage, marginRate, daysHeld, redShoeDecay])

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
    // 杠杆汇总
    const levNetSum = filtered.reduce((a, h) => a + (levEvals[h.code]?.netProfit ?? 0), 0)
    const levCostSum = filtered.reduce((a, h) => a + (levEvals[h.code]?.financeCost ?? 0), 0)
    const levSelfSum = filtered.reduce((a, h) => a + (h.entryFee ?? 0), 0)
    const levRoi = levSelfSum > 0 ? (levNetSum / levSelfSum) * 100 : 0
    const levLift = sumProfit > 0 ? levNetSum / sumProfit : 0
    return {
      total, profitable,
      hitRate: (profitable / total) * 100,
      avgProfit: sumProfit / total,
      avgDark: sumDark / total,
      avgFirst: sumFirst / total,
      totalProfit, totalCost, roi,
      modelCorrect: correct, modelWrong: wrong, modelAcc,
      levNetSum, levCostSum, levSelfSum, levRoi, levLift,
    }
  }, [filtered, lotsAssumed, modelEvals, levEvals])

  // ★ 分机制准确率（评估线上策略在不同机制下的可靠性）
  const mechBreakdown = useMemo(() => {
    const groups: Record<string, HistoricalIpo[]> = {}
    filtered.forEach((h) => {
      const k = h.mechanism ?? 'OTHER'
      if (!groups[k]) groups[k] = []
      groups[k].push(h)
    })
    return Object.entries(groups).map(([mech, arr]) => {
      const total = arr.length
      const profitable = arr.filter((h) => (h.profitPerLot ?? 0) > 0).length
      const correct = arr.filter((h) => modelEvals[h.code]?.modelAccuracy === 'correct').length
      const wrong = arr.filter((h) => modelEvals[h.code]?.modelAccuracy === 'wrong').length
      const partial = total - correct - wrong
      const avgProfit = arr.reduce((a, h) => a + (h.profitPerLot ?? 0), 0) / total
      const avgDark = arr.reduce((a, h) => a + (h.darkChangePct ?? 0), 0) / total
      const avgFirst = arr.reduce((a, h) => a + (h.firstDayChangePct ?? 0), 0) / total
      const levNet = arr.reduce((a, h) => a + (levEvals[h.code]?.netProfit ?? 0), 0)
      const levSelf = arr.reduce((a, h) => a + (h.entryFee ?? 0), 0)
      const levRoi = levSelf > 0 ? (levNet / levSelf) * 100 : 0
      return {
        mech, total, profitable,
        winRate: total ? (profitable / total) * 100 : 0,
        correct, wrong, partial,
        modelAcc: total ? (correct / total) * 100 : 0,
        avgProfit, avgDark, avgFirst,
        levNet, levRoi,
      }
    }).sort((a, b) => b.total - a.total)
  }, [filtered, modelEvals, levEvals])

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

      {/* ★ 杠杆参数面板 — 充分利用 10 倍融资 */}
      <section className="border-2 border-accent p-5 bg-accent/5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-accent mb-1">LEVERAGE · 杠杆融资模型</div>
            <h3 className="font-serif text-xl">{leverage}× 孖展打新 — 实战模拟</h3>
            <p className="text-xs text-ink-mute mt-1">用真实历史数据回放：如果当时开 N 倍杠杆，扣掉融资利息后还剩多少。</p>
            <p className="text-[10px] text-accent mt-1 italic">
              {dirty ? '⚠ 当前参数是本页临时草稿，未同步到全局' : '✓ 当前参数 = §IX 全局配置'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-ink-mute">假设单只自有 1 万 HKD</div>
            <div className="num display text-2xl text-accent">{(leverage * 10000).toLocaleString()} <span className="text-xs">购买力</span></div>
            {dirty && (
              <div className="mt-2 flex gap-1 justify-end">
                <button onClick={syncToGlobal} className="text-[10px] uppercase tracking-widest px-2 py-1 bg-accent text-paper hover:opacity-80">同步回全局 →</button>
                <button onClick={resetFromGlobal} className="text-[10px] uppercase tracking-widest px-2 py-1 border border-ink hover:bg-ink hover:text-paper">重置</button>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] tracking-[0.25em] uppercase text-ink-soft mb-1.5">
              <InfoTip title="杠杆倍数" formula="购买力 = 自有 × 杠杆。10x 是港股孖展常见上限">杠杆倍数</InfoTip>
            </div>
            <input type="number" min={1} max={20} step={0.5} value={leverage} onChange={(e) => setLeverage(Math.max(1, +e.target.value || 1))}
              className="w-full bg-transparent border-b border-ink/50 focus:border-accent outline-none py-1.5 text-sm font-mono"/>
            <div className="text-[10px] text-ink-mute mt-1">大行 5-10x · 卷商 10-20x</div>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.25em] uppercase text-ink-soft mb-1.5">
              <InfoTip title="年化融资利率" formula="融资成本 = 借入金额 × 年化利率 × 占用天数/365">年化利率 %</InfoTip>
            </div>
            <input type="number" min={0} max={20} step={0.1} value={marginRate} onChange={(e) => setMarginRate(Math.max(0, +e.target.value || 0))}
              className="w-full bg-transparent border-b border-ink/50 focus:border-accent outline-none py-1.5 text-sm font-mono"/>
            <div className="text-[10px] text-ink-mute mt-1">大行 2.5-4% · 卷商 4-8%</div>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.25em] uppercase text-ink-soft mb-1.5">
              <InfoTip title="资金占用天数" formula="一般 T 日申购 → T+5/7 退款，约 5-7 自然日">占用天数</InfoTip>
            </div>
            <input type="number" min={1} max={14} value={daysHeld} onChange={(e) => setDaysHeld(Math.max(1, +e.target.value || 1))}
              className="w-full bg-transparent border-b border-ink/50 focus:border-accent outline-none py-1.5 text-sm font-mono"/>
            <div className="text-[10px] text-ink-mute mt-1">大多 5-7 天</div>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.25em] uppercase text-ink-soft mb-1.5">
              <InfoTip
                title="红鞋衰减系数"
                formula="期望中签手数 ≈ 杠杆 × 一手率 × 衰减系数"
                steps={[
                  '0.5：杠杆派发严格按比例衰减（保守）',
                  '0.7：默认 — 经验值，10x 申购约能拿到 5-7x 中签',
                  '1.0：完全线性放大（过于乐观，红鞋不会这样派）',
                ]}
              >红鞋衰减</InfoTip>
            </div>
            <input type="number" min={0.3} max={1} step={0.05} value={redShoeDecay} onChange={(e) => setRedShoeDecay(Math.max(0.3, Math.min(1, +e.target.value || 0.7)))}
              className="w-full bg-transparent border-b border-ink/50 focus:border-accent outline-none py-1.5 text-sm font-mono"/>
            <div className="text-[10px] text-ink-mute mt-1">推荐 0.6 - 0.8</div>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-accent/20">
            <div className="border-2 border-ink p-4 bg-paper">
              <div className="text-[10px] uppercase tracking-widest text-ink-mute">
                <InfoTip title="纯现金组合收益" formula="Σ 每支单手实际盈利（不开杠杆）">现金 baseline</InfoTip>
              </div>
              <div className={`num display text-2xl ${stats.avgProfit >= 0 ? 'text-accent' : 'text-accent-2'}`}>{HKD(filtered.reduce((a, b) => a + (b.profitPerLot ?? 0), 0), false)}</div>
              <div className="text-[11px] text-ink-mute">{filtered.length} 支 · 各中 1 手</div>
            </div>
            <div className="border-2 border-accent p-4 bg-accent/5">
              <div className="text-[10px] uppercase tracking-widest text-accent">
                <InfoTip
                  title={`${leverage}x 杠杆净期望`}
                  formula="Σ (期望中签手数 × 单手盈利) - Σ 融资利息"
                  steps={[
                    { label: '杠杆倍数', value: leverage + 'x' },
                    { label: '红鞋衰减', value: redShoeDecay },
                    { label: '总融资利息', value: HKD(stats.levCostSum) },
                    { label: '杠杆净期望', value: HKD(stats.levNetSum) },
                  ]}
                >
                  {leverage}x 净期望
                </InfoTip>
              </div>
              <div className={`num display text-3xl ${stats.levNetSum >= 0 ? 'text-accent' : 'text-accent-2'}`}>{HKD(stats.levNetSum, false)}</div>
              <div className="text-[11px] text-ink-mute">利息 -{HKD(stats.levCostSum, false)}</div>
            </div>
            <div className="border-2 border-ink p-4 bg-paper">
              <div className="text-[10px] uppercase tracking-widest text-ink-mute">
                <InfoTip title="自有资金 ROI" formula="杠杆净期望 / Σ 自有入场费 × 100%">自有 ROI</InfoTip>
              </div>
              <div className={`num display text-3xl ${stats.levRoi >= 0 ? 'text-accent' : 'text-accent-2'}`}>{Pct(stats.levRoi)}</div>
              <div className="text-[11px] text-ink-mute">自有 {HKD(stats.levSelfSum, false)}</div>
            </div>
            <div className="border-2 border-ink p-4 bg-paper">
              <div className="text-[10px] uppercase tracking-widest text-ink-mute">
                <InfoTip title="杠杆放大倍数" formula="杠杆净期望 / 现金 baseline">vs 现金</InfoTip>
              </div>
              <div className={`num display text-3xl ${stats.levLift >= 1 ? 'text-accent' : 'text-accent-2'}`}>{stats.levLift.toFixed(2)}<span className="text-base font-sans">x</span></div>
              <div className="text-[11px] text-ink-mute">{stats.levLift >= 1 ? '放大有效' : '反被利息侵蚀'}</div>
            </div>
          </div>
        )}
      </section>

      {/* ★ 分机制策略评估 */}
      {mechBreakdown.length > 0 && (
        <section className="border border-ink p-5 bg-paper-2/30">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute mb-1">STRATEGY × MECHANISM</div>
              <h3 className="font-serif text-xl">分机制：线上策略评估</h3>
            </div>
            <div className="text-[11px] text-ink-mute italic">不同机制下模型表现差异 — 找出策略最该重仓的板块</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink text-paper">
                <tr className="text-left">
                  <th className="px-3 py-2 font-serif">机制</th>
                  <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-right">样本</th>
                  <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-right">实际盈利率</th>
                  <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-right">模型准确率</th>
                  <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-right">✓ / ✗ / ~</th>
                  <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-right">均暗盘</th>
                  <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-right">均首日</th>
                  <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-right">均单手</th>
                  <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-right">{leverage}x 净收益</th>
                  <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-right">{leverage}x ROI</th>
                  <th className="px-3 py-2 text-[10px] uppercase tracking-widest text-center">线上策略</th>
                </tr>
              </thead>
              <tbody>
                {mechBreakdown.map((r, i) => {
                  const mechName = r.mech === 'B' ? '机制B' : r.mech
                  // 线上策略推荐：模型准确率高 + 实际盈利率高 + 杠杆 ROI 为正 → 重仓
                  let strategyLabel = '观望'
                  let strategyVariant: 'success' | 'warn' | 'mute' | 'accent' = 'mute'
                  if (r.modelAcc >= 70 && r.winRate >= 70 && r.levRoi > 0) {
                    strategyLabel = '★ 重仓杠杆'
                    strategyVariant = 'success'
                  } else if (r.modelAcc >= 50 && r.winRate >= 50 && r.levRoi > 0) {
                    strategyLabel = '现金常规'
                    strategyVariant = 'accent'
                  } else if (r.winRate < 50 || r.levRoi < 0) {
                    strategyLabel = '⚠ 谨慎/跳过'
                    strategyVariant = 'warn'
                  }
                  return (
                    <tr key={r.mech} className={`border-b border-rule ${i % 2 === 0 ? 'bg-paper' : 'bg-paper-2/30'}`}>
                      <td className="px-3 py-2 font-serif">{mechName}</td>
                      <td className="px-2 py-2 text-right font-mono">{r.total}</td>
                      <td className={`px-2 py-2 text-right font-mono ${r.winRate >= 50 ? 'text-accent' : 'text-accent-2'}`}>{r.winRate.toFixed(0)}%</td>
                      <td className={`px-2 py-2 text-right font-mono ${r.modelAcc >= 60 ? 'text-accent' : r.modelAcc >= 40 ? 'text-ink' : 'text-accent-2'}`}>{r.modelAcc.toFixed(0)}%</td>
                      <td className="px-2 py-2 text-right font-mono text-xs">
                        <span className="text-accent">{r.correct}</span> / <span className="text-accent-2">{r.wrong}</span> / <span className="text-ink-mute">{r.partial}</span>
                      </td>
                      <td className={`px-2 py-2 text-right font-mono text-xs ${r.avgDark >= 0 ? 'text-accent' : 'text-accent-2'}`}>{Pct(r.avgDark)}</td>
                      <td className={`px-2 py-2 text-right font-mono text-xs ${r.avgFirst >= 0 ? 'text-accent' : 'text-accent-2'}`}>{Pct(r.avgFirst)}</td>
                      <td className={`px-2 py-2 text-right font-mono ${r.avgProfit >= 0 ? 'text-accent' : 'text-accent-2'}`}>{HKD(r.avgProfit, false)}</td>
                      <td className={`px-2 py-2 text-right font-mono ${r.levNet >= 0 ? 'text-accent' : 'text-accent-2'}`}>{HKD(r.levNet, false)}</td>
                      <td className={`px-2 py-2 text-right font-mono ${r.levRoi >= 0 ? 'text-accent' : 'text-accent-2'}`}>{Pct(r.levRoi)}</td>
                      <td className="px-3 py-2 text-center"><Tag variant={strategyVariant}>{strategyLabel}</Tag></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-[11px] text-ink-mute italic">
            策略含义：
            <span className="text-accent">★ 重仓杠杆</span> = 模型准≥70% & 实际盈利率≥70% & 杠杆 ROI&gt;0；
            <span className="text-accent">现金常规</span> = 中等准确度，建议现金 1 手；
            <span className="text-accent-2">⚠ 谨慎</span> = 模型表现差或亏损，建议跳过。
          </div>
        </section>
      )}

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
                  <th className="px-2 py-3 text-[10px] uppercase tracking-widest text-right bg-accent/20">{leverage}×净ROI</th>
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
                      <td className="px-2 py-3 text-right bg-accent/5">
                        {(() => {
                          const lv = levEvals[h.code]
                          if (!lv || !h.entryFee) return <span className="text-ink-mute text-xs">—</span>
                          const ok = lv.netProfit >= 0
                          return (
                            <InfoTip
                              title={`${leverage}x 扣融资后净 ROI`}
                              formula="(期望中签手数×单手盈利 - 融资利息) / 自有资金"
                              steps={[
                                { label: '自有资金', value: HKD(h.entryFee) },
                                { label: '期望中签', value: `${lv.hitLots.toFixed(2)} 手` },
                                { label: '毛利', value: HKD(lv.grossProfit) },
                                { label: '- 融资利息', value: HKD(lv.financeCost) },
                                { label: '= 净盈亏', value: HKD(lv.netProfit) },
                                { label: '÷ 自有 = ROI', value: lv.roiOnSelf.toFixed(1) + '%' },
                              ]}
                            >
                              <span className={`font-mono font-bold ${ok ? 'text-accent' : 'text-accent-2'}`}>
                                {ok ? '+' : ''}{lv.roiOnSelf.toFixed(1)}%
                              </span>
                              <div className={`text-[9px] font-mono ${ok ? 'text-accent/70' : 'text-accent-2/70'}`}>{HKD(lv.netProfit, false)}</div>
                            </InfoTip>
                          )
                        })()}
                      </td>
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
