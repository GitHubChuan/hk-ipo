// 港股打新决策引擎 — 核心数学模型

import type { Ipo, Subscription } from './types'

// 港股一手入场费（含手续费）
export function calcEntryFee(priceHigh: number, lotSize: number): number {
  return priceHigh * lotSize * 1.0077
}

// 数学期望中签率（无红鞋机制）= 1 / oversubMultiple
export function baseHitRate(oversubMultiple?: number): number {
  if (!oversubMultiple || oversubMultiple <= 0) return 1
  return 1 / oversubMultiple
}

// 一手党在红鞋机制下的实际中签率（经验：超购越高，红鞋分配越倾向小户）
// 简化模型：hit_one_lot ≈ min(1, baseHit × redShoeBoost)，超购<10倍时基本100%
export function oneLotHitRate(oversubMultiple?: number, redShoeBoost = 1.4): number {
  if (!oversubMultiple || oversubMultiple <= 1) return 1
  if (oversubMultiple < 10) return Math.min(1, 0.95)
  const rate = (1 / oversubMultiple) * redShoeBoost
  // 红鞋机制保证一手党最少有10%~30%的概率（取决于超购倍数与发行规模）
  const floor = oversubMultiple < 50 ? 0.5 : oversubMultiple < 200 ? 0.3 : 0.15
  return Math.min(1, Math.max(rate, floor))
}

// 中签金额（一手党） = 一手中签率 × 一手入场费 × 预期涨幅%
// 单位：HKD 净利润期望（不计融资成本）
export function expectedProfitOneLot(ipo: Ipo): number {
  const fee = ipo.entryFee || calcEntryFee(ipo.priceHigh, ipo.lotSize)
  const hit = oneLotHitRate(ipo.oversubMultiple, ipo.redShoeBoost ?? 1.4)
  const rise = (ipo.expectedRise ?? 0) / 100
  return hit * fee * rise
}

// 综合赚钱期望（核心打分指标）— 基于一手现金申购
// 输入：质量分(1-10)、预期涨幅、超购倍数
export function profitExpectationScore(ipo: Ipo): {
  expectedProfit: number // 一手现金期望利润 (HKD)
  hitRate: number // 一手中签率 0~1
  recommendation: 'strong_buy' | 'buy' | 'neutral' | 'skip'
  rationale: string
} {
  const hitRate = oneLotHitRate(ipo.oversubMultiple, ipo.redShoeBoost ?? 1.4)
  const expectedProfit = expectedProfitOneLot(ipo)

  const q = ipo.aiQualityScore ?? 5
  const rise = ipo.expectedRise ?? 0

  let recommendation: 'strong_buy' | 'buy' | 'neutral' | 'skip' = 'neutral'
  const parts: string[] = []

  if (q >= 8 && rise >= 15 && expectedProfit > 200) {
    recommendation = 'strong_buy'
    parts.push('优质标的、预期涨幅充足、单手期望利润可观')
  } else if (q >= 6 && rise >= 8 && expectedProfit > 80) {
    recommendation = 'buy'
    parts.push('质地不错，期望利润为正，可参与')
  } else if (rise <= 0 || q <= 4) {
    recommendation = 'skip'
    parts.push('质量或预期涨幅不足，建议放弃')
  } else {
    parts.push('期望偏低，可少量参与或观望')
  }

  parts.push(`一手中签率 ${(hitRate * 100).toFixed(1)}%`)
  parts.push(`单手期望利润 HK$ ${expectedProfit.toFixed(0)}`)

  return {
    expectedProfit,
    hitRate,
    recommendation,
    rationale: parts.join(' · '),
  }
}

// 多标的并发时按"赚钱期望"排序，并给出额度分配建议
// 资金分配核心：按期望从高到低，每只标的"先把高期望吃饱再分配低期望"
export function allocateBudget(
  ipos: Ipo[],
  totalBudget: number,
  partnersCount: number,
): Array<{
  ipoId: string
  expectedProfit: number
  recommendedLots: number // 建议每个账户申购手数
  totalCost: number // 团队总投入 (现金)
  fundsBlocked: number // 占用资金 (HKD)
  rationale: string
}> {
  // 计算每只股票的期望
  const ranked = ipos
    .filter((i) => i.decision !== 'skip')
    .map((ipo) => {
      const score = profitExpectationScore(ipo)
      return { ipo, score }
    })
    .sort((a, b) => b.score.expectedProfit - a.score.expectedProfit)

  let remaining = totalBudget
  const result: Array<{
    ipoId: string
    expectedProfit: number
    recommendedLots: number
    totalCost: number
    fundsBlocked: number
    rationale: string
  }> = []

  for (const { ipo, score } of ranked) {
    const fee = ipo.entryFee || calcEntryFee(ipo.priceHigh, ipo.lotSize)
    if (fee <= 0) continue

    let lotsPerAccount = 1 // 默认每个账户一手（红鞋策略）
    let rationale = ''

    if (score.recommendation === 'strong_buy') {
      // 强烈建议：尽可能扩大申购规模（预算允许时多手）
      const maxLots = Math.floor(remaining / (fee * partnersCount))
      lotsPerAccount = Math.max(1, Math.min(50, maxLots))
      rationale = `强烈推荐 · 每账户 ${lotsPerAccount} 手 · 期望最高优先吃满预算`
    } else if (score.recommendation === 'buy') {
      lotsPerAccount = 1
      rationale = `推荐 · 每账户 1 手 · 红鞋套利策略`
    } else if (score.recommendation === 'neutral') {
      lotsPerAccount = 1
      rationale = `中性 · 每账户 1 手 · 期望偏低但保留参与机会`
    } else {
      continue
    }

    const cost = fee * lotsPerAccount * partnersCount
    if (cost > remaining) {
      // 预算不足时降级
      const possible = Math.floor(remaining / (fee * partnersCount))
      if (possible <= 0) {
        rationale = `预算耗尽 · 跳过`
        continue
      }
      lotsPerAccount = possible
    }
    const finalCost = fee * lotsPerAccount * partnersCount
    remaining -= finalCost

    result.push({
      ipoId: ipo.id,
      expectedProfit: score.expectedProfit * lotsPerAccount * partnersCount,
      recommendedLots: lotsPerAccount,
      totalCost: finalCost,
      fundsBlocked: finalCost,
      rationale,
    })
  }

  return result
}

