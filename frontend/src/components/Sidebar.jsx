import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, MessageSquare, FileText, Zap,
  BookOpen, CreditCard, Search, User, Settings,
  LogOut, GraduationCap, ChevronLeft, ChevronRight, FileSpreadsheet
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard'            },
  { to: '/summary',      icon: FileText,        label: 'Summary'              },
  { to: '/quiz',         icon: Zap,             label: 'Quiz & Flashcards'    },
  { to: '/sample-paper', icon: FileSpreadsheet, label: 'Papers & Solutions'   },
  { to: '/search',       icon: Search,          label: 'Semantic Search'      },
]

const bottomItems = [
  { to: '/settings', icon: Settings, label: 'Profile & Settings' },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className={`relative flex flex-col h-screen bg-dark-900/80 backdrop-blur-xl border-r border-white/5 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
        <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center flex-shrink-0 shadow-brand">
          <GraduationCap size={18} className="text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-sm text-white truncate">
            cappy<span className="text-brand-400">.ai</span>
          </span>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-dark-800 border border-white/10
                   flex items-center justify-center text-slate-400 hover:text-white
                   transition-all duration-200 z-10 hover:bg-brand-500/20"
        id="sidebar-toggle"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            id={`nav-${label.toLowerCase().replace(' ', '-')}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
               transition-all duration-200 cursor-pointer
               ${isActive
                 ? 'text-white bg-brand-500/20 border border-brand-500/30'
                 : 'text-slate-400 hover:text-white hover:bg-white/5'
               }
               ${collapsed ? 'justify-center' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: profile + settings + logout */}
      <div className="px-2 py-3 border-t border-white/5 space-y-1">
        {bottomItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
               transition-all duration-200 cursor-pointer
               ${isActive
                 ? 'text-white bg-brand-500/20 border border-brand-500/30'
                 : 'text-slate-400 hover:text-white hover:bg-white/5'
               }
               ${collapsed ? 'justify-center' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {/* User info + logout */}
        <div className={`flex items-center gap-3 px-3 py-2.5 mt-2 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleLogout}
              id="logout-btn"
              className="text-slate-500 hover:text-rose-400 transition-colors duration-200"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full px-3 py-2.5 rounded-xl text-slate-500 hover:text-rose-400 transition-colors duration-200"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  )
}
