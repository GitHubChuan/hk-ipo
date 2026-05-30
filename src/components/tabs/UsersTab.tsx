import { useStore } from '@/lib/store'
import type { User } from '@/lib/types'
import { useState } from 'react'
import {
  SectionTitle,
  Tag,
  PrimaryButton,
  GhostButton,
  Field,
  TextInput,
  Select,
  EmptyState,
} from '@/components/shared/Editorial'

export default function UsersTab() {
  const { users, partners, addUser, updateUser, removeUser, addPartner } = useStore()
  const [draft, setDraft] = useState({
    username: '',
    password: '',
    displayName: '',
    role: 'partner' as 'partner' | 'admin',
    partnerId: '' as string,
    capital: 100000,
    shareRatio: 0.2,
    autoCreatePartner: true,
  })
  const [pwdEdit, setPwdEdit] = useState<Record<string, string>>({})

  const submit = () => {
    if (!draft.username || !draft.password || !draft.displayName) {
      return alert('请填写账号 / 密码 / 显示名')
    }
    let pid = draft.partnerId
    if (draft.role === 'partner' && draft.autoCreatePartner && !pid) {
      pid = addPartner({
        name: draft.displayName,
        capital: draft.capital,
        shareRatio: draft.shareRatio,
        color: ['#1E40AF', '#1F4D3F', '#C49A4A', '#7C3AED', '#0F766E'][partners.length % 5],
      })
    }
    const r = addUser({
      username: draft.username,
      password: draft.password,
      role: draft.role,
      displayName: draft.displayName,
      partnerId: draft.role === 'partner' ? pid : undefined,
    })
    if (!r.ok) return alert(r.message)
    setDraft({
      username: '',
      password: '',
      displayName: '',
      role: 'partner',
      partnerId: '',
      capital: 100000,
      shareRatio: 0.2,
      autoCreatePartner: true,
    })
    alert('账号创建成功 ✓')
  }

  const resetPwd = (u: User) => {
    const p = pwdEdit[u.id]
    if (!p || p.length < 6) return alert('密码至少 6 位')
    updateUser(u.id, { password: p } as any)
    setPwdEdit({ ...pwdEdit, [u.id]: '' })
    alert(`已重置 ${u.displayName} 的密码`)
  }

  return (
    <div className="space-y-12">
      <SectionTitle
        index="IX"
        en="User Management"
        zh="用户管理 · 仅管理员"
        desc="为每位合伙人开通账号，绑定到具体 Partner 后，他们登录后只能看到属于自己的标的、申购与分润数据。"
      />

      {/* 现有账号 */}
      <section>
        <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
          <h3 className="font-serif text-2xl">账号花名册 · {users.length}</h3>
          <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">ROSTER</span>
        </div>
        {users.length === 0 ? (
          <EmptyState title="暂无账号" />
        ) : (
          <div className="space-y-3">
            {users.map((u) => {
              const partner = partners.find((p) => p.id === u.partnerId)
              return (
                <article key={u.id} className="grid grid-cols-12 gap-3 items-center border border-rule p-4 bg-paper">
                  <div className="col-span-3">
                    <div className="font-serif text-xl">{u.displayName}</div>
                    <div className="text-xs font-mono text-ink-mute">@{u.username}</div>
                  </div>
                  <div className="col-span-2">
                    <Tag variant={u.role === 'admin' ? 'accent' : 'default'}>
                      {u.role === 'admin' ? '超级管理员' : '合伙人'}
                    </Tag>
                  </div>
                  <div className="col-span-2 text-sm text-ink-soft">
                    {partner ? (
                      <>
                        绑定 → <span className="font-serif text-ink">{partner.name}</span>
                      </>
                    ) : (
                      <span className="text-ink-mute italic">未绑定</span>
                    )}
                  </div>
                  <div className="col-span-3 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="重置密码…"
                      value={pwdEdit[u.id] ?? ''}
                      onChange={(e) => setPwdEdit({ ...pwdEdit, [u.id]: e.target.value })}
                      className="flex-1 bg-transparent border-b border-ink/40 font-mono text-sm py-1"
                    />
                    <button
                      onClick={() => resetPwd(u)}
                      className="text-[10px] uppercase tracking-widest underline underline-offset-4 hover:text-accent"
                    >
                      重置
                    </button>
                  </div>
                  <div className="col-span-2 text-right">
                    {u.id !== 'u_admin' && (
                      <button
                        onClick={() => {
                          if (confirm(`确定移除账号 @${u.username}？`)) removeUser(u.id)
                        }}
                        className="text-[10px] uppercase tracking-widest text-ink-mute hover:text-accent"
                      >
                        移除
                      </button>
                    )}
                    <div className="text-[10px] text-ink-mute mt-1">
                      {u.lastLoginAt ? `最近登录 ${new Date(u.lastLoginAt).toLocaleDateString()}` : '从未登录'}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* 新增 */}
      <section className="border-2 border-dashed border-rule p-6 bg-paper-2/30">
        <h3 className="font-serif text-2xl mb-5">+ 创建合伙人账号</h3>
        <div className="grid grid-cols-3 gap-5">
          <Field label="登录账号">
            <TextInput value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value.replace(/\s/g, '') })} placeholder="zhang3" />
          </Field>
          <Field label="初始密码 (≥6位)">
            <TextInput value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} placeholder="输入后告知本人" />
          </Field>
          <Field label="显示名称">
            <TextInput value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} placeholder="张三" />
          </Field>
          <Field label="角色">
            <Select
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value as 'partner' | 'admin' })}
              options={[
                { value: 'partner', label: '合伙人 (只看自己数据)' },
                { value: 'admin', label: '超级管理员 (看全部)' },
              ]}
            />
          </Field>

          {draft.role === 'partner' && (
            <>
              <Field label="绑定 Partner">
                <Select
                  value={draft.partnerId || (draft.autoCreatePartner ? '__auto__' : '')}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '__auto__') setDraft({ ...draft, autoCreatePartner: true, partnerId: '' })
                    else setDraft({ ...draft, autoCreatePartner: false, partnerId: v })
                  }}
                  options={[
                    { value: '__auto__', label: '★ 自动创建新 Partner（推荐）' },
                    ...partners.map((p) => ({ value: p.id, label: `已有 · ${p.name}` })),
                  ]}
                />
              </Field>
              {draft.autoCreatePartner && (
                <>
                  <Field label="本金 (HKD)">
                    <TextInput type="number" value={draft.capital} onChange={(e) => setDraft({ ...draft, capital: +e.target.value })} />
                  </Field>
                  <Field label="分润比例 (0~1)">
                    <TextInput type="number" step={0.01} value={draft.shareRatio} onChange={(e) => setDraft({ ...draft, shareRatio: +e.target.value })} />
                  </Field>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex gap-3 mt-7">
          <PrimaryButton onClick={submit}>创建账号</PrimaryButton>
          <GhostButton onClick={() => setDraft({ ...draft, username: '', password: '', displayName: '' })}>清空</GhostButton>
        </div>
      </section>

      {/* 权限矩阵说明 */}
      <section>
        <div className="border-b border-ink pb-3 mb-6 flex items-baseline justify-between">
          <h3 className="font-serif text-2xl">权限矩阵</h3>
          <span className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">MATRIX</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-ink p-5 bg-paper-2/40">
            <Tag variant="accent">超级管理员 / Admin</Tag>
            <ul className="mt-4 text-sm space-y-1.5 text-ink-soft list-disc list-inside">
              <li>查看 / 编辑所有 IPO、申购、卖出、结算</li>
              <li>录入合伙人、调整本金与分润比例</li>
              <li>创建 / 移除其他用户账号</li>
              <li>修改全局参数（融资利率、行情代理）</li>
              <li>触发新股日历抓取与全局行情刷新</li>
            </ul>
          </div>
          <div className="border border-rule p-5 bg-paper-2/40">
            <Tag>合伙人 / Partner</Tag>
            <ul className="mt-4 text-sm space-y-1.5 text-ink-soft list-disc list-inside">
              <li>只看到自己绑定 partner 相关的标的、申购、分润</li>
              <li>可录入自己的申购明细与中签结果</li>
              <li>不可创建账号、不可看其他合伙人金额</li>
              <li>可修改自己的登录密码</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
