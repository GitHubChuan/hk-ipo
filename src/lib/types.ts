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
  // —— 招股结构（参考 i668.vip/stocks）
  mechanism?: 'B' | '18C' | 'A' | 'SPAC' | 'GEM' | 'OTHER' // 机制类型：机制B / 18C 等
  issueLots?: number     // 发行手数（公开发售的总手数）
  issueAmount?: number   // 募集资金（HKD 万元）
  entryFeeMid?: number   // 中位入场费（HKD）— 来自 i668
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
  // 暗盘数据（同步自 CalendarTab）
  darkPrice?: number
  darkChangePct?: number
  darkFetchedAt?: number
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

// 历史招股回测记录（评估申购手数/中签率/暗盘/首日涨幅，参考 i668.vip/subscription & /profit）
export type HistoricalIpo = {
  code: string
  name: string
  listingDate: string  // YYYY-MM-DD
  mechanism?: 'B' | '18C' | 'A' | 'SPAC' | 'GEM' | 'OTHER'
  priceLow?: number
  priceHigh?: number
  issuePrice?: number  // 最终发行价
  lotSize: number
  entryFee?: number
  // 申购统计
  issueLots?: number          // 发行手数
  issueAmount?: number        // 募集资金（万 HKD）
  subscriptionMultiple?: number  // 申购倍数（公开发售超购）
  subscriptionAmount?: number    // 申购资金（亿 HKD）
  applicants?: number         // 申购人数
  winners?: number            // 中签人数
  intlAllocMultiple?: number  // 国配倍数
  // 收益
  darkChangePct?: number      // 暗盘涨跌幅 %
  firstDayChangePct?: number  // 首日涨跌幅 %
  profitPerLot?: number       // 每手盈利（HKD）
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
