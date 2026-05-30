import { useState } from 'react'
import { useStore, useScopedData } from '@/lib/store'
import type { Subscription } from '@/lib/types'
import { SectionTitle, Tag, HKD, PrimaryButton, GhostButton, Field, TextInput, Select, EmptyState, InfoTip } from '@/components/shared/Editorial'

const newDraft = (ipoId: string, partnerId: string): Omit<Subscription, 'id' | 'createdAt'> => ({
  ipoId,
  partnerId,
  account: '富途',
  mode: 'cash',
  lotsApplied: 1,
  marginMultiplier: 1,
  marginRate: 6.8,
  marginDays: 6,
  marginCost: 0,
  lotsAllocated: undefined,
  feeCoveredByMain: true,
})

export default function HoldingsTab() {
  const { ipos, partners, subscriptions } = useScopedData()
  const { addSubscription, updateSubscription, removeSubscription } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<Omit<Subscription, 'id' | 'createdAt'> | null>(null)

  const startNew = () => {
    if (ipos.length === 0 || partners.length === 0) {
      alert('请先录入标的并添加合伙人')
      return
    }
    setDraft(newDraft(ipos[0].id, partners[0].id))
    setShowForm(true)
  }

  const submit = () => {
    if (!draft) return
    // 自动算融资息
    const ipo = ipos.find((i) => i.id === draft.ipoId)
    if (ipo && draft.mode === 'margin') {
      const principal = ipo.entryFee * draft.lotsApplied * (draft.marginMultiplier ?? 1) * (1 - 1 / (draft.marginMultiplier ?? 1))
      const cost = principal * ((draft.marginRate ?? 0) / 100) * ((draft.marginDays ?? 0) / 365)
      draft.marginCost = Math.round(cost)
    } else {
      draft.marginCost = 0
    }
    addSubscription(draft)
    setShowForm(false)
    setDraft(null)
  }

  return (
    <div className="space-y-12">
      <SectionTitle index="IV" en="Holdings & Subscriptions" zh="持仓申购" desc="记录每位合伙人在每只新股上的实际申购、中签与融资成本，主理人兜底的部分会自动入账。" />

      {/* 头部统计 */}
      <section className="flex items-center justify-between border-b border-ink pb-5">
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">SUBSCRIPTIONS · 申购单</div>
          <div className="font-serif text-3xl">共 {subscriptions.length} 笔</div>
        </div>
        <PrimaryButton onClick={startNew}>+ 录入新申购</PrimaryButton>
      </section>

      {/* 录入表 */}
      {showForm && draft && (
        <section className="border-2 border-accent p-6 bg-paper-2/40">
          <h3 className="font-serif text-2xl mb-5">录入申购明细</h3>
          <div className="grid grid-cols-3 gap-5">
            <Field label="新股标的">
              <Select
                value={draft.ipoId}
                onChange={(e) => setDraft({ ...draft, ipoId: e.target.value })}
                options={ipos.map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))}
              />
            </Field>
            <Field label="合伙人">
              <Select
                value={draft.partnerId}
                onChange={(e) => setDraft({ ...draft, partnerId: e.target.value })}
                options={partners.map((p) => ({ value: p.id, label: p.name }))}
              />
            </Field>
            <Field label="券商账户">
              <TextInput value={draft.account} onChange={(e) => setDraft({ ...draft, account: e.target.value })} placeholder="富途/盈立/华盛/老虎…" />
            </Field>
            <Field label="申购方式">
              <Select
                value={draft.mode}
                onChange={(e) => setDraft({ ...draft, mode: e.target.value as 'cash' | 'margin' })}
                options={[
                  { value: 'cash', label: '现金 (Cash)' },
                  { value: 'margin', label: '融资 (Margin)' },
                ]}
              />
            </Field>
            <Field label="申购手数">
              <TextInput type="number" value={draft.lotsApplied} onChange={(e) => setDraft({ ...draft, lotsApplied: +e.target.value })} />
            </Field>
            {draft.mode === 'margin' && (
              <>
                <Field label={<InfoTip title="融资倍数" formula="实际申购金额 = 入场费 × 倍数；本金 = 申购 / 倍数；息 = (申购 - 本金) × 利率 × 天数/365" steps={["10倍融资 = 用 10% 本金博 100% 申购额", "杠杆越高利息越大，需中签率覆盖"]}>融资倍数</InfoTip>}>
                  <TextInput type="number" value={draft.marginMultiplier ?? 1} onChange={(e) => setDraft({ ...draft, marginMultiplier: +e.target.value })} />
                </Field>
                <Field label="融资利率 (年化%)">
                  <TextInput type="number" step={0.1} value={draft.marginRate ?? 0} onChange={(e) => setDraft({ ...draft, marginRate: +e.target.value })} />
                </Field>
                <Field label="计息天数">
                  <TextInput type="number" value={draft.marginDays ?? 0} onChange={(e) => setDraft({ ...draft, marginDays: +e.target.value })} />
                </Field>
              </>
            )}
            <Field label="主理人兜底融资费？">
              <Select
                value={draft.feeCoveredByMain ? 'yes' : 'no'}
                onChange={(e) => setDraft({ ...draft, feeCoveredByMain: e.target.value === 'yes' })}
                options={[
                  { value: 'yes', label: '是 (默认)' },
                  { value: 'no', label: '否' },
                ]}
              />
            </Field>
          </div>
          <div className="flex gap-3 mt-7">
            <PrimaryButton onClick={submit}>录入账本</PrimaryButton>
            <GhostButton onClick={() => { setShowForm(false); setDraft(null) }}>取消</GhostButton>
          </div>
        </section>
      )}

      {/* 列表 */}
      <section>
        {subscriptions.length === 0 ? (
          <EmptyState title="尚无申购记录" hint="点击右上「+ 录入新申购」开始记录。" />
        ) : (
          <div className="space-y-3">
            {subscriptions.map((s) => {
              const ipo = ipos.find((i) => i.id === s.ipoId)
              const partner = partners.find((p) => p.id === s.partnerId)
              return (
                <article key={s.id} className="grid grid-cols-12 gap-4 items-center border border-rule p-4 bg-paper">
                  <div className="col-span-3">
                    <div className="font-serif text-lg">{ipo?.name ?? '—'}</div>
                    <div className="text-xs font-mono text-ink-mute">{ipo?.code}</div>
                  </div>
                  <div className="col-span-2">
                    <Tag variant="default">{partner?.name ?? '—'}</Tag>
                    <div className="text-[11px] text-ink-mute mt-1">{s.account}</div>
                  </div>
                  <div className="col-span-2 text-center">
                    <div className="text-[10px] uppercase text-ink-mute tracking-widest">申购</div>
                    <div className="num text-base">
                      {s.mode === 'margin' ? `${s.marginMultiplier}× · ` : ''}{s.lotsApplied} 手
                    </div>
                  </div>
                  <div className="col-span-2 text-center">
                    <div className="text-[10px] uppercase text-ink-mute tracking-widest">中签</div>
                    <input
                      type="number"
                      value={s.lotsAllocated ?? ''}
                      onChange={(e) => updateSubscription(s.id, { lotsAllocated: e.target.value ? +e.target.value : undefined })}
                      className="w-20 mx-auto bg-transparent border-b border-ink/40 text-center font-mono py-0.5"
                      placeholder="—"
                    />
                    <div className="text-[10px] text-ink-mute mt-1">手</div>
                  </div>
                  <div className="col-span-2 text-right">
                    {s.mode === 'margin' && (
                      <>
                        <div className="text-[10px] uppercase text-ink-mute tracking-widest">融资成本</div>
                        <div className="num text-sm">{HKD(s.marginCost)}</div>
                        <div className="text-[10px] text-ink-mute">{s.feeCoveredByMain ? '主理人兜底' : '自付'}</div>
                      </>
                    )}
                    {s.mode === 'cash' && <span className="text-xs text-ink-mute">现金申购</span>}
                  </div>
                  <div className="col-span-1 text-right">
                    <button onClick={() => { if (confirm('删除此申购记录？')) removeSubscription(s.id) }} className="text-xs uppercase tracking-widest text-ink-mute hover:text-accent">删除</button>
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
