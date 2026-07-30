import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'

// Pages
import LoginPage     from './pages/LoginPage'
import RegisterPage  from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import SummaryPage   from './pages/SummaryPage'
import QuizPage      from './pages/QuizPage'
import SamplePaperPage from './pages/SamplePaperPage'
import SearchPage    from './pages/SearchPage'
import SettingsPage  from './pages/SettingsPage'

/** Layout wrapper — renders top navbar + main centered content */
function AppLayout() {
  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes with top navbar layout */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard"    element={<DashboardPage />} />
              <Route path="/summary"      element={<SummaryPage />} />
              <Route path="/quiz"         element={<QuizPage />} />
              <Route path="/sample-paper" element={<SamplePaperPage />} />
              <Route path="/flashcards"   element={<Navigate to="/quiz" replace />} />
              <Route path="/search"       element={<SearchPage />} />
              <Route path="/profile"      element={<Navigate to="/settings" replace />} />
              <Route path="/settings"     element={<SettingsPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>

        {/* Global toast notifications */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  )
}
