// Zustand Store + LocalStorage 持久化 — 含权限系统

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AppState,
  Ipo,
  Partner,
  Sale,
  Settlement,
  Subscription,
  User,
  UserRole,
} from './types'

type Actions = {
  // ——— 鉴权 ———
  currentUserId?: string
  signIn: (username: string, password: string) => { ok: boolean; message?: string }
  signOut: () => void
  changeMyPassword: (oldPwd: string, newPwd: string) => { ok: boolean; message?: string }

  // ——— Users ———
  addUser: (u: { username: string; password: string; role: UserRole; displayName: string; partnerId?: string }) => { ok: boolean; message?: string }
  updateUser: (id: string, patch: Partial<User> & { password?: string }) => void
  removeUser: (id: string) => void

  // ——— Partners ———
  addPartner: (p: Omit<Partner, 'id' | 'joinedAt'>) => string
  updatePartner: (id: string, patch: Partial<Partner>) => void
  removePartner: (id: string) => void

  // ——— IPO ———
  addIpo: (ipo: Omit<Ipo, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateIpo: (id: string, patch: Partial<Ipo>) => void
  removeIpo: (id: string) => void

  // ——— 申购 ———
  addSubscription: (s: Omit<Subscription, 'id' | 'createdAt'>) => void
  updateSubscription: (id: string, patch: Partial<Subscription>) => void
  removeSubscription: (id: string) => void

  // ——— 卖出 ———
  addSale: (s: Omit<Sale, 'id'>) => void
  removeSale: (id: string) => void

  // ——— 结算 ———
  addSettlement: (s: Omit<Settlement, 'id' | 'settledAt'>) => void
  removeSettlement: (id: string) => void

  // ——— 全局配置 ———
  updateConfig: (patch: Partial<AppState['config']>) => void
  resetAll: () => void
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

function simpleHash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return (h >>> 0).toString(36)
}

const initial: AppState = {
  users: [
    {
      id: 'u_admin',
      username: 'admin',
      passwordHash: simpleHash('hkipo2026'),
      role: 'admin',
      displayName: '主理人 (我)',
      createdAt: Date.now(),
    },
  ],
  partners: [
    {
      id: 'p_owner',
      name: '主理人 (我)',
      color: '#B83A2B',
      capital: 500000,
      shareRatio: 0.4,
      joinedAt: Date.now(),
      note: '兜底所有融资手续费',
      ownerUserId: 'u_admin',
    },
  ],
  ipos: [],
  subscriptions: [],
  sales: [],
  settlements: [],
  config: {
    mainPartnerId: 'p_owner',
    defaultMarginRate: 6.8,
    defaultMarginDays: 6,
    defaultRedShoeBoost: 1.4,
    teamCapital: 1500000,
    corsProxy: 'https://corsproxy.io/?',
    autoRefreshQuote: true,
  },
}

export const useStore = create<AppState & Actions>()(
  persist(
    (set, get) => ({
      ...initial,
      currentUserId: undefined,

      signIn: (username, password) => {
        const u = get().users.find((x) => x.username === username)
        if (!u) return { ok: false, message: '用户不存在' }
        if (u.passwordHash !== simpleHash(password)) return { ok: false, message: '密码错误' }
        set({ currentUserId: u.id })
        get().updateUser(u.id, { lastLoginAt: Date.now() })
        return { ok: true }
      },
      signOut: () => set({ currentUserId: undefined }),
      changeMyPassword: (oldPwd, newPwd) => {
        const me = get().users.find((u) => u.id === get().currentUserId)
        if (!me) return { ok: false, message: '请先登录' }
        if (me.passwordHash !== simpleHash(oldPwd)) return { ok: false, message: '旧密码不正确' }
        if (newPwd.length < 6) return { ok: false, message: '新密码至少 6 位' }
        get().updateUser(me.id, { passwordHash: simpleHash(newPwd) } as any)
        return { ok: true }
      },

      addUser: ({ username, password, role, displayName, partnerId }) => {
        if (!username || !password) return { ok: false, message: '账号/密码不能为空' }
        if (get().users.some((u) => u.username === username)) return { ok: false, message: '账号已存在' }
        if (password.length < 6) return { ok: false, message: '密码至少 6 位' }
        const u: User = {
          id: uid(),
          username,
          passwordHash: simpleHash(password),
          role,
          partnerId,
          displayName,
          createdAt: Date.now(),
        }
        set((s) => ({ users: [...s.users, u] }))
        return { ok: true }
      },
      updateUser: (id, patch) =>
        set((s) => ({
          users: s.users.map((u) =>
            u.id === id
              ? {
                  ...u,
                  ...patch,
                  passwordHash: (patch as any).password
                    ? simpleHash((patch as any).password)
                    : (patch.passwordHash ?? u.passwordHash),
                }
              : u,
          ),
        })),
      removeUser: (id) => {
        if (id === 'u_admin') return alert('内置管理员账号不能删除')
        set((s) => ({ users: s.users.filter((u) => u.id !== id) }))
      },

      addPartner: (p) => {
        const id = uid()
        set((s) => ({
          partners: [...s.partners, { ...p, id, joinedAt: Date.now() }],
        }))
        return id
      },
      updatePartner: (id, patch) =>
        set((s) => ({
          partners: s.partners.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      removePartner: (id) =>
        set((s) => ({ partners: s.partners.filter((p) => p.id !== id) })),

      addIpo: (ipo) => {
        const id = uid()
        const me = get().currentUserId
        set((s) => ({
          ipos: [
            ...s.ipos,
            {
              ...ipo,
              id,
              createdByUserId: ipo.createdByUserId ?? me,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
        }))
        return id
      },
      updateIpo: (id, patch) =>
        set((s) => ({
          ipos: s.ipos.map((i) =>
            i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i,
          ),
        })),
      removeIpo: (id) =>
        set((s) => ({ ipos: s.ipos.filter((i) => i.id !== id) })),

      addSubscription: (sub) => {
        const me = get().currentUserId
        set((s) => ({
          subscriptions: [
            ...s.subscriptions,
            { ...sub, ownerUserId: sub.ownerUserId ?? me, id: uid(), createdAt: Date.now() },
          ],
        }))
      },
      updateSubscription: (id, patch) =>
        set((s) => ({
          subscriptions: s.subscriptions.map((x) =>
            x.id === id ? { ...x, ...patch } : x,
          ),
        })),
      removeSubscription: (id) =>
        set((s) => ({
          subscriptions: s.subscriptions.filter((x) => x.id !== id),
        })),

      addSale: (sale) => {
        const me = get().currentUserId
        set((s) => ({ sales: [...s.sales, { ...sale, ownerUserId: sale.ownerUserId ?? me, id: uid() }] }))
      },
      removeSale: (id) =>
        set((s) => ({ sales: s.sales.filter((x) => x.id !== id) })),

      addSettlement: (st) =>
        set((s) => ({
          settlements: [
            ...s.settlements,
            { ...st, id: uid(), settledAt: Date.now() },
          ],
        })),
      removeSettlement: (id) =>
        set((s) => ({
          settlements: s.settlements.filter((x) => x.id !== id),
        })),

      updateConfig: (patch) =>
        set((s) => ({ config: { ...s.config, ...patch } })),

      resetAll: () =>
        set({
          ...initial,
          currentUserId: get().currentUserId,
          users: get().users, // 保留账号
        }),
    }),
    {
      name: 'hk-ipo-store-v2',
      version: 2,
      partialize: (s) => ({
        users: s.users,
        partners: s.partners,
        ipos: s.ipos,
        subscriptions: s.subscriptions,
        sales: s.sales,
        settlements: s.settlements,
        config: s.config,
      }),
    },
  ),
)

// ——— 选择器 ———
export function useCurrentUser(): User | undefined {
  return useStore((s) => s.users.find((u) => u.id === s.currentUserId))
}

export function useIsAdmin(): boolean {
  const u = useCurrentUser()
  return u?.role === 'admin'
}

// 按当前用户角色过滤数据视图
export function useScopedData() {
  const me = useCurrentUser()
  const all = useStore()
  if (!me) return { ipos: [], partners: [], subscriptions: [], sales: [], settlements: [] }
  if (me.role === 'admin')
    return {
      ipos: all.ipos,
      partners: all.partners,
      subscriptions: all.subscriptions,
      sales: all.sales,
      settlements: all.settlements,
    }
  // partner 视图：只看自己绑定的 partner 相关
  const myPartnerIds = new Set([me.partnerId, ...all.partners.filter((p) => p.ownerUserId === me.id).map((p) => p.id)].filter(Boolean) as string[])
  const myIpoIds = new Set(
    all.ipos.filter((i) => i.createdByUserId === me.id).map((i) => i.id),
  )
  // 把"自己有申购的 IPO"也纳入视野，便于看到自己持仓
  all.subscriptions.forEach((s) => {
    if (myPartnerIds.has(s.partnerId) || s.ownerUserId === me.id) myIpoIds.add(s.ipoId)
  })

  return {
    ipos: all.ipos.filter((i) => myIpoIds.has(i.id) || i.createdByUserId === me.id),
    partners: all.partners.filter((p) => myPartnerIds.has(p.id)),
    subscriptions: all.subscriptions.filter((s) => myPartnerIds.has(s.partnerId) || s.ownerUserId === me.id),
    sales: all.sales.filter((s) => myPartnerIds.has(s.partnerId) || s.ownerUserId === me.id),
    settlements: all.settlements.filter((st) => myIpoIds.has(st.ipoId)),
  }
}
