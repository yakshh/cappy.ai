import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, BookText, Zap, ScrollText, Search, Settings, Sun, Moon, LogOut, GraduationCap } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Overview'     },
  { to: '/summary',      icon: BookText,         label: 'Summaries'   },
  { to: '/quiz',         icon: Zap,              label: 'Quiz & Cards'},
  { to: '/sample-paper', icon: ScrollText,       label: 'Exam Papers' },
  { to: '/search',       icon: Search,           label: 'Deep Search' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const { isDark, toggle } = useTheme()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const firstName = user?.full_name?.split(' ')[0] || 'User'
  const avatarChar = firstName.charAt(0).toUpperCase()

  return (
    <header className="app-header">

      {/* Left: Brand Logo & Title */}
      <NavLink to="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34,
          borderRadius: 10,
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(201, 81, 74, 0.3)',
          flexShrink: 0,
        }}>
          <GraduationCap size={19} style={{ color: '#fff' }} />
        </div>

        <div className="app-brand-copy">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16, color: 'var(--text)', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
              cappy<span style={{ color: 'var(--accent)' }}>.ai</span>
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 500, letterSpacing: '0.04em' }}>
            Study Intelligence
          </div>
        </div>
      </NavLink>

      {/* Center: Top Navigation Row */}
      <nav className="app-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || (to !== '/dashboard' && pathname.startsWith(to))
          return (
            <NavLink key={to} to={to} style={{ textDecoration: 'none' }}>
              <div className={`nav-top-item ${active ? 'active' : ''}`}>
                <Icon size={14} className="icon" />
                <span className="app-nav-label">{label}</span>
              </div>
            </NavLink>
          )
        })}
      </nav>

      {/* Right: Actions & User Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        
        {/* Settings Button */}
        <NavLink to="/settings" style={{ textDecoration: 'none' }}>
          <button className="btn-icon" title="Settings" style={{ color: pathname === '/settings' ? 'var(--accent)' : 'var(--text2)' }}>
            <Settings size={15} />
          </button>
        </NavLink>

        {/* Theme Toggle */}
        <button
          className="btn-icon"
          onClick={toggle}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          style={{ color: isDark ? 'var(--amber)' : 'var(--accent)' }}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Logout Button */}
        <button
          className="btn-icon"
          onClick={handleLogout}
          title="Sign out"
          style={{ color: 'var(--text3)' }}
        >
          <LogOut size={15} />
        </button>

        {/* Divider line */}
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />

        {/* User Profile */}
        <NavLink to="/settings" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12,
              }}>{avatarChar}</div>
              <div style={{
                position: 'absolute', bottom: -1, right: -1,
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--green)',
                border: '1.5px solid var(--surface)',
              }} />
            </div>
            <div className="app-user-copy" style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.1 }}>{firstName}</span>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>{user?.email?.split('@')[0] || 'Active'}</span>
            </div>
          </div>
        </NavLink>

      </div>

    </header>
  )
}
