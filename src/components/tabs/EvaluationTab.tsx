import { useState } from 'react'
import { useStore, useScopedData, useIsAdmin } from '@/lib/store'
import { calcEntryFee, profitExpectationScore, oneLotHitRate } from '@/lib/engine'
import type { Ipo } from '@/lib/types'
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
}

export default function EvaluationTab() {
  const isAdmin = useIsAdmin()
  const { ipos } = useScopedData()
  const { addIpo, updateIpo, removeIpo } = useStore()
  const [draft, setDraft] = useState<typeof emptyDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)

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
    })
  }

  const reset = () => {
    setDraft(emptyDraft)
    setEditingId(null)
  }

  const submit = () => {
    if (!draft.code || !draft.name) return alert('请填写股票代码与名称')
    const fee = calcEntryFee(draft.priceHigh, draft.lotSize)
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
              <Field label="招股价下限 (HKD)">
                <TextInput type="number" step={0.01} value={draft.priceLow} onChange={(e) => setDraft({ ...draft, priceLow: +e.target.value })} />
              </Field>
              <Field label={<InfoTip title="招股价上限" formula="一手金额 = 上限 × 每手股数 × 1.0077"  steps={[`公式中 1.0077 = 1% 经纪佣金 + 0.27% 港交所 / 中央结算 / 印花税`]}>招股价上限 (HKD)</InfoTip>}>
                <TextInput type="number" step={0.01} value={draft.priceHigh} onChange={(e) => setDraft({ ...draft, priceHigh: +e.target.value })} />
              </Field>
              <Field label="每手股数">
                <TextInput type="number" value={draft.lotSize} onChange={(e) => setDraft({ ...draft, lotSize: +e.target.value })} />
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
            <h4 className="font-serif text-3xl mb-6">{draft.name || '尚未录入'}</h4>

            <div className="grid grid-cols-2 gap-5 mb-6">
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

      <section>
        <div className="flex items-center justify-between border-b border-ink pb-3 mb-6">
          <h3 className="font-serif text-2xl">{isAdmin ? `已收录标的 · ${ipos.length}` : `可见标的 · ${ipos.length}`}</h3>
          <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">THE WATCHLIST</span>
        </div>

        {ipos.length === 0 ? (
          <EmptyState title="暂无标的" hint={isAdmin ? '录入第一支新股，让账本开始运转。' : '主理人尚未给你分配标的。'} />
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
    </div>
  )
}
