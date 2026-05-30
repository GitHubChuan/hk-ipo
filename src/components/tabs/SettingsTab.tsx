import { useState } from 'react'
import { useStore, useCurrentUser, useIsAdmin } from '@/lib/store'
import { SectionTitle, Tag, PrimaryButton, GhostButton, Field, TextInput, Select, EmptyState } from '@/components/shared/Editorial'

const colorPalette = ['#1E40AF', '#B83A2B', '#1F4D3F', '#C49A4A', '#7C3AED', '#0F766E']

export default function SettingsTab() {
  const { partners, addPartner, updatePartner, removePartner, config, updateConfig, resetAll, changeMyPassword } = useStore()
  const me = useCurrentUser()
  const isAdmin = useIsAdmin()
  const [newPartner, setNewPartner] = useState({ name: '', capital: 0, shareRatio: 0.2 })
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')

  const onAddPartner = () => {
    if (!newPartner.name) return alert('请填写姓名')
    addPartner({
      name: newPartner.name,
      capital: newPartner.capital,
      shareRatio: newPartner.shareRatio,
      color: colorPalette[partners.length % colorPalette.length],
    })
    setNewPartner({ name: '', capital: 0, shareRatio: 0.2 })
  }

  const totalRatio = partners.reduce((a, b) => a + b.shareRatio, 0)

  return (
    <div className="space-y-12">
      <SectionTitle index="X" en="Configuration" zh="设置" desc="管理合伙人花名册、资金池参数与个人密码。" />

      {/* 合伙人花名册 — 仅管理员 */}
      {isAdmin && (
        <section>
          <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
            <h3 className="font-serif text-2xl">合伙人花名册 · {partners.length} 人</h3>
            <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">PARTNERS' ROSTER</span>
          </div>

          {partners.length === 0 ? (
            <EmptyState title="还没有合伙人" />
          ) : (
            <div className="space-y-3 mb-6">
              {partners.map((p) => (
                <article key={p.id} className="grid grid-cols-12 gap-3 items-center border border-rule p-4">
                  <div className="col-span-1">
                    <input
                      type="color"
                      value={p.color}
                      onChange={(e) => updatePartner(p.id, { color: e.target.value })}
                      className="w-10 h-10 border border-rule cursor-pointer"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      value={p.name}
                      onChange={(e) => updatePartner(p.id, { name: e.target.value })}
                      className="w-full bg-transparent border-b border-ink/40 font-serif text-lg py-1"
                    />
                    {config.mainPartnerId === p.id && <Tag variant="accent">主理人 / 兜底</Tag>}
                  </div>
                  <div className="col-span-3">
                    <Field label="投入本金 (HKD)">
                      <input
                        type="number"
                        value={p.capital}
                        onChange={(e) => updatePartner(p.id, { capital: +e.target.value })}
                        className="w-full bg-transparent border-b border-ink/40 font-mono py-1"
                      />
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <Field label="分润比例">
                      <input
                        type="number"
                        step={0.01}
                        max={1}
                        min={0}
                        value={p.shareRatio}
                        onChange={(e) => updatePartner(p.id, { shareRatio: +e.target.value })}
                        className="w-full bg-transparent border-b border-ink/40 font-mono py-1"
                      />
                    </Field>
                  </div>
                  <div className="col-span-2 text-right space-y-1">
                    <button onClick={() => updateConfig({ mainPartnerId: p.id })} className="text-[10px] uppercase tracking-widest underline underline-offset-4 hover:text-accent block ml-auto">
                      设为主理人
                    </button>
                    <button onClick={() => { if (confirm('确定移除此合伙人？')) removePartner(p.id) }} className="text-[10px] uppercase tracking-widest text-ink-mute hover:text-accent block ml-auto">
                      移除
                    </button>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-xs text-ink-mute font-mono">{(p.shareRatio * 100).toFixed(0)}%</span>
                  </div>
                </article>
              ))}
              <div className="text-xs text-ink-mute italic mt-2">
                当前分润比例总和：{(totalRatio * 100).toFixed(0)}%（系统会在结算时自动归一化为 100%）
              </div>
            </div>
          )}

          <div className="border-2 border-dashed border-rule p-5 bg-paper-2/30">
            <h4 className="font-serif text-xl mb-4">+ 新增合伙人（不绑定账号）</h4>
            <div className="grid grid-cols-4 gap-4">
              <Field label="姓名">
                <TextInput value={newPartner.name} onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })} />
              </Field>
              <Field label="本金 (HKD)">
                <TextInput type="number" value={newPartner.capital} onChange={(e) => setNewPartner({ ...newPartner, capital: +e.target.value })} />
              </Field>
              <Field label="初始分润比例">
                <TextInput type="number" step={0.01} value={newPartner.shareRatio} onChange={(e) => setNewPartner({ ...newPartner, shareRatio: +e.target.value })} />
              </Field>
              <div className="flex items-end">
                <PrimaryButton onClick={onAddPartner}>录入</PrimaryButton>
              </div>
            </div>
            <p className="text-[11px] text-ink-mute mt-3 italic">
              提示：如果要给合伙人开通登录账号，请到「§VIII 用户管理」中创建。
            </p>
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
