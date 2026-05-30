import { useState, useEffect, useMemo } from 'react'
import { useStore, useScopedData, useIsAdmin } from '@/lib/store'
import { calcEntryFee, profitExpectationScore, oneLotHitRate } from '@/lib/engine'
import type { Ipo } from '@/lib/types'
import { getHistoricalIpos, type IpoCalendarEntry } from '@/lib/market'
import {
  SectionTitle,
  Tag,
  HKD,
  Pct,
  PrimaryButton,
  GhostButton,
  Field,
  TextInput,
  Select,
  EmptyState,
  InfoTip,
} from '@/components/shared/Editorial'

const emptyDraft: Omit<Ipo, 'id' | 'createdAt' | 'updatedAt'> = {
  code: '',
  name: '',
  industry: '',
  priceLow: 0,
  priceHigh: 0,
  lotSize: 100,
  entryFee: 0,
  status: 'evaluating',
  aiQualityScore: 7,
  expectedRise: 10,
  oversubMultiple: 50,
  redShoeBoost: 1.4,
  mechanism: 'B',
} as any

type Props = {
  focusEntry?: IpoCalendarEntry | null
  onConsumeFocus?: () => void
}

export default function EvaluationTab({ focusEntry, onConsumeFocus }: Props) {
  const isAdmin = useIsAdmin()
  const { ipos } = useScopedData()
  const { addIpo, updateIpo, removeIpo } = useStore()
  const [draft, setDraft] = useState<typeof emptyDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showBacktest, setShowBacktest] = useState(true)
  const [filterCode, setFilterCode] = useState('')

  // 从新股日历跳转：预填 draft，并自动定位到已存在的 ipo
  useEffect(() => {
    if (!focusEntry) return
    const existing = focusEntry.code ? ipos.find((x) => x.code === focusEntry.code) : undefined
    if (existing) {
      startEdit(existing)
      // 顺便用回测过滤同代码
      setFilterCode(existing.code.replace(/[^0-9]/g, ''))
    } else {
      setDraft({
        ...emptyDraft,
        code: focusEntry.code ?? '',
        name: focusEntry.name,
        industry: focusEntry.industry ?? '',
        priceLow: focusEntry.priceLow ?? 0,
        priceHigh: focusEntry.priceHigh ?? 0,
        lotSize: focusEntry.lotSize ?? 100,
        entryFee: focusEntry.entryFeeMid ?? calcEntryFee(focusEntry.priceHigh ?? 0, focusEntry.lotSize ?? 100),
        mechanism: focusEntry.mechanism,
        issueLots: focusEntry.issueLots,
        issueAmount: focusEntry.issueAmount,
        subscriptionEnd: focusEntry.subscriptionEnd,
        listingDate: focusEntry.listingDate,
        status: 'evaluating',
        aiQualityScore: 7,
        expectedRise: 10,
        oversubMultiple: 50,
        redShoeBoost: 1.4,
      } as any)
    }
    onConsumeFocus?.()
    // 滚到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusEntry])

  const startEdit = (ipo: Ipo) => {
    setEditingId(ipo.id)
    setDraft({
      code: ipo.code,
      name: ipo.name,
      industry: ipo.industry ?? '',
      priceLow: ipo.priceLow,
      priceHigh: ipo.priceHigh,
      lotSize: ipo.lotSize,
      entryFee: ipo.entryFee,
      status: ipo.status,
      aiQualityScore: ipo.aiQualityScore,
      expectedRise: ipo.expectedRise,
      oversubMultiple: ipo.oversubMultiple,
      redShoeBoost: ipo.redShoeBoost ?? 1.4,
      decisionReason: ipo.decisionReason,
      notes: ipo.notes,
      mechanism: (ipo as any).mechanism,
      issueLots: (ipo as any).issueLots,
      issueAmount: (ipo as any).issueAmount,
      subscriptionEnd: ipo.subscriptionEnd,
      listingDate: ipo.listingDate,
    } as any)
  }

  const reset = () => { setDraft(emptyDraft); setEditingId(null) }

  const submit = () => {
    if (!draft.code || !draft.name) return alert('请填写股票代码与名称')
    const fee = (draft as any).entryFee || calcEntryFee(draft.priceHigh, draft.lotSize)
    const data = { ...draft, entryFee: fee }
    if (editingId) updateIpo(editingId, data)
    else addIpo(data)
    reset()
  }

  const previewIpo: Ipo = {
    ...(emptyDraft as any),
    ...draft,
    id: 'preview',
    createdAt: 0,
    updatedAt: 0,
    entryFee: calcEntryFee(draft.priceHigh, draft.lotSize),
  }
  const preview = profitExpectationScore(previewIpo)
  const hit = oneLotHitRate(previewIpo.oversubMultiple, previewIpo.redShoeBoost ?? 1.4)
  const baseHit = previewIpo.oversubMultiple ? 1 / previewIpo.oversubMultiple : 1
  const floor = (previewIpo.oversubMultiple ?? 0) < 50 ? 0.5 : (previewIpo.oversubMultiple ?? 0) < 200 ? 0.3 : 0.15

  // 历史回测
  const historical = useMemo(() => getHistoricalIpos(), [])
  const filtered = useMemo(() => {
    if (!filterCode) return historical
    const fc = filterCode.replace(/[^0-9]/g, '')
    if (!fc) return historical
    return historical.filter((h) => h.code.includes(fc))
  }, [filterCode, historical])

  // 回测统计
  const stats = useMemo(() => {
    const list = filtered
    if (list.length === 0) return null
    const profitable = list.filter((h) => (h.profitPerLot ?? 0) > 0)
    const avgDark = list.reduce((a, b) => a + (b.darkChangePct ?? 0), 0) / list.length
    const avgFirst = list.reduce((a, b) => a + (b.firstDayChangePct ?? 0), 0) / list.length
    const avgProfit = list.reduce((a, b) => a + (b.profitPerLot ?? 0), 0) / list.length
    const avgSubMul = list.filter((h) => h.subscriptionMultiple).reduce((a, b) => a + (b.subscriptionMultiple ?? 0), 0) / Math.max(1, list.filter((h) => h.subscriptionMultiple).length)
    return {
      count: list.length,
      hitRate: (profitable.length / list.length) * 100,
      avgDark, avgFirst, avgProfit, avgSubMul,
    }
  }, [filtered])

  return (
    <div className="space-y-12">
      <SectionTitle
        index="III"
        en="Evaluation Desk"
        zh="标的评估"
        desc='评估的核心是「打不打 · 打多少」，由"赚钱期望 = 一手中签率 × 一手金额 × 预期涨幅"决定。所有数字均可悬停查看公式。'
      />

      {isAdmin && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 border border-ink p-6 bg-paper-2/40">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-2xl">{editingId ? '编辑标的' : '录入新股标的'}</h3>
              <Tag variant="mute">{editingId ? 'EDITING' : 'NEW ENTRY'}</Tag>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <Field label="股票代码">
                <TextInput value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="02555.HK" />
              </Field>
              <Field label="股票名称">
                <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="例如 茶百道" />
              </Field>
              <Field label="所属行业">
                <TextInput value={draft.industry ?? ''} onChange={(e) => setDraft({ ...draft, industry: e.target.value })} placeholder="医疗 / 消费 / 科技…" />
              </Field>
              <Field label="机制类型">
                <Select
                  value={(draft as any).mechanism ?? 'B'}
                  onChange={(e) => setDraft({ ...draft, mechanism: e.target.value as any } as any)}
                  options={[
                    { value: 'B', label: '机制B（一般主板）' },
                    { value: '18C', label: '18C（特专科技）' },
                    { value: 'A', label: '机制A（旧机制）' },
                    { value: 'SPAC', label: 'SPAC' },
                    { value: 'GEM', label: 'GEM 创业板' },
                    { value: 'OTHER', label: '其他' },
                  ]}
                />
              </Field>
              <Field label="招股价下限 (HKD)">
                <TextInput type="number" step={0.01} value={draft.priceLow} onChange={(e) => setDraft({ ...draft, priceLow: +e.target.value })} />
              </Field>
              <Field label={<InfoTip title="招股价上限" formula="一手金额 = 上限 × 每手股数 × 1.0077" steps={[`公式中 1.0077 = 1% 经纪佣金 + 0.27% 港交所 / 中央结算 / 印花税`]}>招股价上限 (HKD)</InfoTip>}>
                <TextInput type="number" step={0.01} value={draft.priceHigh} onChange={(e) => setDraft({ ...draft, priceHigh: +e.target.value })} />
              </Field>
              <Field label="每手股数">
                <TextInput type="number" value={draft.lotSize} onChange={(e) => setDraft({ ...draft, lotSize: +e.target.value })} />
              </Field>
              <Field label="发行手数（公开发售）">
                <TextInput type="number" value={(draft as any).issueLots ?? 0} onChange={(e) => setDraft({ ...draft, issueLots: +e.target.value } as any)} placeholder="例：48,952" />
              </Field>
              <Field label="募集资金（万 HKD）">
                <TextInput type="number" value={(draft as any).issueAmount ?? 0} onChange={(e) => setDraft({ ...draft, issueAmount: +e.target.value } as any)} placeholder="例：13,800（即 1.38 亿）" />
              </Field>
              <Field label="申购截止日">
                <TextInput type="date" value={draft.subscriptionEnd ?? ''} onChange={(e) => setDraft({ ...draft, subscriptionEnd: e.target.value })} />
              </Field>
              <Field label="预期上市日">
                <TextInput type="date" value={draft.listingDate ?? ''} onChange={(e) => setDraft({ ...draft, listingDate: e.target.value })} />
              </Field>
              <Field label="状态">
                <Select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as Ipo['status'] })}
                  options={[
                    { value: 'watching', label: '观察中' },
                    { value: 'evaluating', label: '评估中' },
                    { value: 'decided_go', label: '决策：参与' },
                    { value: 'decided_skip', label: '决策：放弃' },
                    { value: 'subscribed', label: '已申购' },
                    { value: 'listed', label: '已上市' },
                    { value: 'closed', label: '已结清' },
                  ]}
                />
              </Field>
              <Field label={<InfoTip title="超购倍数 → 一手中签率" formula="基础概率 = 1 / 超购倍数；红鞋机制下小户实际更高">超购倍数 (×)</InfoTip>}>
                <TextInput type="number" value={draft.oversubMultiple ?? 0} onChange={(e) => setDraft({ ...draft, oversubMultiple: +e.target.value })} />
              </Field>
              <Field label={<InfoTip title="质量评分 (1-10)" formula="主观打分，影响推荐档位（≥8 强烈推荐）" steps={["8+ 优质行业 / 头部公司 / 财务健康", "6-7 中等质地", "≤4 不建议参与"]}>质量评分 (1–10)</InfoTip>}>
                <TextInput type="number" min={1} max={10} step={0.1} value={draft.aiQualityScore ?? 0} onChange={(e) => setDraft({ ...draft, aiQualityScore: +e.target.value })} />
              </Field>
              <Field label={<InfoTip title="预期首日涨幅" formula="期望利润 = 中签金额 × 涨幅%；正负皆可填" steps={["参考：基石认购占比、孖展超购、行业热度、可比上市表现"]}>预期首日涨幅 (%)</InfoTip>}>
                <TextInput type="number" step={0.1} value={draft.expectedRise ?? 0} onChange={(e) => setDraft({ ...draft, expectedRise: +e.target.value })} />
              </Field>
              <Field label={<InfoTip title="红鞋小资金优势倍数" formula="一手中签率 = min(1, max(1/超购×系数, 红鞋下限))" steps={["默认 1.4：经验值，越大越偏向一手党", "可根据券商红鞋分配习惯微调"]}>红鞋系数</InfoTip>}>
                <TextInput type="number" step={0.1} value={draft.redShoeBoost ?? 1.4} onChange={(e) => setDraft({ ...draft, redShoeBoost: +e.target.value })} />
              </Field>
              <Field label="决策备注">
                <TextInput value={draft.decisionReason ?? ''} onChange={(e) => setDraft({ ...draft, decisionReason: e.target.value })} placeholder="如：行业景气度高 / 锚定基石…" />
              </Field>
            </div>

            <div className="flex gap-3 mt-7">
              <PrimaryButton onClick={submit}>{editingId ? '保存修改' : '收录入册'}</PrimaryButton>
              {editingId && <GhostButton onClick={reset}>取消</GhostButton>}
            </div>
          </div>

          <aside className="lg:col-span-5 border border-ink p-6 corner-tag bg-paper">
            <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute mb-2">LIVE SCORING · 实时评分</div>
            <h4 className="font-serif text-3xl mb-1">{draft.name || '尚未录入'}</h4>
            {(draft as any).mechanism && <Tag variant="mute">{(draft as any).mechanism === 'B' ? '机制B' : (draft as any).mechanism}</Tag>}

            <div className="grid grid-cols-2 gap-5 mb-6 mt-5">
              <div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">
                  <InfoTip
                    title="单手入场费"
                    formula="招股上限 × 每手股数 × 1.0077"
                    steps={[
                      { label: '招股上限', value: `HK$ ${draft.priceHigh}` },
                      { label: '每手股数', value: draft.lotSize },
                      { label: '手续费系数', value: '1.0077' },
                      { label: '= 入场费', value: HKD(previewIpo.entryFee) },
                    ]}
                  >
                    单手入场费
                  </InfoTip>
                </div>
                <div className="num display text-3xl">{HKD(previewIpo.entryFee, false)}</div>
                <div className="text-[11px] text-ink-mute">含 1.0077 手续费系数</div>
              </div>
              <div>
                <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">
                  <InfoTip
                    title="一手中签率（红鞋）"
                    formula="min(1, max(1/超购 × 系数, 红鞋下限))"
                    steps={[
                      { label: '基础概率 1/超购', value: `${(baseHit * 100).toFixed(1)}%` },
                      { label: '× 红鞋系数', value: `${draft.redShoeBoost ?? 1.4}` },
                      { label: '红鞋下限', value: `${(floor * 100).toFixed(0)}%` },
                      { label: '= 实际一手中签率', value: `${(hit * 100).toFixed(1)}%` },
                    ]}
                  >
                    一手中签率
                  </InfoTip>
                </div>
                <div className="num display text-3xl">{(preview.hitRate * 100).toFixed(0)}<span className="text-base text-ink-soft ml-1 font-sans">%</span></div>
                <div className="text-[11px] text-ink-mute">红鞋机制加权后</div>
              </div>
            </div>

            <div className="border-t border-ink pt-4">
              <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute mb-1">
                <InfoTip
                  title="单手期望利润"
                  formula="一手中签率 × 一手金额 × 预期涨幅%"
                  steps={[
                    { label: '一手中签率', value: `${(preview.hitRate * 100).toFixed(1)}%` },
                    { label: '一手金额', value: HKD(previewIpo.entryFee) },
                    { label: '预期涨幅', value: Pct(draft.expectedRise) },
                    { label: '= 期望利润', value: HKD(preview.expectedProfit) },
                    '注：负值代表期望亏损，建议放弃',
                  ]}
                >
                  单手期望利润
                </InfoTip>
              </div>
              <div className="num display text-5xl text-accent">{HKD(preview.expectedProfit, false)}</div>
              <div className="text-xs text-ink-soft mt-2 italic">中签金额 × 预期涨幅 = 期望</div>
            </div>

            <div className="mt-6 border-t border-ink pt-4">
              <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute mb-1">
                <InfoTip
                  title="推荐档位决策树"
                  formula="质量分 + 涨幅 + 期望利润 共同决定"
                  steps={[
                    '强烈申购：质量≥8 且 涨幅≥15% 且 期望>200',
                    '推荐参与：质量≥6 且 涨幅≥8% 且 期望>80',
                    '建议放弃：涨幅≤0 或 质量≤4',
                    '其他情况：中性观望',
                  ]}
                >
                  推荐档位
                </InfoTip>
              </div>
              <Tag
                variant={
                  preview.recommendation === 'strong_buy' ? 'accent' :
                  preview.recommendation === 'buy' ? 'success' :
                  preview.recommendation === 'skip' ? 'mute' : 'default'
                }
              >
                {preview.recommendation === 'strong_buy' ? '强烈申购 / Top Pick' :
                  preview.recommendation === 'buy' ? '推荐参与' :
                  preview.recommendation === 'skip' ? '建议放弃' : '中性观望'}
              </Tag>
              <p className="text-sm text-ink-soft mt-3 leading-relaxed">{preview.rationale}</p>
            </div>
          </aside>
        </section>
      )}

      {/* ─── 已收录标的清单 ─── */}
      <section>
        <div className="flex items-center justify-between border-b border-ink pb-3 mb-6">
          <h3 className="font-serif text-2xl">{isAdmin ? `已收录标的 · ${ipos.length}` : `可见标的 · ${ipos.length}`}</h3>
          <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">THE WATCHLIST</span>
        </div>

        {ipos.length === 0 ? (
          <EmptyState title="暂无标的" hint={isAdmin ? '到 §II 新股日历点击招股中标的即可一键导入评估。' : '主理人尚未给你分配标的。'} />
        ) : (
          <div className="space-y-3">
            {ipos.map((ipo) => {
              const score = profitExpectationScore(ipo)
              return (
                <article key={ipo.id} className="grid grid-cols-12 gap-4 items-center border border-rule p-4 bg-paper hover:bg-paper-2/40 transition-colors">
                  <div className="col-span-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Tag
                        variant={
                          score.recommendation === 'strong_buy' ? 'accent' :
                          score.recommendation === 'buy' ? 'success' :
                          score.recommendation === 'skip' ? 'mute' : 'default'
                        }
                      >
                        {score.recommendation === 'strong_buy' ? '强烈申购' :
                          score.recommendation === 'buy' ? '推荐' :
                          score.recommendation === 'skip' ? '放弃' : '中性'}
                      </Tag>
                      {(ipo as any).mechanism && <Tag variant="mute">{(ipo as any).mechanism === 'B' ? '机制B' : (ipo as any).mechanism}</Tag>}
                      {ipo.industry && <span className="text-[10px] tracking-[0.2em] uppercase text-ink-mute">{ipo.industry}</span>}
                    </div>
                    <div className="font-serif text-xl">{ipo.name}</div>
                    <div className="text-xs font-mono text-ink-mute">{ipo.code}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] uppercase text-ink-mute tracking-widest">招股 / 一手</div>
                    <div className="num text-sm">HK$ {ipo.priceHigh.toFixed(2)}</div>
                    <div className="text-xs text-ink-soft">入场 {HKD(ipo.entryFee || calcEntryFee(ipo.priceHigh, ipo.lotSize))}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] uppercase text-ink-mute tracking-widest">超购 / 涨幅</div>
                    <div className="num text-sm">{ipo.oversubMultiple ?? '—'}× / {Pct(ipo.expectedRise)}</div>
                    <div className="text-xs text-ink-soft">质量 {ipo.aiQualityScore ?? '—'} / 10</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] uppercase text-ink-mute tracking-widest">单手期望</div>
                    <div className="num text-lg text-accent">{HKD(score.expectedProfit, false)}</div>
                    <div className="text-xs text-ink-soft">中签率 {(score.hitRate * 100).toFixed(0)}%</div>
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5 items-end">
                    {isAdmin && (
                      <>
                        <button onClick={() => startEdit(ipo)} className="text-xs tracking-widest uppercase underline underline-offset-4 hover:text-accent">编辑</button>
                        <button onClick={() => { if (confirm('删除此标的？')) removeIpo(ipo.id) }} className="text-xs tracking-widest uppercase text-ink-mute hover:text-accent">删除</button>
                      </>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* ─── 历史招股回测（NEW） ─── */}
      <section>
        <div className="flex items-center justify-between border-b-2 border-ink pb-3 mb-6">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-accent">HISTORICAL BACKTEST · 同类回测</div>
            <h3 className="font-serif text-2xl">历史招股回测</h3>
            <p className="text-xs text-ink-soft mt-1 italic">用近期 20 支已上市新股，验证你的策略胜率与平均期望。</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={filterCode}
              onChange={(e) => setFilterCode(e.target.value)}
              placeholder="按代码过滤 03388"
              className="bg-transparent border-b border-ink/50 focus:border-accent outline-none py-1 px-1 font-mono text-xs"
            />
            <GhostButton onClick={() => setShowBacktest((v) => !v)}>{showBacktest ? '收起' : '展开'}</GhostButton>
          </div>
        </div>

        {showBacktest && (
          <>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="border border-ink p-4 bg-paper-2/40">
                  <div className="text-[10px] uppercase tracking-widest text-ink-mute">样本数</div>
                  <div className="num display text-3xl">{stats.count}</div>
                  <div className="text-[11px] text-ink-mute">最近 IPO</div>
                </div>
                <div className="border border-ink p-4 bg-paper-2/40">
                  <div className="text-[10px] uppercase tracking-widest text-ink-mute">
                    <InfoTip title="盈利率" formula="单手盈利>0 的数量 / 总样本数">盈利率</InfoTip>
                  </div>
                  <div className="num display text-3xl text-accent">{stats.hitRate.toFixed(0)}<span className="text-base font-sans">%</span></div>
                  <div className="text-[11px] text-ink-mute">单手赚钱比例</div>
                </div>
                <div className="border border-ink p-4 bg-paper-2/40">
                  <div className="text-[10px] uppercase tracking-widest text-ink-mute">平均暗盘</div>
                  <div className={`num display text-3xl ${stats.avgDark >= 0 ? 'text-accent' : 'text-accent-2'}`}>{Pct(stats.avgDark)}</div>
                </div>
                <div className="border border-ink p-4 bg-paper-2/40">
                  <div className="text-[10px] uppercase tracking-widest text-ink-mute">平均首日</div>
                  <div className={`num display text-3xl ${stats.avgFirst >= 0 ? 'text-accent' : 'text-accent-2'}`}>{Pct(stats.avgFirst)}</div>
                </div>
                <div className="border border-ink p-4 bg-paper-2/40">
                  <div className="text-[10px] uppercase tracking-widest text-ink-mute">
                    <InfoTip title="平均单手盈利" formula="Σ profitPerLot / N">平均单手盈利</InfoTip>
                  </div>
                  <div className="num display text-3xl text-accent">{HKD(stats.avgProfit, false)}</div>
                  <div className="text-[11px] text-ink-mute">超购均值 {stats.avgSubMul.toFixed(0)}×</div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto border border-rule">
              <table className="w-full text-xs">
                <thead className="bg-paper-2 border-b-2 border-ink">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-serif">新股</th>
                    <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-ink-mute">机制</th>
                    <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-ink-mute">上市日</th>
                    <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-ink-mute text-right">发行手数</th>
                    <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-ink-mute text-right">
                      <InfoTip title="申购倍数" formula="公开发售认购总额 / 公开发售部分">超购</InfoTip>
                    </th>
                    <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-ink-mute text-right">中签人数</th>
                    <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-ink-mute text-right">
                      <InfoTip title="一手中签率" formula="中签人数 / 申购人数">一手率</InfoTip>
                    </th>
                    <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-ink-mute text-right">暗盘</th>
                    <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-ink-mute text-right">首日</th>
                    <th className="px-2 py-2 text-[10px] uppercase tracking-widest text-ink-mute text-right">单手盈利</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((h) => {
                    const winRate = h.applicants && h.winners ? (h.winners / h.applicants) * 100 : null
                    const profitPositive = (h.profitPerLot ?? 0) > 0
                    return (
                      <tr key={h.code} className="border-b border-rule hover:bg-paper-2/40">
                        <td className="px-3 py-2">
                          <div className="font-serif text-sm">{h.name}</div>
                          <div className="font-mono text-[10px] text-ink-mute">{h.code}</div>
                        </td>
                        <td className="px-2 py-2"><Tag variant="mute">{h.mechanism === 'B' ? '机制B' : h.mechanism}</Tag></td>
                        <td className="px-2 py-2 font-mono text-[11px]">{h.listingDate}</td>
                        <td className="px-2 py-2 text-right font-mono">{h.issueLots?.toLocaleString() ?? '—'}</td>
                        <td className="px-2 py-2 text-right font-mono">{h.subscriptionMultiple?.toFixed(0) ?? '—'}×</td>
                        <td className="px-2 py-2 text-right font-mono">{h.winners?.toLocaleString() ?? '—'}</td>
                        <td className="px-2 py-2 text-right font-mono">{winRate !== null ? `${winRate.toFixed(1)}%` : '—'}</td>
                        <td className={`px-2 py-2 text-right font-mono ${(h.darkChangePct ?? 0) >= 0 ? 'text-accent' : 'text-accent-2'}`}>{h.darkChangePct !== undefined ? Pct(h.darkChangePct) : '—'}</td>
                        <td className={`px-2 py-2 text-right font-mono ${(h.firstDayChangePct ?? 0) >= 0 ? 'text-accent' : 'text-accent-2'}`}>{h.firstDayChangePct !== undefined ? Pct(h.firstDayChangePct) : '—'}</td>
                        <td className={`px-2 py-2 text-right font-mono font-bold ${profitPositive ? 'text-accent' : 'text-accent-2'}`}>{h.profitPerLot !== undefined ? HKD(h.profitPerLot, false) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
