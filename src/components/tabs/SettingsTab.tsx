import { useState } from 'react'
import { useStore, useCurrentUser, useIsAdmin } from '@/lib/store'
import { SectionTitle, Tag, PrimaryButton, GhostButton, Field, TextInput, Select } from '@/components/shared/Editorial'

export default function SettingsTab() {
  const { partners, config, updateConfig, resetAll, changeMyPassword } = useStore()
  const me = useCurrentUser()
  const isAdmin = useIsAdmin()
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')

  return (
    <div className="space-y-12">
      <SectionTitle index="XI" en="Configuration" zh="设置" desc="管理资金池参数与个人密码（合伙人档案请到《§IX 合伙人账户》维护）。" />

      {/* 合伙人花名册已迁移到 §IX「合伙人账户」页面，这里只保留快捷指引 */}
      {isAdmin && (
        <section>
          <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
            <h3 className="font-serif text-2xl">合伙人账户</h3>
            <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">MOVED → §IX</span>
          </div>
          <div className="border border-rule bg-paper-2/40 p-5 text-sm text-ink-soft leading-relaxed">
            合伙人花名册（姓名、本金、分润比例、联系方式、券商账号等）已统一搬迁至
            <strong> §IX 合伙人账户 </strong>页面。
            主理人在该页可编辑全部账户；合伙人登录后只能维护自己的档案。
          </div>
        </section>
      )}

      {/* 全局参数 — 仅管理员 */}
      {isAdmin && (
        <section>
          <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
            <h3 className="font-serif text-2xl">全局参数</h3>
            <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">GLOBAL TUNING</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <Field label="团队总资金 (HKD)">
              <TextInput type="number" value={config.teamCapital} onChange={(e) => updateConfig({ teamCapital: +e.target.value })} />
            </Field>
            <Field label="默认融资利率 %">
              <TextInput type="number" step={0.1} value={config.defaultMarginRate} onChange={(e) => updateConfig({ defaultMarginRate: +e.target.value })} />
            </Field>
            <Field label="默认计息天数">
              <TextInput type="number" value={config.defaultMarginDays} onChange={(e) => updateConfig({ defaultMarginDays: +e.target.value })} />
            </Field>
            <Field label="红鞋小资金优势倍数" hint="默认 1.4">
              <TextInput type="number" step={0.1} value={config.defaultRedShoeBoost} onChange={(e) => updateConfig({ defaultRedShoeBoost: +e.target.value })} />
            </Field>
            <Field label="主理人 (兜底融资费)">
              <Select
                value={config.mainPartnerId ?? ''}
                onChange={(e) => updateConfig({ mainPartnerId: e.target.value })}
                options={[{ value: '', label: '— 未指定 —' }, ...partners.map((p) => ({ value: p.id, label: p.name }))]}
              />
            </Field>
            <Field label="CORS 行情代理" hint="用于跨域抓 AAStocks/腾讯">
              <TextInput value={config.corsProxy} onChange={(e) => updateConfig({ corsProxy: e.target.value })} />
            </Field>
          </div>
        </section>
      )}

      {/* 全局 10× 杠杆策略 — 决策系统核心 */}
      {isAdmin && (
        <section>
          <div className="border-b-2 border-accent pb-3 mb-6 flex items-baseline justify-between">
            <h3 className="font-serif text-2xl text-accent">10× 杠杆策略 · 全局配置</h3>
            <span className="text-[10px] tracking-[0.3em] uppercase text-accent">LEVERAGE POLICY · 全站统一参数</span>
          </div>
          <div className="border border-accent/30 p-5 bg-accent/5 mb-4">
            <p className="text-xs text-ink-soft leading-relaxed mb-3">
              这一组参数决定 <strong>§III 标的评估</strong>、<strong>§IV 收益回测</strong> 与 <strong>§I 首页火力</strong> 三处的杠杆口径，
              改任意一个会全站同步刷新。<strong className="text-accent">关掉「启用杠杆决策」</strong> 后，全站只算现金口径。
            </p>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={config.leverageEnabled}
                onChange={(e) => updateConfig({ leverageEnabled: e.target.checked })}
                className="w-4 h-4 accent-accent"
              />
              <span className="font-semibold">启用杠杆决策面板</span>
              <span className="text-[10px] uppercase tracking-widest text-ink-mute">
                {config.leverageEnabled ? '✓ 当前杠杆模式已开启' : '✗ 当前仅现金模式'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Field label="杠杆倍数 (×)" hint="券商提供，例如 10× = 1自有+9融资">
              <TextInput
                type="number"
                step={0.5}
                min={1}
                max={20}
                value={config.leverageMultiple}
                onChange={(e) => updateConfig({ leverageMultiple: +e.target.value })}
              />
            </Field>
            <Field label="融资年化利率 %" hint="一般 4%–7%，建议谈到 5% 以下">
              <TextInput
                type="number"
                step={0.1}
                value={config.leverageMarginRate}
                onChange={(e) => updateConfig({ leverageMarginRate: +e.target.value })}
              />
            </Field>
            <Field label="资金占用天数" hint="申购→中签返款窗口，通常 5–9 天">
              <TextInput
                type="number"
                value={config.leverageDaysHeld}
                onChange={(e) => updateConfig({ leverageDaysHeld: +e.target.value })}
              />
            </Field>
            <Field label="红鞋衰减系数" hint="0.5–0.8，越接近 1 越线性放大；A组小户回报折半">
              <TextInput
                type="number"
                step={0.05}
                min={0.1}
                max={1}
                value={config.leverageRedShoeDecay}
                onChange={(e) => updateConfig({ leverageRedShoeDecay: +e.target.value })}
              />
            </Field>
            <Field label="券商融资额度上限 (HKD)" hint="券商授信总额，约束「总火力」上限">
              <TextInput
                type="number"
                value={config.leverageBrokerLimit}
                onChange={(e) => updateConfig({ leverageBrokerLimit: +e.target.value })}
              />
            </Field>
            <div className="border border-rule p-3 bg-paper-2/40 text-[11px] leading-relaxed">
              <div className="text-[10px] uppercase tracking-widest text-ink-mute mb-1">SELF-CHECK · 火力体检</div>
              <div>自有：<span className="font-mono">{(config.teamCapital/10000).toFixed(0)}万</span></div>
              <div>理论可融资：<span className="font-mono">{(config.teamCapital * (config.leverageMultiple - 1) / 10000).toFixed(0)}万</span></div>
              <div>券商授信：<span className="font-mono">{(config.leverageBrokerLimit/10000).toFixed(0)}万</span></div>
              <div className="border-t border-rule mt-1 pt-1 text-accent font-semibold">
                实际总火力：<span className="font-mono">{(Math.min(config.teamCapital * config.leverageMultiple, config.teamCapital + config.leverageBrokerLimit) / 10000).toFixed(0)}万</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 个人密码 — 所有人可见 */}
      <section>
        <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
          <h3 className="font-serif text-2xl">我的账号</h3>
          <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">MY PROFILE</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-ink p-5 bg-paper-2/40">
            <div className="text-[10px] uppercase tracking-widest text-ink-mute">登录身份</div>
            <div className="font-serif text-2xl mt-1">{me?.displayName}</div>
            <div className="text-xs font-mono text-ink-mute">@{me?.username} · <Tag variant={me?.role === 'admin' ? 'accent' : 'default'}>{me?.role === 'admin' ? '超级管理员' : '合伙人'}</Tag></div>
          </div>
          <div className="border border-ink p-5 bg-paper-2/40">
            <h4 className="font-serif text-xl mb-4">修改密码</h4>
            <Field label="旧密码">
              <TextInput type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
            </Field>
            <div className="mt-3" />
            <Field label="新密码 (≥6位)">
              <TextInput type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            </Field>
            <PrimaryButton className="mt-4" onClick={() => {
              const r = changeMyPassword(oldPwd, newPwd)
              if (!r.ok) return alert(r.message)
              setOldPwd(''); setNewPwd('')
              alert('密码已更新 ✓')
            }}>更新密码</PrimaryButton>
          </div>
        </div>
      </section>

      {/* 危险操作 — 仅管理员 */}
      {isAdmin && (
        <section>
          <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
            <h3 className="font-serif text-2xl">数据管理</h3>
            <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">DANGER ZONE</span>
          </div>
          <div className="border border-accent p-5 bg-paper-2/40">
            <p className="text-xs text-ink-soft mb-4">
              所有数据保存在浏览器 LocalStorage（key: <span className="font-mono">hk-ipo-store-v2</span>）。
              清空数据不会删除用户账号，但会丢失全部 IPO/申购/结算记录。
            </p>
            <GhostButton onClick={() => {
              if (confirm('确定清空所有业务数据？此操作不可恢复（账号会保留）。')) {
                resetAll()
                alert('数据已重置')
              }
            }}>清空所有业务数据</GhostButton>
          </div>
        </section>
      )}
    </div>
  )
}
