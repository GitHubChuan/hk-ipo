import { useStore, useCurrentUser, useIsAdmin } from '@/lib/store'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'

export default function App() {
  const me = useCurrentUser()
  if (!me) return <LoginPage />
  return <DashboardPage />
}

export { useIsAdmin, useStore }