// 卖出策略评估
export function exitStrategyAdvice(ipo: Ipo): {
  action: 'hold' | 'sell_dark' | 'sell_open' | 'sell_partial' | 'stop_loss'
  message: string
} {
  const open = ipo.listingOpenPrice
  if (!open) return { action: 'hold', message: '尚未上市，按计划申购' }

  const high = ipo.priceHigh
  const upPct = ((open - high) / high) * 100

  if (upPct < -10) {
    return { action: 'stop_loss', message: `已破发 ${upPct.toFixed(1)}%，立即止损出清` }
  }
  if (upPct >= 30) {
    return {
      action: 'sell_dark',
      message: `暗盘/开盘涨幅 ${upPct.toFixed(1)}% 已达阈值，建议立即出货锁利`,
    }
  }
  if (upPct >= 15) {
    return {
      action: 'sell_partial',
      message: `涨幅 ${upPct.toFixed(1)}%，建议先出一半锁利，余下博弈`,
    }
  }
  if (upPct >= 5) {
    return { action: 'sell_open', message: `小幅上涨 ${upPct.toFixed(1)}%，开盘平仓即可` }
  }
  return { action: 'hold', message: `涨幅 ${upPct.toFixed(1)}%，观望或低位减持` }
}

// 计算单只股票的实际净利润 + 分润
export function calcSettlement(
  ipo: Ipo,
  subs: Subscription[],
  partnerShareRatios: Record<string, number>,
  mainPartnerId?: string,
): {
  totalRevenue: number
  totalCost: number
  marginCost: number
  netProfit: number
  mainCoverage: number
  distributions: Array<{ partnerId: string; amount: number; ratio: number }>
} {
  const ipoSubs = subs.filter((s) => s.ipoId === ipo.id)
  const exitPrice = ipo.exitPrice ?? ipo.listingOpenPrice ?? 0

  let totalRevenue = 0
  let totalCost = 0
  let marginCost = 0

  for (const s of ipoSubs) {
    const allocated = s.lotsAllocated ?? 0
    const cost = (ipo.entryFee || calcEntryFee(ipo.priceHigh, ipo.lotSize)) * allocated
    const revenue = exitPrice * ipo.lotSize * allocated
    totalCost += cost
    totalRevenue += revenue
    marginCost += s.marginCost ?? 0
  }

  // 主理人兜底融资费
  const mainCoverage = ipoSubs
    .filter((s) => s.feeCoveredByMain)
    .reduce((acc, s) => acc + (s.marginCost ?? 0), 0)

  const netProfit = totalRevenue - totalCost - (marginCost - mainCoverage)

  // 按合伙人比例分润
  const sumRatio = Object.values(partnerShareRatios).reduce((a, b) => a + b, 0) || 1
  const distributions = Object.entries(partnerShareRatios).map(([pid, r]) => ({
    partnerId: pid,
    ratio: r / sumRatio,
    amount: (netProfit * r) / sumRatio,
  }))

  // 主理人因兜底应额外拿回兜底成本 — 转为分润后的调整
  if (mainPartnerId && mainCoverage > 0) {
    const mainEntry = distributions.find((d) => d.partnerId === mainPartnerId)
    if (mainEntry) mainEntry.amount += mainCoverage
    // 其他人按比例扣减以保持总和不变
    const others = distributions.filter((d) => d.partnerId !== mainPartnerId)
    const totalOtherRatio = others.reduce((a, b) => a + b.ratio, 0)
    for (const o of others) {
      o.amount -= mainCoverage * (o.ratio / (totalOtherRatio || 1))
    }
  }

  return {
    totalRevenue,
    totalCost,
    marginCost,
    netProfit,
    mainCoverage,
    distributions,
  }
}
