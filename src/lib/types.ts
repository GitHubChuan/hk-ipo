// 港股打新管理系统 — 数据类型定义

export type UserRole = 'admin' | 'partner'

export type User = {
  id: string
  username: string
  passwordHash: string
  role: UserRole
  partnerId?: string // 当 role=partner 时绑定到具体合伙人
  displayName: string
  createdAt: number
  lastLoginAt?: number
}

export type Partner = {
  id: string
  name: string
  color: string
  capital: number
  shareRatio: number
  joinedAt: number
  note?: string
  // 数据归属：哪些 user 创建的（用于 partner 视图过滤）
  ownerUserId?: string
}

export type IpoStatus =
  | 'watching'
  | 'evaluating'
  | 'decided_go'
  | 'decided_skip'
  | 'subscribed'
  | 'listed'
  | 'closed'

export type Ipo = {
  id: string
  code: string
  name: string
  industry?: string
  priceLow: number
  priceHigh: number
  lotSize: number
  entryFee: number
  subscriptionStart?: string
  subscriptionEnd?: string
  listingDate?: string
  aiQualityScore?: number
  expectedRise?: number
  oversubMultiple?: number
  redShoeBoost?: number
  status: IpoStatus
  decision?: 'go' | 'skip'
  decisionReason?: string
  notes?: string
  actualOversubMultiple?: number
  listingOpenPrice?: number
  exitPrice?: number
  exitDate?: string
  // 实时行情（自动拉取）
  liveQuote?: {
    price: number
    changePct: number
    fetchedAt: number
  }
  createdAt: number
  updatedAt: number
  createdByUserId?: string
}

export type Subscription = {
  id: string
  ipoId: string
  partnerId: string
  account: string
  mode: 'cash' | 'margin'
  lotsApplied: number
  marginMultiplier?: number
  marginRate?: number
  marginDays?: number
  marginCost?: number
  lotsAllocated?: number
  feeCoveredByMain?: boolean
  createdAt: number
  ownerUserId?: string
}

export type Sale = {
  id: string
  ipoId: string
  partnerId: string
  lots: number
  price: number
  fee?: number
  soldAt: string
  note?: string
  ownerUserId?: string
}

export type Settlement = {
  id: string
  ipoId: string
  totalProfit: number
  mainPartnerCoverage: number
  distributions: Array<{
    partnerId: string
    amount: number
    ratio: number
  }>
  settledAt: number
  note?: string
}

export type AppState = {
  users: User[]
  partners: Partner[]
  ipos: Ipo[]
  subscriptions: Subscription[]
  sales: Sale[]
  settlements: Settlement[]
  config: {
    mainPartnerId?: string
    defaultMarginRate: number
    defaultMarginDays: number
    defaultRedShoeBoost: number
    teamCapital: number
    // 市场数据
    corsProxy: string
    autoRefreshQuote: boolean
  }
}
