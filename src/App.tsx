import React from 'react'
import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red' }}>
          <h2>Something went wrong.</h2>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
import Layout from './components/Layout'
import LoginPage from './pages/Login'
import TodayPage from './pages/Today'
import CalendarPage from './pages/Calendar'
import TasksPage from './pages/Tasks'
import ShoppingPage from './pages/Shopping'
import MorePage from './pages/More'
import RewardsPage from './pages/Rewards'
import ChatPage from './pages/Chat'

function AppShell({ children }: { children: JSX.Element }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AppShell><TodayPage /></AppShell>} />
        <Route path="/calendar" element={<AppShell><CalendarPage /></AppShell>} />
        <Route path="/tasks" element={<AppShell><TasksPage /></AppShell>} />
        <Route path="/shopping" element={<AppShell><ShoppingPage /></AppShell>} />
        <Route path="/more" element={<AppShell><MorePage /></AppShell>} />
        <Route path="/rewards" element={<AppShell><RewardsPage /></AppShell>} />
        <Route path="/chat" element={<AppShell><ChatPage /></AppShell>} />
        <Route path="*" element={<AppShell><TodayPage /></AppShell>} />
      </Routes>
    </ErrorBoundary>
  )
}
