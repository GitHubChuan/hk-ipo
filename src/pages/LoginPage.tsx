import { useState } from 'react'
import { useStore } from '@/lib/store'

export default function LoginPage() {
  const signIn = useStore((s) => s.signIn)
  const [username, setUsername] = useState('')
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    const r = signIn(username, pwd)
    if (!r.ok) setErr(r.message ?? '登录失败')
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="px-8 pt-10 pb-6 border-b border-ink">
        <div className="max-w-6xl mx-auto flex items-end justify-between">
          <div>
            <div className="text-[10px] tracking-[0.4em] uppercase text-ink-mute mb-2">
              VOL. I · {new Date().toLocaleDateString('zh-CN')}
            </div>
            <h1 className="font-serif display text-6xl md:text-7xl">The IPO Ledger</h1>
            <p className="text-sm text-ink-soft mt-1 italic">
              港股打新合伙人协作工作台 · A Private Newsroom for Hong Kong New Listings
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="font-serif text-3xl">壹</div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute mt-1">PARTNERS' DESK</div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center px-8 py-16">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12">
          <section className="lg:col-span-7 space-y-6">
            <div className="text-[10px] tracking-[0.3em] uppercase text-accent">
              From the Editor's Desk · 卷首语
            </div>
            <h2 className="font-serif display text-4xl md:text-5xl leading-tight">
              用一份"账本"，<br />让合伙人，<br />在打新桌前共享一颗大脑。
            </h2>
            <div className="rule mt-8" />
            <div className="grid grid-cols-3 gap-6 text-sm pt-6">
              <div>
                <div className="text-[10px] tracking-[0.25em] uppercase text-ink-mute mb-1">01 · 评估白盒</div>
                <p className="text-ink-soft leading-relaxed">所有数字均可悬停查看公式与原始入参，决策全程可审计。</p>
              </div>
              <div>
                <div className="text-[10px] tracking-[0.25em] uppercase text-ink-mute mb-1">02 · 角色权限</div>
                <p className="text-ink-soft leading-relaxed">主理人看全局；合伙人只看自己绑定的数据。</p>
              </div>
              <div>
                <div className="text-[10px] tracking-[0.25em] uppercase text-ink-mute mb-1">03 · 实时行情</div>
                <p className="text-ink-soft leading-relaxed">自动抓港股新股日历、暗盘行情与盘中报价，决策不再靠手抄。</p>
              </div>
            </div>
          </section>

          <section className="lg:col-span-5">
            <div className="bg-paper-2 border border-ink p-8 corner-tag">
              <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute mb-1">SUBSCRIBERS ONLY</div>
              <h3 className="font-serif text-3xl mb-6">合伙人入口</h3>
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <label className="block text-xs tracking-widest uppercase text-ink-soft mb-2">
                    Username · 账号
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入账号"
                    className="w-full bg-transparent border-b-2 border-ink focus:border-accent outline-none py-2 px-1 font-mono text-lg tracking-wider"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs tracking-widest uppercase text-ink-soft mb-2">
                    Password · 密码
                  </label>
                  <input
                    type="password"
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full bg-transparent border-b-2 border-ink focus:border-accent outline-none py-2 px-1 font-mono text-lg tracking-wider"
                  />
                </div>
                {err && <p className="text-accent text-xs">{err}</p>}
                <button
                  type="submit"
                  className="w-full bg-ink text-paper py-3 font-medium tracking-[0.2em] uppercase text-xs hover:bg-accent transition-colors"
                >
                  Enter the Newsroom →
                </button>
              </form>
              <div className="mt-8 pt-6 border-t border-rule">
                <p className="text-xs text-ink-mute leading-relaxed">
                  尚未开通账号？请联系主理人为你创建合伙人入口。
                </p>
              </div>
            </div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute mt-6 text-right italic">
              "Information is the currency of confidence." — H. Markowitz
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-ink px-8 py-4 text-[10px] tracking-[0.2em] uppercase text-ink-mute flex justify-between">
        <span>© 2026 The IPO Ledger · Private Edition</span>
        <span>Crafted with 朱砂 & 墨</span>
      </footer>
    </div>
  )
}
