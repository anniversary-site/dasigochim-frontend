import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useCallback, useEffect } from 'react'
import { authApi, meApi, tokenStore } from './api'
import type { AuthResult } from './api'
import type { PrincipalType } from './api/http'
import { AuthContext } from './auth'
import type { User } from './types'
import LoginPage from './pages/Login/LoginPage'
import ReportFlowPage from './pages/Report/ReportFlowPage'
import HomePage from './pages/Home/HomePage'
import ProfileSetupPage from './pages/Profile/ProfileSetupPage'
import UserPageGuard from './pages/UserPageGuard'
import AdminGuard from './pages/Admin/AdminGuard'
import AdminDashboardPage from './pages/Admin/AdminDashboardPage'
import AdminReportDetailPage from './pages/Admin/AdminReportDetailPage'

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(tokenStore.getAccess()))
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [principalType, setPrincipalType] = useState<PrincipalType | null>(() => tokenStore.getPrincipalType())

  const logout = useCallback(() => {
    authApi.logout()
    setUser(null)
    setPrincipalType(null)
    setIsLoggedIn(false)
  }, [])

  const loadProfile = useCallback(async () => {
    const profile = await meApi.getProfile()
    setUser(profile)
    setIsLoggedIn(true)
    return profile
  }, [])

  const completeLogin = useCallback(async (result: AuthResult) => {
    setPrincipalType(result.principalType)
    if (result.principalType === "USER") await loadProfile()
    else setIsLoggedIn(true)
    return result.principalType
  }, [loadProfile])

  const guestLogin = useCallback(
    async (role: PrincipalType, code: string) => completeLogin(await authApi.guestLogin(role, code)),
    [completeLogin]
  )

  useEffect(() => {
    const initialize = async () => {
      if (!tokenStore.getAccess()) {
        setIsAuthLoading(false)
        return
      }
      try {
        const type = tokenStore.getPrincipalType()
        setPrincipalType(type)
        if (type === "ADMIN") setIsLoggedIn(true)
        else await loadProfile()
      } catch {
        logout()
      } finally {
        setIsAuthLoading(false)
      }
    }
    void initialize()
  }, [loadProfile, logout])

  useEffect(() => {
    const handleUnauthorized = () => logout()
    window.addEventListener('dasigochim:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('dasigochim:unauthorized', handleUnauthorized)
  }, [logout])

  return (
    <AuthContext.Provider value={{ isLoggedIn, isAuthLoading, user, principalType, guestLogin, refreshProfile: loadProfile, logout }}>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<UserPageGuard><HomePage /></UserPageGuard>} />
        {/* 예전 지도·내 신고 주소로 들어와도 메인으로 보낸다 */}
        <Route path="/map" element={<Navigate to="/home" replace />} />
        <Route path="/report" element={<UserPageGuard><ReportFlowPage /></UserPageGuard>} />
        <Route path="/my-reports" element={<Navigate to="/home" replace />} />
        <Route path="/profile" element={<UserPageGuard><ProfileSetupPage /></UserPageGuard>} />
        <Route path="/admin" element={<AdminGuard><AdminDashboardPage /></AdminGuard>} />
        <Route path="/admin/reports/:id" element={<AdminGuard><AdminReportDetailPage /></AdminGuard>} />
      </Routes>
    </AuthContext.Provider>
  )
}
