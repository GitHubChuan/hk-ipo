import { useScopedData } from '@/lib/store'
import { SectionTitle, StatBlock, Tag, HKD, Pct, EmptyState, InfoTip } from '@/components/shared/Editorial'

export default function ReviewTab() {
  const { settlements, ipos, partners } = useScopedData()

  const totalProfit = settlements.reduce((a, b) => a + b.totalProfit, 0)
  const wins = settlements.filter((s) => s.totalProfit > 0)
  const losses = settlements.filter((s) => s.totalProfit < 0)
  const winRate = settlements.length ? (wins.length / settlements.length) * 100 : 0
  const avgWin = wins.length ? wins.reduce((a, b) => a + b.totalProfit, 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b.totalProfit, 0) / losses.length : 0

  // 每位合伙人累计收入
  const perPartner = partners.map((p) => {
    const total = settlements.reduce((acc, s) => {
      const d = s.distributions.find((x) => x.partnerId === p.id)
      return acc + (d?.amount ?? 0)
    }, 0)
    return { partner: p, total }
  })

  // 按月汇总
  const byMonth: Record<string, number> = {}
  settlements.forEach((s) => {
    const d = new Date(s.settledAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    byMonth[key] = (byMonth[key] ?? 0) + s.totalProfit
  })
  const months = Object.entries(byMonth).sort()
  const maxAbs = Math.max(1, ...months.map(([, v]) => Math.abs(v)))

  return (
    <div className="space-y-12">
      <SectionTitle index="VIII" en="Postmortem & Review" zh="历史复盘" desc="账本总有翻看的一天：每一笔结算、胜率、最大盈利与最痛的亏损都在此被审视。" />

      {/* KPI */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <StatBlock label="累计净利润" value={HKD(totalProfit, false)} unit="HKD" highlight={totalProfit >= 0 ? 'up' : 'down'} />
        <StatBlock label="结清交易数" value={settlements.length} />
        <StatBlock label="胜率" value={`${winRate.toFixed(0)}%`} hint={`${wins.length} 胜 / ${losses.length} 负`} highlight="accent" />
        <StatBlock label="平均盈亏比" value={avgLoss !== 0 ? (avgWin / Math.abs(avgLoss)).toFixed(2) : '∞'} hint={`均胜 ${HKD(avgWin)} · 均负 ${HKD(avgLoss)}`} />
      </section>

      {/* 月度条形图 */}
      <section>
        <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
          <h3 className="font-serif text-2xl">月度盈亏走势</h3>
          <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">MONTHLY P&L</span>
        </div>
        {months.length === 0 ? (
          <EmptyState title="尚未有结算记录" />
        ) : (
          <div className="border border-rule bg-paper-2/40 p-6">
            <div className="flex items-end gap-3 h-48">
              {months.map(([k, v]) => {
                const h = (Math.abs(v) / maxAbs) * 90
                return (
                  <div key={k} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <div className={`num text-[11px] ${v >= 0 ? 'text-accent' : 'text-accent-2'}`}>
                      {v >= 0 ? '+' : ''}{HKD(v, false)}
                    </div>
                    <div className="w-full" style={{ height: `${h}%`, background: v >= 0 ? 'var(--accent)' : 'var(--accent-2)' }} />
                    <div className="text-[10px] text-ink-mute font-mono">{k}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* 合伙人收入榜 */}
      <section>
        <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
          <h3 className="font-serif text-2xl">合伙人累计分润</h3>
          <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">PARTNERS' TOTAL</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {perPartner.sort((a, b) => b.total - a.total).map(({ partner, total }, idx) => (
            <div key={partner.id} className="border border-rule p-5 flex items-center justify-between bg-paper">
              <div className="flex items-center gap-4">
                <span className="font-serif text-3xl text-ink-mute">{String(idx + 1).padStart(2, '0')}</span>
                <span className="w-3 h-3 rounded-full" style={{ background: partner.color }} />
                <div>
                  <div className="font-serif text-lg">{partner.name}</div>
                  <div className="text-[11px] text-ink-mute">本金 {HKD(partner.capital)} · 占比 {(partner.shareRatio * 100).toFixed(0)}%</div>
                </div>
              </div>
              <div className={`num display text-3xl ${total >= 0 ? 'text-accent' : 'text-accent-2'}`}>{HKD(total, false)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 历史结算 */}
      <section>
        <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
          <h3 className="font-serif text-2xl">历史结算逐笔</h3>
          <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">SETTLEMENT TIMELINE</span>
        </div>
        {settlements.length === 0 ? (
          <EmptyState title="暂无结算" />
        ) : (
          <ol className="border-l-2 border-ink ml-3 space-y-6 pl-6">
            {settlements.slice().reverse().map((s) => {
              const ipo = ipos.find((i) => i.id === s.ipoId)
              return (
                <li key={s.id} className="relative">
                  <div className={`absolute -left-[34px] top-1.5 w-3 h-3 rounded-full ${s.totalProfit >= 0 ? 'bg-accent' : 'bg-accent-2'}`} />
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <Tag variant={s.totalProfit >= 0 ? 'accent' : 'warn'}>{s.totalProfit >= 0 ? '盈利' : '亏损'}</Tag>
                      <span className="font-serif text-xl ml-2">{ipo?.name ?? '已删除标的'}</span>
                    </div>
                    <span className={`num display text-2xl ${s.totalProfit >= 0 ? 'text-accent' : 'text-accent-2'}`}>{HKD(s.totalProfit, false)}</span>
                  </div>
                  <div className="text-[11px] text-ink-mute font-mono mb-2">{new Date(s.settledAt).toLocaleString('zh-CN')}</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {s.distributions.map((d) => {
                      const p = partners.find((x) => x.id === d.partnerId)
                      return (
                        <span key={d.partnerId} className="border border-rule px-2 py-0.5 bg-paper-2/40">
                          {p?.name ?? '?'} · <span className={`num ${d.amount >= 0 ? 'text-accent' : 'text-accent-2'}`}>{HKD(d.amount)}</span>
                        </span>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
