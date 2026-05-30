import { useStore, useScopedData, useIsAdmin } from '@/lib/store'
import { calcEntryFee, profitExpectationScore } from '@/lib/engine'
import { SectionTitle, StatBlock, Tag, HKD, Pct, PrimaryButton, InfoTip } from '@/components/shared/Editorial'

export default function OverviewTab({ onJumpTab }: { onJumpTab: (id: string) => void }) {
  const isAdmin = useIsAdmin()
  const { ipos, partners, settlements } = useScopedData()
  const config = useStore((s) => s.config)

  const activeIpos = ipos.filter((i) => ['watching', 'evaluating', 'decided_go', 'subscribed'].includes(i.status))
  const totalSettled = settlements.reduce((acc, s) => acc + s.totalProfit, 0)
  const wins = settlements.filter((s) => s.totalProfit > 0).length
  const winRate = settlements.length ? (wins / settlements.length) * 100 : 0

  const ranked = activeIpos
    .map((i) => ({ ipo: i, score: profitExpectationScore(i) }))
    .sort((a, b) => b.score.expectedProfit - a.score.expectedProfit)
    .slice(0, 3)

  const today = new Date()
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][today.getDay()]

  return (
    <div className="space-y-12">
      <section className="border-y-2 border-ink py-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
          <div className="md:col-span-7">
            <Tag variant="accent">FRONT PAGE · 头版</Tag>
            <h2 className="font-serif display text-5xl md:text-6xl mt-4 leading-tight">
              {ranked[0] ? (
                <>
                  本周聚焦 · <span className="text-accent">{ranked[0].ipo.name}</span>
                </>
              ) : (
                <>暂无在评新股 · 等待下一支重磅 IPO</>
              )}
            </h2>
            <p className="text-sm text-ink-soft mt-4 italic leading-relaxed">
              {ranked[0]?.score.rationale ?? (isAdmin ? '请到 §III 标的评估录入新股，让账本开始运转。' : '主理人尚未为你分配标的。')}
            </p>
          </div>
          <div className="md:col-span-5">
            <div className="border-l-2 border-ink pl-6 space-y-1 text-sm">
              <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">EDITION DATE</div>
              <div className="font-serif text-2xl">{today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
              <div className="text-ink-soft">星期{weekday}</div>
              <div className="rule mt-3 mb-3"></div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">CIRCULATION</div>
              <div className="font-serif text-xl">{partners.length} 位合伙人 · {isAdmin ? '在席' : '可见'}</div>
              <div className="text-ink-soft text-xs">总资金池 {HKD(config.teamCapital)}</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle index="I" en="The Numbers" zh="资产数字" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <StatBlock
            label="累计净利润"
            value={HKD(totalSettled, false)}
            unit="HKD"
            highlight={totalSettled >= 0 ? 'up' : 'down'}
            tip={{
              title: '累计净利润',
              formula: 'Σ (各次结算的 totalProfit)',
              steps: [
                { label: '已结算次数', value: settlements.length },
                { label: '总盈利', value: HKD(settlements.filter(s => s.totalProfit>0).reduce((a,b)=>a+b.totalProfit,0)) },
                { label: '总亏损', value: HKD(settlements.filter(s => s.totalProfit<0).reduce((a,b)=>a+b.totalProfit,0)) },
              ],
            }}
          />
          <StatBlock
            label="结清交易数"
            value={settlements.length}
            hint={`胜率 ${Pct(winRate)}`}
            tip={{ title: '胜率', formula: '盈利结算次数 / 总结算次数', steps: [{ label: '胜', value: wins }, { label: '负', value: settlements.length - wins }] }}
          />
          <StatBlock label="在评/在仓" value={activeIpos.length} hint="只 New Listings" />
          <StatBlock label="合伙人" value={partners.length} hint={`兜底 · ${partners.find(p => p.id === config.mainPartnerId)?.name ?? '—'}`} />
        </div>
      </section>

      <section>
        <SectionTitle
          index="II"
          en="Top Picks This Window"
          zh="本期重点推荐"
          desc='按「赚钱期望 = 一手中签率 × 一手金额 × 预期涨幅」自动排序，期望最高者优先吃满预算。'
        />
        {ranked.length === 0 ? (
          <div className="border border-rule p-10 text-center text-ink-soft">
            暂无候选标的。
            {isAdmin && <PrimaryButton onClick={() => onJumpTab('eval')} className="ml-4">前往录入 →</PrimaryButton>}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {ranked.map(({ ipo, score }, idx) => {
              const fee = ipo.entryFee || calcEntryFee(ipo.priceHigh, ipo.lotSize)
              return (
                <article
                  key={ipo.id}
                  className={`border border-ink p-6 lift bg-paper-2/30 ${
                    idx === 0 ? 'ring-2 ring-accent ring-offset-2 ring-offset-paper' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <Tag
                      variant={
                        score.recommendation === 'strong_buy' ? 'accent' :
                        score.recommendation === 'buy' ? 'success' :
                        score.recommendation === 'skip' ? 'mute' : 'default'
                      }
                    >
                      {score.recommendation === 'strong_buy' ? '强烈申购' :
                        score.recommendation === 'buy' ? '推荐参与' :
                        score.recommendation === 'skip' ? '建议放弃' : '中性观望'}
                    </Tag>
                    <span className="font-serif text-3xl text-ink-mute">{['壹', '贰', '叁'][idx]}</span>
                  </div>
                  <h3 className="font-serif text-2xl">{ipo.name}</h3>
                  <div className="text-xs text-ink-mute font-mono">{ipo.code}</div>
                  <div className="rule my-4"></div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-ink-soft">招股价上限</span><span className="num">HK$ {ipo.priceHigh.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-ink-soft">超购倍数</span><span className="num">{ipo.oversubMultiple ?? '—'} ×</span></div>
                    <div className="flex justify-between">
                      <span className="text-ink-soft">
                        <InfoTip
                          title="一手中签率（红鞋机制）"
                          formula="min(1, max(1/超购 × 红鞋系数, 概率下限))"
                          steps={[
                            { label: '超购倍数', value: `${ipo.oversubMultiple ?? '—'}×` },
                            { label: '红鞋系数', value: `${ipo.redShoeBoost ?? 1.4}` },
                            '红鞋下限：超购<50→50% / 50–200→30% / >200→15%',
                            { label: '一手中签率', value: `${(score.hitRate * 100).toFixed(1)}%` },
                          ]}
                        >
                          一手中签率
                        </InfoTip>
                      </span>
                      <span className="num">{(score.hitRate * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between"><span className="text-ink-soft">预期涨幅</span><span className="num text-accent">{Pct(ipo.expectedRise)}</span></div>
                  </div>
                  <div className="border-t border-ink mt-4 pt-3">
                    <div className="text-[10px] tracking-[0.2em] uppercase text-ink-mute mb-1">
                      <InfoTip
                        title="单手期望利润"
                        formula="一手中签率 × 一手金额(HKD) × 预期涨幅%"
                        steps={[
                          { label: '一手金额', value: HKD(fee) },
                          { label: '一手中签率', value: `${(score.hitRate * 100).toFixed(1)}%` },
                          { label: '预期涨幅', value: Pct(ipo.expectedRise) },
                          { label: '= 期望利润', value: HKD(score.expectedProfit) },
                        ]}
                      >
                        单手期望利润
                      </InfoTip>
                    </div>
                    <div className="num display text-3xl text-accent">{HKD(score.expectedProfit, false)}</div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle index="III" en="Quick Bench" zh="快捷入口" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { id: 'calendar', en: 'Calendar', zh: '新股日历', desc: '抓取行事历与行情' },
            { id: 'eval', en: 'Evaluation', zh: '评估新股', desc: '录入并自动算分' },
            { id: 'alloc', en: 'Allocation', zh: '资金分配', desc: '按期望分预算' },
            { id: 'settle', en: 'Settlement', zh: '卖出分润', desc: '一键结清账本' },
          ].map((q) => (
            <button
              key={q.id}
              onClick={() => onJumpTab(q.id)}
              className="border border bg-paper border-ink p-5 text-left lift hover:bg-ink hover:text-paper group transition-colors"
            >
              <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute group-hover:text-paper/60">{q.en}</div>
              <div className="font-serif text-2xl mt-1">{q.zh}</div>
              <div className="text-xs text-ink-soft group-hover:text-paper/70 mt-1">{q.desc} →</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
