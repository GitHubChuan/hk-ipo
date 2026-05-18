import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setLoading(true)

    // 提供一个本地模拟测试账号，方便在未配置真实 Supabase 时查看控制台 UI
    if (email === 'test@kuaishou.com' && password === '123456') {
      setUser({ email: 'test@kuaishou.com', id: 'mock-user' })
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setAuthError(error.message)
      }
    } catch (err: any) {
      setAuthError('网络错误或尚未配置真实的数据库凭证，请使用测试账号登录')
    }
    
    setLoading(false)
  }

  const handleLogout = async () => {
    if (user?.id === 'mock-user') {
      setUser(null)
      return
    }
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-[#1D2129] font-sans selection:bg-blue-500/30">
      <nav className="fixed top-0 w-full z-50 px-6 py-4 flex justify-between items-center bg-white border-b border-[#E5E6EB] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-lg">HK</span>
          </div>
          <p className="font-semibold text-xl text-[#1D2129] tracking-tight">港股打新工作台</p>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium">
          <a href="#dashboard" className="text-[#4E5969] hover:text-blue-600 transition-colors">数据看板</a>
          <a href="#services" className="text-[#4E5969] hover:text-blue-600 transition-colors">标的评估</a>
          <a href="#ledger" className="text-[#4E5969] hover:text-blue-600 transition-colors">财务流转</a>
          {user ? (
            <div className="flex items-center gap-4 ml-4">
              <span className="text-[#4E5969] bg-[#F2F3F5] px-3 py-1.5 rounded-full">{user.email}</span>
              <button onClick={handleLogout} className="px-4 py-1.5 text-[#4E5969] hover:bg-[#F2F3F5] rounded transition-colors">
                退出
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-[#86909C] text-xs">内部系统，需授权访问</span>
            </div>
          )}
        </div>
      </nav>

      {!user ? (
        <main className="pt-32 pb-20 px-6 max-w-4xl mx-auto min-h-[80vh] flex flex-col justify-center">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-[#1D2129] mb-4 tracking-tight">
              港股打新合伙人协作网络
            </h1>
            <p className="text-lg text-[#4E5969] max-w-2xl mx-auto">
              连接合伙人资金与打新策略，通过算法统筹资金流动，使利润最大化。
            </p>
          </div>

          <div className="max-w-md mx-auto w-full bg-white p-8 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-[#E5E6EB]">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="mb-6 text-xs text-[#4E5969] bg-[#F2F3F5] p-3 rounded-lg border border-[#E5E6EB]">
                <p className="font-medium mb-1">测试演示账号：</p>
                <p>邮箱：test@kuaishou.com</p>
                <p>密码：123456</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1D2129] mb-1.5">合伙人邮箱</label>
                <input
                  type="email"
                  placeholder="请输入邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-4 bg-white border border-[#E5E6EB] rounded-lg text-[#1D2129] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1D2129] mb-1.5">访问密码</label>
                <input
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 px-4 bg-white border border-[#E5E6EB] rounded-lg text-[#1D2129] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  required
                />
              </div>
              {authError && <p className="text-red-500 text-sm">{authError}</p>}
              <button 
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors mt-2 flex items-center justify-center gap-2"
              >
                {loading ? '验证中...' : '登录控制台'}
              </button>
            </form>
          </div>
        </main>
      ) : (
        <main className="pt-28 pb-20 px-6 max-w-6xl mx-auto space-y-12">
          {/* Dashboard 面板 */}
          <div id="dashboard">
            <h2 className="text-2xl font-bold text-[#1D2129] mb-6">资产全局看板</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-[#E5E6EB] p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[#4E5969] text-sm font-medium mb-2">团队总资产</p>
                <h3 className="text-3xl font-bold text-[#1D2129] mb-2">HK$ 1.25M</h3>
                <p className="text-xs text-[#86909C] flex items-center gap-1">
                  <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium">+12.4k</span> 今日变动
                </p>
              </div>
              <div className="bg-white border border-[#E5E6EB] p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[#4E5969] text-sm font-medium mb-2">累计收益率</p>
                <h3 className="text-3xl font-bold text-red-500 mb-2">+24.5%</h3>
                <p className="text-xs text-[#86909C]">跑赢恒指 18.2%</p>
              </div>
              <div className="bg-white border border-[#E5E6EB] p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <p className="text-[#4E5969] text-sm font-medium mb-2">个人本金分红 (模拟)</p>
                <h3 className="text-3xl font-bold text-[#1D2129] mb-2">HK$ 342.5k</h3>
                <p className="text-xs text-[#86909C]">
                  <span className="text-blue-600">已提现 HK$ 50k</span>
                </p>
              </div>
            </div>
          </div>

          {/* 标的评估与策略分配 */}
          <div id="services">
            <div className="border-b border-[#E5E6EB] pb-3 mb-6">
              <h2 className="text-2xl font-bold text-[#1D2129]">打新标的评估与调度</h2>
            </div>
            
            <div className="space-y-4">
              {/* 卡片 1 */}
              <div className="bg-white border border-blue-200 shadow-sm p-6 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex gap-2 mb-2">
                      <span className="px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-xs font-bold">强烈申购</span>
                      <span className="px-2.5 py-0.5 bg-[#F2F3F5] text-[#4E5969] rounded text-xs">医疗健康</span>
                    </div>
                    <h3 className="text-xl font-bold text-[#1D2129]">剂泰科技</h3>
                    <p className="text-[#86909C] text-sm mt-1">单账户赚钱期望：HK$ 4,500</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#1D2129]">HK$ 10.50</p>
                    <p className="text-[#86909C] text-xs mt-1">发行价</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 border-t border-[#E5E6EB]">
                  <div>
                    <p className="text-[#86909C] text-xs mb-1">AI 质检评分</p>
                    <p className="text-[#1D2129] font-medium">9.2 / 10</p>
                  </div>
                  <div>
                    <p className="text-[#86909C] text-xs mb-1">孖展倍数</p>
                    <p className="text-[#1D2129] font-medium">超购 145 倍</p>
                  </div>
                  <div>
                    <p className="text-[#86909C] text-xs mb-1">核心策略</p>
                    <p className="text-blue-600 font-medium">顶格打满 + 红鞋铺设</p>
                  </div>
                </div>

                <div className="mt-2 bg-[#F7F8FA] p-4 rounded-lg border border-[#E5E6EB]">
                  <p className="text-[#1D2129] text-sm font-semibold mb-3">资金分配执行建议</p>
                  <ul className="space-y-2">
                    <li className="flex justify-between items-center text-sm"><span className="text-[#4E5969]">A账户 - 富途证券</span><span className="text-[#1D2129] font-medium">10倍融资 (100手)</span></li>
                    <li className="flex justify-between items-center text-sm"><span className="text-[#4E5969]">B账户 - 盈立证券</span><span className="text-[#1D2129] font-medium">现金 (1手) - 红鞋套利</span></li>
                    <li className="flex justify-between items-center text-sm"><span className="text-[#4E5969]">C账户 - 华盛证券</span><span className="text-[#1D2129] font-medium">10倍融资 (50手)</span></li>
                  </ul>
                </div>
              </div>

              {/* 卡片 2 */}
              <div className="bg-white border border-[#E5E6EB] p-6 rounded-xl hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex gap-2 mb-2">
                      <span className="px-2.5 py-0.5 bg-orange-50 text-orange-600 border border-orange-100 rounded text-xs font-bold">适当申购</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#1D2129]">英派药业</h3>
                    <p className="text-[#86909C] text-sm mt-1">单账户赚钱期望：HK$ 800</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-[#1D2129]">HK$ 19.75</p>
                    <p className="text-[#86909C] text-xs mt-1">招股价区间底</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 财务与分润结算模块 */}
          <div id="ledger">
            <div className="border-b border-[#E5E6EB] pb-3 mb-6">
              <h2 className="text-2xl font-bold text-[#1D2129]">财务流转与利润清算</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 左侧：待结算 */}
              <div className="bg-white border border-[#E5E6EB] p-6 rounded-xl shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-[#1D2129]">待结算账单</h3>
                  <span className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded">主理人模式</span>
                </div>
                
                <div className="space-y-6">
                  <div className="pb-5 border-b border-[#E5E6EB]">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[#1D2129] font-medium">茶百道 (02555.HK) 结算</p>
                      <p className="text-red-500 font-bold">+ HK$ 12,450</p>
                    </div>
                    <div className="text-sm text-[#4E5969] space-y-1.5 mt-3">
                      <p className="flex justify-between"><span>卖出总额:</span> <span className="text-[#1D2129]">HK$ 85,000</span></p>
                      <p className="flex justify-between"><span>本金与交易税费:</span> <span className="text-[#1D2129]">- HK$ 71,200</span></p>
                      <p className="flex justify-between"><span>主理人兜底融资手续费:</span> <span className="text-[#1D2129]">- HK$ 1,350</span></p>
                    </div>
                    <div className="mt-4">
                      <button className="w-full text-sm bg-blue-50 text-blue-600 border border-blue-100 py-2 rounded-lg font-medium hover:bg-blue-100 transition-colors">确认账单并按比例分润</button>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[#1D2129] font-medium">老铺黄金 (06866.HK) 结算</p>
                      <p className="text-green-600 font-bold">- HK$ 4,200</p>
                    </div>
                    <div className="text-sm text-[#4E5969] space-y-1.5 mt-3">
                      <p className="flex justify-between"><span>破发止损:</span> <span className="text-[#1D2129]">触及 -15% 阈值</span></p>
                      <p className="flex justify-between"><span>主理人承担亏损与费用:</span> <span className="text-[#1D2129]">- HK$ 4,200</span></p>
                    </div>
                    <div className="mt-4">
                      <button className="w-full text-sm bg-gray-50 text-gray-600 border border-gray-200 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors">录入亏损复盘</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 右侧：流水与监控 */}
              <div className="bg-white border border-[#E5E6EB] p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-bold text-[#1D2129] mb-6">行情监控与执行流水</h3>
                <div className="relative border-l-2 border-[#E5E6EB] ml-3 space-y-8">
                  
                  <div className="relative pl-6">
                    <div className="absolute w-3 h-3 bg-red-500 rounded-full -left-[7px] top-1.5 ring-4 ring-red-50"></div>
                    <p className="text-xs text-[#86909C] mb-1">今日 16:15 · 卖出提醒</p>
                    <p className="text-[#1D2129] font-medium text-sm mb-1">剂泰科技 暗盘触发卖出规则</p>
                    <p className="text-sm text-[#4E5969]">暗盘涨幅达 28.5% (超 20% 阈值)，建议立即通过 API 或手动出一半利润锁仓。</p>
                  </div>
                  
                  <div className="relative pl-6">
                    <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1.5 ring-4 ring-blue-50"></div>
                    <p className="text-xs text-[#86909C] mb-1">昨日 09:30 · 资金调度</p>
                    <p className="text-[#1D2129] font-medium text-sm mb-1">富途账户完成 10x 融资申购</p>
                    <p className="text-sm text-[#4E5969]">已使用本金 50k HKD，撬动 500k HKD 额度申购 100 手剂泰科技。</p>
                  </div>

                  <div className="relative pl-6">
                    <div className="absolute w-3 h-3 bg-gray-300 rounded-full -left-[7px] top-1.5"></div>
                    <p className="text-xs text-[#86909C] mb-1">本周一 14:00 · 资金录入</p>
                    <p className="text-[#1D2129] font-medium text-sm mb-1">合伙人 B 新增可用头寸</p>
                    <p className="text-sm text-[#4E5969]">盈立证券账户转入现金 HK$ 100,000，系统已重新计算红鞋套利分配水位。</p>
                  </div>

                </div>
                
                <div className="mt-8 pt-4 border-t border-[#E5E6EB]">
                  <button className="w-full text-sm text-blue-600 font-medium py-2 border border-dashed border-blue-300 bg-blue-50/50 rounded-lg hover:bg-blue-50 transition-colors">
                    + 手动录入新流水
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      <footer className="bg-white border-t border-[#E5E6EB] py-8 text-center text-[#86909C] text-sm">
        <p>© 2026 港股打新工作台. Private Partner Network.</p>
      </footer>
    </div>
  )
}