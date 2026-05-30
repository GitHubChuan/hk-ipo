import { useState } from 'react'
import { useStore, useScopedData } from '@/lib/store'
import { calcSettlement, exitStrategyAdvice } from '@/lib/engine'
import { SectionTitle, Tag, HKD, PrimaryButton, GhostButton, Field, TextInput, EmptyState, InfoTip } from '@/components/shared/Editorial'

export default function SettlementTab() {
  const { ipos, partners, subscriptions, settlements } = useScopedData()
  const { addSettlement, updateIpo } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)

  // 可结算 = 上市/已申购但未结清
  const canSettle = ipos.filter((i) => ['listed', 'subscribed'].includes(i.status))

  return (
    <div className="space-y-12">
      <SectionTitle index="VI" en="Exit & Settlement" zh="卖出策略与分润结算" desc='基于「暗盘 / 开盘 / 首日」涨幅给出离场建议；确认实际卖出后一键计算各合伙人净分润。' />

      {/* 卖出策略提示 */}
      <section>
        <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
          <h3 className="font-serif text-2xl">离场策略台</h3>
          <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">EXIT ADVISORY</span>
        </div>
        {canSettle.length === 0 ? (
          <EmptyState title="暂无可结算标的" hint="标的状态为「已申购 / 已上市」时会出现在此处。" />
        ) : (
          <div className="space-y-3">
            {canSettle.map((ipo) => {
              const advice = exitStrategyAdvice(ipo)
              const subs = subscriptions.filter((s) => s.ipoId === ipo.id)
              const totalLots = subs.reduce((a, b) => a + (b.lotsAllocated ?? 0), 0)
              const ratios: Record<string, number> = {}
              partners.forEach((p) => (ratios[p.id] = p.shareRatio || 0))
              const settle = calcSettlement(ipo, subs, ratios, useStore.getState().config.mainPartnerId)

              return (
                <article key={ipo.id} className="border border-ink bg-paper">
                  {/* 顶层 */}
                  <div className="grid grid-cols-12 gap-4 items-center p-5">
                    <div className="col-span-3">
                      <div className="font-serif text-2xl">{ipo.name}</div>
                      <div className="text-xs font-mono text-ink-mute">{ipo.code}</div>
                    </div>
                    <div className="col-span-3">
                      <Tag variant={
                        advice.action === 'sell_dark' || advice.action === 'sell_partial' ? 'accent' :
                        advice.action === 'stop_loss' ? 'warn' :
                        advice.action === 'hold' ? 'mute' : 'success'
                      }>
                        {advice.action === 'hold' ? '观望' :
                         advice.action === 'sell_dark' ? '暗盘出货' :
                         advice.action === 'sell_partial' ? '部分锁利' :
                         advice.action === 'stop_loss' ? '止损' : '开盘卖出'}
                      </Tag>
                      <p className="text-[12px] text-ink-soft mt-1">{advice.message}</p>
                    </div>
                    <div className="col-span-2 text-center">
                      <div className="text-[10px] uppercase text-ink-mute tracking-widest">中签合计</div>
                      <div className="num text-base">{totalLots} 手</div>
                    </div>
                    <div className="col-span-2 text-center">
                      <div className="text-[10px] uppercase text-ink-mute tracking-widest">
                        <InfoTip
                          title="预计净利润"
                          formula="总收入 - 总成本 - (融资息 - 主理人兑底部分)"
                          steps={[
                            { label: '总收入', value: HKD(settle.totalRevenue) },
                            { label: '总成本', value: HKD(settle.totalCost) },
                            { label: '融资息', value: HKD(settle.marginCost) },
                            { label: '主理人兑底', value: HKD(settle.mainCoverage) },
                            { label: '= 净利', value: HKD(settle.netProfit) },
                          ]}
                        >预计净利</InfoTip>
                      </div>
                      <div className={`num text-lg ${settle.netProfit >= 0 ? 'text-accent' : 'text-accent-2'}`}>{HKD(settle.netProfit, false)}</div>
                    </div>
                    <div className="col-span-2 text-right">
                      <button onClick={() => setOpenId(openId === ipo.id ? null : ipo.id)} className="text-xs uppercase tracking-widest underline underline-offset-4">
                        {openId === ipo.id ? '收起' : '展开 / 结算'}
                      </button>
                    </div>
                  </div>

                  {openId === ipo.id && (
                    <div className="border-t border-rule p-6 bg-paper-2/40 grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* 左：录入实际卖出价 */}
                      <div>
                        <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute mb-3">UPDATE PRICES · 实际成交价</div>
                        <div className="grid grid-cols-2 gap-4">
                          <Field label="上市/暗盘开盘价 (HKD)">
                            <TextInput type="number" step={0.01} value={ipo.listingOpenPrice ?? ''} onChange={(e) => updateIpo(ipo.id, { listingOpenPrice: e.target.value ? +e.target.value : undefined })} />
                          </Field>
                          <Field label="实际平均卖出价 (HKD)">
                            <TextInput type="number" step={0.01} value={ipo.exitPrice ?? ''} onChange={(e) => updateIpo(ipo.id, { exitPrice: e.target.value ? +e.target.value : undefined })} />
                          </Field>
                          <Field label="实际超购倍数">
                            <TextInput type="number" value={ipo.actualOversubMultiple ?? ''} onChange={(e) => updateIpo(ipo.id, { actualOversubMultiple: e.target.value ? +e.target.value : undefined })} />
                          </Field>
                          <Field label="卖出日期">
                            <TextInput type="date" value={ipo.exitDate ?? ''} onChange={(e) => updateIpo(ipo.id, { exitDate: e.target.value })} />
                          </Field>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                          <div className="border border-rule p-3">
                            <div className="text-[10px] uppercase tracking-widest text-ink-mute">总收入</div>
                            <div className="num">{HKD(settle.totalRevenue)}</div>
                          </div>
                          <div className="border border-rule p-3">
                            <div className="text-[10px] uppercase tracking-widest text-ink-mute">总成本</div>
                            <div className="num">{HKD(settle.totalCost)}</div>
                          </div>
                          <div className="border border-rule p-3">
                            <div className="text-[10px] uppercase tracking-widest text-ink-mute">融资费用</div>
                            <div className="num">{HKD(settle.marginCost)}</div>
                          </div>
                          <div className="border border-rule p-3">
                            <div className="text-[10px] uppercase tracking-widest text-ink-mute">主理人兜底</div>
                            <div className="num text-accent">{HKD(settle.mainCoverage)}</div>
                          </div>
                        </div>
                      </div>

                      {/* 右：分润详情 */}
                      <div>
                        <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute mb-3">DISTRIBUTION · 分润明细</div>
                        <div className="space-y-2">
                          {settle.distributions.map((d) => {
                            const p = partners.find((x) => x.id === d.partnerId)!
                            return (
                              <div key={d.partnerId} className="flex items-center justify-between border-b border-rule py-2.5">
                                <div className="flex items-center gap-3">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                                  <span className="font-serif text-lg">{p.name}</span>
                                  <span className="text-[10px] tracking-widest uppercase text-ink-mute">{(d.ratio * 100).toFixed(0)}%</span>
                                </div>
                                <span className={`num text-lg ${d.amount >= 0 ? 'text-accent' : 'text-accent-2'}`}>
                                  {HKD(d.amount, false)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                        <div className="mt-5 border-t-2 border-ink pt-4">
                          <PrimaryButton
                            onClick={() => {
                              if (settlements.find((x) => x.ipoId === ipo.id)) {
                                if (!confirm('该标的已结清过一次，再次结算将新增记录。继续？')) return
                              }
                              addSettlement({
                                ipoId: ipo.id,
                                totalProfit: settle.netProfit,
                                mainPartnerCoverage: settle.mainCoverage,
                                distributions: settle.distributions,
                              })
                              updateIpo(ipo.id, { status: 'closed' })
                              setOpenId(null)
                              alert('结算入账完成 ✓')
                            }}
                          >
                            确认结算入账
                          </PrimaryButton>
                          <GhostButton className="ml-3" onClick={() => setOpenId(null)}>取消</GhostButton>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
