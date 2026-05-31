import { useState, useMemo } from 'react'
import {
  useStore,
  useIsAdmin,
  useCurrentUser,
  useVisiblePartners,
  canEditPartner,
  canViewPartnerSensitive,
} from '@/lib/store'
import type { Partner } from '@/lib/types'
import {
  SectionTitle,
  Tag,
  PrimaryButton,
  GhostButton,
  Field,
  TextInput,
  Select,
  EmptyState,
  HKD,
  StatBlock,
} from '@/components/shared/Editorial'

// ─────────────────────────────────────────────
// 合伙人账户维护页 · §IX
// 主理人：可编辑全部 Partner（含本金 / 分润比例 / 主理人开关 / 敏感字段）
// 合伙人：只能查看并编辑自己绑定的 Partner（不可改本金 & 分润比例 & 颜色 / 主理人）
// ─────────────────────────────────────────────

export default function PartnersTab() {
  const me = useCurrentUser()
  const isAdmin = useIsAdmin()
  const partners = useVisiblePartners()
  const allPartners = useStore((s) => s.partners)
  const subscriptions = useStore((s) => s.subscriptions)
  const sales = useStore((s) => s.sales)
  const settlements = useStore((s) => s.settlements)
  const config = useStore((s) => s.config)
  const updatePartner = useStore((s) => s.updatePartner)
  const updateConfig = useStore((s) => s.updateConfig)

  // 卡片是否展开编辑
  const [editingId, setEditingId] = useState<string | null>(null)

  const totalRatio = isAdmin ? allPartners.reduce((a, b) => a + b.shareRatio, 0) : null
  const totalCapital = isAdmin ? allPartners.reduce((a, b) => a + b.capital, 0) : null

  // 计算每位 partner 的累计分润 & 申购数
  const stats = useMemo(() => {
    const map: Record<string, { totalProfit: number; subCount: number; saleCount: number }> = {}
    partners.forEach((p) => {
      const totalProfit = settlements.reduce((acc, st) => {
        const d = st.distributions.find((x) => x.partnerId === p.id)
        return acc + (d?.amount ?? 0)
      }, 0)
      const subCount = subscriptions.filter((s) => s.partnerId === p.id).length
      const saleCount = sales.filter((s) => s.partnerId === p.id).length
      map[p.id] = { totalProfit, subCount, saleCount }
    })
    return map
  }, [partners, subscriptions, sales, settlements])

  return (
    <div className="space-y-12">
      <SectionTitle
        index="IX"
        en="Partner Accounts"
        zh="合伙人账户维护"
        desc={
          isAdmin
            ? '主理人视图 · 可编辑全部合伙人的本金、分润比例、联系方式与账号信息。'
            : '合伙人视图 · 只能查看并维护你自己的账户信息（联系方式、券商账号、风险偏好等），本金与分润比例由主理人统一管理。'
        }
      />

      {/* 顶部 KPI — 仅主理人 */}
      {isAdmin && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <StatBlock label="合伙人总数" value={`${allPartners.length} 位`} hint="含主理人" />
          <StatBlock label="账户总本金" value={HKD(totalCapital ?? 0, false)} unit="HKD" highlight="accent" />
          <StatBlock
            label="分润比例总和"
            value={`${((totalRatio ?? 0) * 100).toFixed(0)}%`}
            hint={(totalRatio ?? 0) > 1 ? '⚠ 超过 100%（结算时归一化）' : '系统会归一化为 100%'}
          />
          <StatBlock label="主理人 (兜底融资费)" value={allPartners.find((p) => p.id === config.mainPartnerId)?.name ?? '—'} hint="承担融资手续费" />
        </section>
      )}

      {/* 列表 */}
      <section>
        <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
          <h3 className="font-serif text-2xl">
            {isAdmin ? `账户花名册 · ${partners.length} 人` : '我的账户档案'}
          </h3>
          <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">
            {isAdmin ? "PARTNERS' ROSTER" : 'MY PROFILE'}
          </span>
        </div>

        {partners.length === 0 ? (
          <EmptyState
            title={isAdmin ? '尚未录入合伙人' : '你的账号尚未绑定合伙人'}
            hint={isAdmin ? '到下方表单录入第一位合伙人。' : '请联系主理人将你的账号绑定到合伙人档案。'}
          />
        ) : (
          <div className="space-y-4">
            {partners.map((p) => {
              const editable = canEditPartner(me?.role, me?.partnerId, p.id)
              const sensitiveVisible = canViewPartnerSensitive(me?.role, me?.partnerId, p.id)
              const isMine = me?.partnerId === p.id || p.ownerUserId === me?.id
              const isEditing = editingId === p.id
              const s = stats[p.id] ?? { totalProfit: 0, subCount: 0, saleCount: 0 }

              return (
                <article
                  key={p.id}
                  className={[
                    'border bg-paper transition-all',
                    isMine ? 'border-accent border-l-[6px]' : 'border-rule',
                  ].join(' ')}
                >
                  {/* 卡片头部：基础信息 + 操作 */}
                  <div className="grid grid-cols-12 gap-4 items-center p-5">
                    <div className="col-span-1 flex justify-center">
                      <div
                        className="w-12 h-12 rounded-full border-2 border-ink flex items-center justify-center font-serif text-2xl text-paper"
                        style={{ background: p.color }}
                      >
                        {p.name.slice(0, 1)}
                      </div>
                    </div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-serif text-2xl">{p.name}</h4>
                        {isMine && <Tag variant="accent">我的</Tag>}
                        {config.mainPartnerId === p.id && <Tag variant="accent">主理人</Tag>}
                      </div>
                      <div className="text-[11px] font-mono text-ink-mute mt-1">
                        加入于 {new Date(p.joinedAt).toLocaleDateString('zh-CN')}
                      </div>
                      {p.riskPreference && (
                        <div className="text-[11px] mt-1">
                          风险偏好：
                          <span className="italic">
                            {p.riskPreference === 'aggressive' && '激进型'}
                            {p.riskPreference === 'balanced' && '稳健型'}
                            {p.riskPreference === 'conservative' && '保守型'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 text-center">
                      <div className="text-[10px] uppercase tracking-widest text-ink-mute">投入本金</div>
                      <div className="num display text-xl">{HKD(p.capital, false)}</div>
                      <div className="text-[10px] text-ink-mute">HKD</div>
                    </div>
                    <div className="col-span-2 text-center">
                      <div className="text-[10px] uppercase tracking-widest text-ink-mute">分润比例</div>
                      <div className="num display text-xl text-accent">{(p.shareRatio * 100).toFixed(0)}%</div>
                    </div>
                    <div className="col-span-2 text-center">
                      <div className="text-[10px] uppercase tracking-widest text-ink-mute">累计分润</div>
                      <div
                        className={`num display text-xl ${s.totalProfit >= 0 ? 'text-accent' : 'text-accent-2'}`}
                      >
                        {HKD(s.totalProfit, false)}
                      </div>
                      <div className="text-[10px] text-ink-mute">
                        申购 {s.subCount} · 卖出 {s.saleCount}
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      {editable ? (
                        <button
                          onClick={() => setEditingId(isEditing ? null : p.id)}
                          className="text-[10px] uppercase tracking-widest underline underline-offset-4 hover:text-accent"
                        >
                          {isEditing ? '收起' : '编辑账户'}
                        </button>
                      ) : (
                        <span className="text-[10px] uppercase tracking-widest text-ink-mute italic">
                          只读
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 编辑区 */}
                  {isEditing && editable && (
                    <div className="border-t border-rule bg-paper-2/30 p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <Field label="姓名 / 昵称">
                          <TextInput
                            value={p.name}
                            onChange={(e) => updatePartner(p.id, { name: e.target.value })}
                          />
                        </Field>

                        <Field label="主题色">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={p.color}
                              disabled={!isAdmin}
                              onChange={(e) => updatePartner(p.id, { color: e.target.value })}
                              className="w-10 h-10 border border-rule cursor-pointer disabled:opacity-50"
                            />
                            <span className="text-[10px] font-mono text-ink-mute">{p.color}</span>
                            {!isAdmin && (
                              <span className="text-[10px] text-ink-mute italic">(仅主理人可改)</span>
                            )}
                          </div>
                        </Field>

                        <Field label="风险偏好">
                          <Select
                            value={p.riskPreference ?? 'balanced'}
                            onChange={(e) =>
                              updatePartner(p.id, {
                                riskPreference: e.target.value as Partner['riskPreference'],
                              })
                            }
                            options={[
                              { value: 'aggressive', label: '激进型 — 大手 / 全杠杆' },
                              { value: 'balanced', label: '稳健型 — 一手 / 量力而行' },
                              { value: 'conservative', label: '保守型 — 仅参与超额认购热门' },
                            ]}
                          />
                        </Field>

                        <Field label="联系方式 (手机)">
                          <TextInput
                            value={p.phone ?? ''}
                            placeholder="13800138000"
                            onChange={(e) => updatePartner(p.id, { phone: e.target.value })}
                          />
                        </Field>

                        <Field label="电子邮件">
                          <TextInput
                            type="email"
                            value={p.email ?? ''}
                            placeholder="name@example.com"
                            onChange={(e) => updatePartner(p.id, { email: e.target.value })}
                          />
                        </Field>

                        <Field label="备注 / 标签">
                          <TextInput
                            value={p.note ?? ''}
                            placeholder="例：兜底融资费 / 老朋友 / ……"
                            onChange={(e) => updatePartner(p.id, { note: e.target.value })}
                          />
                        </Field>

                        {/* 敏感字段：仅本人 + admin 可见 */}
                        {sensitiveVisible && (
                          <>
                            <Field label="券商账号">
                              <TextInput
                                value={p.brokerAccount ?? ''}
                                placeholder="例：富途 8XXXX-X"
                                onChange={(e) => updatePartner(p.id, { brokerAccount: e.target.value })}
                              />
                            </Field>
                            <Field label="收款账号 / 银行卡末四位">
                              <TextInput
                                value={p.bankAccount ?? ''}
                                placeholder="例：招行 ****1234"
                                onChange={(e) => updatePartner(p.id, { bankAccount: e.target.value })}
                              />
                            </Field>
                            <div className="flex items-end">
                              <span className="text-[10px] text-ink-mute italic leading-relaxed">
                                🔒 券商 / 收款账号仅你本人和主理人可见，其它合伙人无法查看。
                              </span>
                            </div>
                          </>
                        )}

                        {/* 资金类字段：仅 admin 可改 */}
                        {isAdmin ? (
                          <>
                            <Field label="投入本金 (HKD)">
                              <TextInput
                                type="number"
                                value={p.capital}
                                onChange={(e) => updatePartner(p.id, { capital: +e.target.value })}
                              />
                            </Field>
                            <Field label="分润比例 (0~1)" hint="例：0.4 表示拿 40%">
                              <TextInput
                                type="number"
                                step={0.01}
                                min={0}
                                max={1}
                                value={p.shareRatio}
                                onChange={(e) => updatePartner(p.id, { shareRatio: +e.target.value })}
                              />
                            </Field>
                            <div className="flex items-end gap-3">
                              <button
                                onClick={() => updateConfig({ mainPartnerId: p.id })}
                                disabled={config.mainPartnerId === p.id}
                                className="text-[10px] uppercase tracking-widest underline underline-offset-4 hover:text-accent disabled:opacity-30 disabled:no-underline disabled:cursor-not-allowed"
                              >
                                {config.mainPartnerId === p.id ? '✓ 当前主理人' : '设为主理人'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="md:col-span-3 border-l-4 border-rule pl-4 py-2 bg-paper-2/40">
                            <div className="text-[10px] uppercase tracking-widest text-ink-mute mb-1">
                              资金类字段
                            </div>
                            <div className="text-xs text-ink-soft leading-relaxed">
                              本金 <span className="num">{HKD(p.capital)}</span> · 分润{' '}
                              <span className="num">{(p.shareRatio * 100).toFixed(0)}%</span> ·
                              由主理人统一管理，如需变更请联系。
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 mt-6 justify-end">
                        <GhostButton onClick={() => setEditingId(null)}>完成</GhostButton>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* 创建合伙人入口 — 仅主理人 */}
      {isAdmin && <CreatePartnerForm />}

      {/* 权限说明 */}
      <section className="border border-rule bg-paper-2/40 p-5">
        <div className="text-[10px] uppercase tracking-widest text-ink-mute mb-2">
          PERMISSION MODEL · 权限说明
        </div>
        <ul className="text-xs text-ink-soft leading-relaxed list-disc list-inside space-y-1">
          <li>
            <strong>主理人 / Admin</strong>：可查看与编辑全部合伙人，包含本金、分润比例、主理人开关。
          </li>
          <li>
            <strong>合伙人 / Partner</strong>：只能查看与编辑自己绑定的账户。本金与分润比例为只读，由主理人统一管理。
          </li>
          <li>
            <strong>敏感字段</strong>（券商账号、收款账号）只对本人 + 主理人可见，其他合伙人即便登录也看不到。
          </li>
          <li>新建账号 / 重置密码请到 <strong>§ 用户管理</strong>。</li>
        </ul>
      </section>
    </div>
  )
}

// ─────────── 主理人专属：新增合伙人小表单 ───────────
function CreatePartnerForm() {
  const partners = useStore((s) => s.partners)
  const addPartner = useStore((s) => s.addPartner)
  const [draft, setDraft] = useState({
    name: '',
    capital: 100000,
    shareRatio: 0.2,
    phone: '',
    email: '',
    riskPreference: 'balanced' as 'aggressive' | 'balanced' | 'conservative',
  })
  const palette = ['#1E40AF', '#B83A2B', '#1F4D3F', '#C49A4A', '#7C3AED', '#0F766E']

  const submit = () => {
    if (!draft.name.trim()) return alert('请填写姓名')
    addPartner({
      name: draft.name.trim(),
      capital: draft.capital,
      shareRatio: draft.shareRatio,
      color: palette[partners.length % palette.length],
      phone: draft.phone || undefined,
      email: draft.email || undefined,
      riskPreference: draft.riskPreference,
    })
    setDraft({
      name: '',
      capital: 100000,
      shareRatio: 0.2,
      phone: '',
      email: '',
      riskPreference: 'balanced',
    })
    alert('合伙人已加入花名册 ✓')
  }

  return (
    <section className="border-2 border-dashed border-rule p-6 bg-paper-2/30">
      <h3 className="font-serif text-2xl mb-1">+ 新增合伙人档案</h3>
      <p className="text-[11px] text-ink-mute mb-5">
        仅创建账户档案，<strong>不会自动开通登录账号</strong>；需要登录请到「§ 用户管理」继续操作。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Field label="姓名 / 昵称">
          <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="张三" />
        </Field>
        <Field label="本金 (HKD)">
          <TextInput type="number" value={draft.capital} onChange={(e) => setDraft({ ...draft, capital: +e.target.value })} />
        </Field>
        <Field label="分润比例 (0~1)">
          <TextInput type="number" step={0.01} value={draft.shareRatio} onChange={(e) => setDraft({ ...draft, shareRatio: +e.target.value })} />
        </Field>
        <Field label="联系电话">
          <TextInput value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="13800138000" />
        </Field>
        <Field label="电子邮件">
          <TextInput type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="name@example.com" />
        </Field>
        <Field label="风险偏好">
          <Select
            value={draft.riskPreference}
            onChange={(e) => setDraft({ ...draft, riskPreference: e.target.value as any })}
            options={[
              { value: 'aggressive', label: '激进型' },
              { value: 'balanced', label: '稳健型' },
              { value: 'conservative', label: '保守型' },
            ]}
          />
        </Field>
      </div>
      <div className="flex gap-3 mt-6">
        <PrimaryButton onClick={submit}>录入合伙人</PrimaryButton>
        <GhostButton
          onClick={() =>
            setDraft({ name: '', capital: 100000, shareRatio: 0.2, phone: '', email: '', riskPreference: 'balanced' })
          }
        >
          清空
        </GhostButton>
      </div>
    </section>
  )
}
