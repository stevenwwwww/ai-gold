import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireAuth, RequireAdmin } from '@/components/AuthGuard'
import MainLayout from '@/layouts/MainLayout'
import LoginPage from '@/pages/login'
import DashboardPage from '@/pages/dashboard'
import ReportsPage from '@/pages/reports'
import ReportDetailPage from '@/pages/reports/detail'
import SearchPage from '@/pages/search'
import UsersPage from '@/pages/users'
import PasswordPage from '@/pages/password'
import KnowledgePage from '@/pages/knowledge'
import KnowledgeSearchPage from '@/pages/knowledge/search'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={
        <RequireAuth>
          <MainLayout />
        </RequireAuth>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/:id" element={<ReportDetailPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="knowledge" element={<KnowledgePage />} />
        <Route path="knowledge/search" element={<KnowledgeSearchPage />} />
        <Route path="password" element={<PasswordPage />} />
        <Route path="users" element={
          <RequireAdmin><UsersPage /></RequireAdmin>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
