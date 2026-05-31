import { useState } from 'react'
import { useStore, useCurrentUser, useIsAdmin } from '@/lib/store'
import OverviewTab from '@/components/tabs/OverviewTab'
import EvaluationTab from '@/components/tabs/EvaluationTab'
import AllocationTab from '@/components/tabs/AllocationTab'
import HoldingsTab from '@/components/tabs/HoldingsTab'
import SettlementTab from '@/components/tabs/SettlementTab'
import ReviewTab from '@/components/tabs/ReviewTab'
import SettingsTab from '@/components/tabs/SettingsTab'
import UsersTab from '@/components/tabs/UsersTab'
import PartnersTab from '@/components/tabs/PartnersTab'
import CalendarTab from '@/components/tabs/CalendarTab'
import ProfitBacktestTab from '@/components/tabs/ProfitBacktestTab'
import type { IpoCalendarEntry } from '@/lib/market'

const ALL_TABS = [
  { id: 'overview',   label: '总览',         en: 'Overview',    no: 'I',     adminOnly: false },
  { id: 'calendar',   label: '新股日历',     en: 'Calendar',    no: 'II',    adminOnly: false },
  { id: 'eval',       label: '标的评估',     en: 'Evaluation',  no: 'III',   adminOnly: false },
  { id: 'profit',     label: '收益回测',     en: 'Backtest',    no: 'IV',    adminOnly: false },
  { id: 'alloc',      label: '额度分配',     en: 'Allocation',  no: 'V',     adminOnly: false },
  { id: 'holdings',   label: '持仓申购',     en: 'Holdings',    no: 'VI',    adminOnly: false },
  { id: 'settle',     label: '卖出分润',     en: 'Settlement',  no: 'VII',   adminOnly: false },
  { id: 'review',     label: '历史复盘',     en: 'Review',      no: 'VIII',  adminOnly: false },
  { id: 'partners',   label: '合伙人账户',   en: 'Partners',    no: 'IX',    adminOnly: false },
  { id: 'users',      label: '用户管理',     en: 'Users',       no: 'X',     adminOnly: true  },
  { id: 'settings',   label: '设置',         en: 'Settings',    no: 'XI',    adminOnly: false },
] as const

type TabId = (typeof ALL_TABS)[number]['id']

export default function DashboardPage() {
  const [tab, setTab] = useState<TabId>('overview')
  const [focusEntry, setFocusEntry] = useState<IpoCalendarEntry | null>(null)
  const signOut = useStore((s) => s.signOut)
  const me = useCurrentUser()
  const isAdmin = useIsAdmin()

  const TABS = ALL_TABS.filter((t) => isAdmin || !t.adminOnly)

  const jumpToEval = (entry: IpoCalendarEntry) => {
    setFocusEntry(entry)
    setTab('eval')
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b-2 border-ink">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] tracking-[0.4em] uppercase text-ink-mute mb-1">
                VOL. I · {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <h1 className="font-serif display text-4xl md:text-5xl">The IPO Ledger</h1>
              <p className="text-xs italic text-ink-soft mt-1">港股打新合伙人协作工作台</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] tracking-[0.3em] uppercase text-ink-mute">SIGNED IN AS</div>
              <div className="text-sm font-mono">
                {me?.displayName} · <span className={isAdmin ? 'text-accent font-bold' : 'text-ink-soft'}>{isAdmin ? '主理人' : '合伙人'}</span>
              </div>
              <button
                onClick={signOut}
                className="mt-2 text-[10px] tracking-[0.2em] uppercase text-ink-mute hover:text-accent transition-colors underline underline-offset-4"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <nav className="border-t border-ink bg-paper-2/40">
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex gap-0 overflow-x-auto">
              {TABS.map((t) => {
                const active = tab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={[
                      'group px-5 py-4 border-r border-rule text-left flex-shrink-0',
                      'min-w-[110px] transition-colors',
                      active ? 'bg-ink text-paper' : 'hover:bg-paper-2',
                    ].join(' ')}
                  >
                    <div className={[
                      'text-[9px] tracking-[0.3em] uppercase mb-1',
                      active ? 'text-paper/60' : 'text-ink-mute',
                    ].join(' ')}>
                      § {t.no} · {t.en} {(t as any).adminOnly && <span className="text-accent">★</span>}
                    </div>
                    <div className="font-serif text-lg">{t.label}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-10">
        {tab === 'overview' && <OverviewTab onJumpTab={(id) => setTab(id as TabId)} />}
        {tab === 'calendar' && <CalendarTab onJumpEval={jumpToEval} />}
        {tab === 'eval' && <EvaluationTab focusEntry={focusEntry} onConsumeFocus={() => setFocusEntry(null)} />}
        {tab === 'profit' && <ProfitBacktestTab onEvaluate={jumpToEval} />}
        {tab === 'alloc' && <AllocationTab />}
        {tab === 'holdings' && <HoldingsTab />}
        {tab === 'settle' && <SettlementTab />}
        {tab === 'review' && <ReviewTab />}
        {tab === 'partners' && <PartnersTab />}
        {tab === 'users' && isAdmin && <UsersTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>

      <footer className="border-t border-ink mt-20">
        <div className="max-w-7xl mx-auto px-8 py-6 flex justify-between text-[10px] tracking-[0.2em] uppercase text-ink-mute">
          <span>© 2026 The IPO Ledger · A Private Newsroom</span>
          <span className="italic normal-case tracking-normal">"Buy the rumor, sell the news." — Wall Street Adage</span>
        </div>
      </footer>
    </div>
  )
}
