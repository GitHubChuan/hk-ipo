import { useMemo, useState } from 'react'
import { useStore, useScopedData, useIsAdmin } from '@/lib/store'
import { allocateBudget, profitExpectationScore } from '@/lib/engine'
import {
  SectionTitle,
  StatBlock,
  Tag,
  HKD,
  Field,
  TextInput,
  EmptyState,
  InfoTip,
} from '@/components/shared/Editorial'

export default function AllocationTab() {
  const isAdmin = useIsAdmin()
  const { ipos, partners } = useScopedData()
  const config = useStore((s) => s.config)
  const updateConfig = useStore((s) => s.updateConfig)
  const [budget, setBudget] = useState(config.teamCapital || 1500000)

  const candidateIpos = ipos.filter((i) => ['evaluating', 'decided_go', 'subscribed', 'watching'].includes(i.status))

  const allocations = useMemo(
    () => allocateBudget(candidateIpos, budget, partners.length || 1),
    [candidateIpos, budget, partners.length],
  )

  const totalCost = allocations.reduce((a, b) => a + b.totalCost, 0)
  const totalExpected = allocations.reduce((a, b) => a + b.expectedProfit, 0)

  return (
    <div className="space-y-12">
      <SectionTitle
        index="V"
        en="Capital Allocation"
        zh="额度分配"
        desc='并发期间的核心：把有限的预算先丢给"赚钱期望最高"的那一支，剩下按红鞋摸 1 手分散搭配。'
      />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="border border-ink p-5 bg-paper-2/40 md:col-span-2">
          <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute mb-2">CAPITAL POOL · 资金池配置</div>
          <div className="grid grid-cols-2 gap-5">
            <Field label="本期可用预算 (HKD)" hint="所有合伙人的可投资金合计">
              <TextInput
                type="number"
                value={budget}
                disabled={!isAdmin}
                onChange={(e) => {
                  const v = +e.target.value
                  setBudget(v)
                  if (isAdmin) updateConfig({ teamCapital: v })
                }}
              />
            </Field>
            <Field label="参与账户数（合伙人）" hint="每个合伙人通常 1 个主账户">
              <TextInput type="number" value={partners.length} disabled />
            </Field>
          </div>
        </div>

        <StatBlock label="待分配候选" value={candidateIpos.length} unit="只" highlight="mute" />
      </section>

      <section>
        <div className="flex items-baseline justify-between border-b border-ink pb-3 mb-6">
          <h3 className="font-serif text-2xl">智能分配建议</h3>
          <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">THE BUDGET LEDGER</div>
        </div>

        {allocations.length === 0 ? (
          <EmptyState title="无可分配标的" hint="先到 §III 录入新股并标记为参与。" />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              <StatBlock
                label="预算总占用"
                value={HKD(totalCost, false)}
                unit="HKD"
                highlight="accent"
                tip={{
                  title: '预算总占用',
                  formula: 'Σ (一手金额 × 每账户手数 × 账户数)',
                  steps: allocations.map((a) => {
                    const ipo = ipos.find((i) => i.id === a.ipoId)
                    return { label: ipo?.name ?? '', value: HKD(a.totalCost) }
                  }),
                }}
              />
              <StatBlock
                label="期望总利润"
                value={HKD(totalExpected, false)}
                unit="HKD"
                highlight="up"
                hint="含全员账户合计期望"
                tip={{
                  title: '期望总利润',
                  formula: 'Σ (单手期望利润 × 每账户手数 × 账户数)',
                }}
              />
              <StatBlock
                label="预算使用率"
                value={`${budget > 0 ? ((totalCost / budget) * 100).toFixed(1) : 0}%`}
                highlight="mute"
                tip={{ title: '预算使用率', formula: '总占用 / 总预算' }}
              />
            </div>

            <ol className="space-y-3">
              {allocations.map((a, idx) => {
                const ipo = ipos.find((i) => i.id === a.ipoId)!
                const score = profitExpectationScore(ipo)
                return (
                  <li key={a.ipoId} className="border border-ink p-5 bg-paper grid grid-cols-12 gap-4 items-center lift">
                    <div className="col-span-1 font-serif text-5xl text-accent text-center">
                      {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="col-span-4">
                      <Tag variant={score.recommendation === 'strong_buy' ? 'accent' : score.recommendation === 'buy' ? 'success' : 'default'}>
                        {score.recommendation === 'strong_buy' ? '优先吃满' : score.recommendation === 'buy' ? '红鞋摸手' : '少量参与'}
                      </Tag>
                      <div className="font-serif text-2xl mt-1">{ipo.name}</div>
                      <div className="text-xs font-mono text-ink-mute">{ipo.code} · 超购 {ipo.oversubMultiple ?? '—'}×</div>
                    </div>
                    <div className="col-span-2 text-center border-l border-rule pl-4">
                      <div className="text-[10px] uppercase text-ink-mute tracking-widest">
                        <InfoTip
                          title="每账户建议手数"
                          formula="strong_buy: 用满预算 / 其他: 1 手红鞋"
                          steps={[
                            { label: '推荐档位', value: score.recommendation },
                            { label: '一手金额', value: HKD(ipo.entryFee) },
                            { label: '账户数', value: partners.length },
                            '强烈推荐者预算允许下扩容；一手党继续保持 1 手以最大化红鞋优势',
                          ]}
                        >
                          每账户
                        </InfoTip>
                      </div>
                      <div className="num display text-3xl">{a.recommendedLots}<span className="text-sm ml-1 text-ink-soft font-sans">手</span></div>
                    </div>
                    <div className="col-span-2 text-center border-l border-rule pl-4">
                      <div className="text-[10px] uppercase text-ink-mute tracking-widest">占用资金</div>
                      <div className="num text-base">{HKD(a.totalCost)}</div>
                      <div className="text-[11px] text-ink-mute">全员合计</div>
                    </div>
                    <div className="col-span-3 text-right border-l border-rule pl-4">
                      <div className="text-[10px] uppercase text-ink-mute tracking-widest">
                        <InfoTip
                          title="本只期望利润"
                          formula="单手期望 × 每账户手数 × 账户数"
                          steps={[
                            { label: '单手期望', value: HKD(score.expectedProfit) },
                            { label: '每账户手数', value: a.recommendedLots },
                            { label: '账户数', value: partners.length },
                            { label: '= 总期望', value: HKD(a.expectedProfit) },
                          ]}
                        >
                          期望利润
                        </InfoTip>
                      </div>
                      <div className="num display text-3xl text-accent">{HKD(a.expectedProfit, false)}</div>
                      <div className="text-[11px] text-ink-soft">{a.rationale}</div>
                    </div>
                  </li>
                )
              })}
            </ol>

            <div className="mt-8 border-l-4 border-accent pl-4 py-2 bg-paper-2/40">
              <p className="text-sm text-ink-soft italic">
                <span className="font-serif text-base text-ink not-italic mr-2">编辑按语：</span>
                红鞋机制下,资金量越小（特别是仅申购 1 手）,实际配售比例越容易跑赢"1/超购倍数"的数学期望。
                因此对于超购倍数极高、单手期望仍为正的标的,优选"全员各摸 1 手"而非集中砸量。
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
