import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { authService } from '../services'
import { useTheme } from '../context/ThemeContext'
import {
  User, Mail, Lock, Save, GraduationCap,
  Moon, Sun, Bell, Shield, CheckCircle,
  Eye, EyeOff, Palette
} from 'lucide-react'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'profile',   icon: User,     label: 'Profile'            },
  { id: 'security',  icon: Shield,   label: 'Security'           },
  { id: 'prefs',     icon: Bell,     label: 'Appearance & Theme' },
  { id: 'notifications', icon: Bell, label: 'Notifications' },
]

export default function SettingsPage() {
  const { user, updateUser } = useAuth()
  const { isDark, setIsDark, colorTheme, setColorTheme, colorThemes } = useTheme()
  const [tab, setTab] = useState('profile')

  // Profile state
  const [name, setName] = useState(user?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [major, setMajor] = useState('Computer Science & Engineering')
  const [savingProfile, setSavingProfile] = useState(false)

  // Password state
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' })
  const [changingPwd, setChangingPwd] = useState(false)
  const [showPass, setShowPass] = useState(false)

  // Notification settings are local UI preferences; no secrets are displayed.
  const [docNotifications, setDocNotifications] = useState(localStorage.getItem('pref-doc-notifications') !== 'false')
  const [autoRefresh, setAutoRefresh] = useState(localStorage.getItem('pref-auto-refresh') !== 'false')
  const [weeklyDigest, setWeeklyDigest] = useState(localStorage.getItem('pref-weekly-digest') === 'true')

  const handleSaveProfile = async () => {
    if (!name.trim()) { toast.error('Name cannot be empty.'); return }
    if (!email.trim()) { toast.error('Email address cannot be empty.'); return }
    setSavingProfile(true)
    try {
      const { data } = await authService.updateProfile({
        full_name: name.trim(),
        email: email.trim(),
      })
      updateUser(data)
      toast.success('Profile details saved successfully!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.new) { toast.error('Please enter current and new passwords.'); return }
    if (passwords.new.length < 8) { toast.error('New password must be at least 8 characters long.'); return }
    if (passwords.new !== passwords.confirm) { toast.error('New password and confirmation do not match.'); return }
    setChangingPwd(true)
    try {
      await authService.changePassword({ current_password: passwords.current, new_password: passwords.new })
      toast.success('Security password updated!')
      setPasswords({ current: '', new: '', confirm: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Password update failed.')
    } finally {
      setChangingPwd(false)
    }
  }

  const handleSaveNotifications = () => {
    localStorage.setItem('pref-doc-notifications', String(docNotifications))
    localStorage.setItem('pref-auto-refresh', String(autoRefresh))
    localStorage.setItem('pref-weekly-digest', String(weeklyDigest))
    toast.success('Notification settings updated successfully!')
  }

  const Label = ({ children }) => (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 6 }}>
      {children}
    </label>
  )

  return (
    <div className="anim-in settings-layout" style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 20, alignItems: 'start' }}>

      {/* ── Tab Navigation ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

        {/* User Card */}
        <div className="card" style={{ padding: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14, flexShrink: 0
          }}>
            {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.full_name || 'User'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{user?.email || 'Student'}</div>
          </div>
        </div>

        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, textAlign: 'left', transition: 'all 0.12s',
              background: tab === t.id ? 'var(--accent-dim)' : 'transparent',
              color: tab === t.id ? 'var(--accent)' : 'var(--text2)',
            }}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div>

        {/* Profile Tab */}
        {tab === 'profile' && (
          <div className="card anim-in" style={{ padding: 24 }}>
            <h2 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>Personal Profile</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <Label><User size={9} style={{ display: 'inline', marginRight: 5 }} />Full Name</Label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label><Mail size={9} style={{ display: 'inline', marginRight: 5 }} />Email Address</Label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label><GraduationCap size={9} style={{ display: 'inline', marginRight: 5 }} />Major / Department</Label>
                <input className="input" value={major} onChange={(e) => setMajor(e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 20, padding: '10px 20px' }} onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? 'Saving...' : <><Save size={14} /> Save Profile</>}
            </button>
          </div>
        )}

        {/* Security Tab */}
        {tab === 'security' && (
          <div className="card anim-in" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Security & Password</h2>
              <span className="tag tag-green"><Shield size={10} /> Password Protected</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <Label>Current Password</Label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={passwords.current}
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>New Password</Label>
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                />
              </div>
              <div>
                <Label>Confirm New Password</Label>
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
              <button className="btn btn-primary" onClick={handleChangePassword} disabled={changingPwd}>
                <Shield size={14} /> {changingPwd ? 'Updating...' : 'Update Password'}
              </button>
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {showPass ? <EyeOff size={13} /> : <Eye size={13} />} {showPass ? 'Hide Passwords' : 'Show Passwords'}
              </button>
            </div>
          </div>
        )}

        {/* Preferences / Theme Tab */}
        {tab === 'prefs' && (
          <div className="card anim-in" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Appearance & Theme</h2>
                <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>Choose a mode and a color palette for your study space.</p>
              </div>
              <Palette size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
              {[
                { id: 'dark',  icon: Moon, label: 'Dark Mode',  desc: 'Low light, easy on the eyes', bg: '#0D0C0C', surface: '#141212', textCol: '#EDE9E9' },
                { id: 'light', icon: Sun,  label: 'Light Mode', desc: 'Bright linen workspace',       bg: '#F5F3F0', surface: '#FDFCFB', textCol: '#1E1A1A' },
              ].map((theme) => {
                const active = (theme.id === 'dark') === isDark
                return (
                  <button
                    key={theme.id}
                    onClick={() => setIsDark(theme.id === 'dark')}
                    style={{
                      padding: 16, borderRadius: 10, cursor: 'pointer', border: `2px solid`,
                      borderColor: active ? 'var(--accent)' : 'var(--border)',
                      background: theme.bg, textAlign: 'left', position: 'relative', transition: 'border-color 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <theme.icon size={15} style={{ color: theme.textCol }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: theme.textCol, fontFamily: 'Space Grotesk' }}>{theme.label}</span>
                    </div>
                    <p style={{ fontSize: 11, color: theme.textCol, opacity: 0.7, margin: 0 }}>{theme.desc}</p>
                    {active && (
                      <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justify: 'center' }}>
                        <CheckCircle size={12} color="#fff" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <h3 className="font-display" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Color palette</h3>
                  <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>Preview and switch the accent style instantly.</p>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{isDark ? 'Dark' : 'Light'} palette</span>
              </div>
              <div className="theme-palette-grid">
                {colorThemes.map((theme) => {
                  const active = theme.id === colorTheme
                  const paletteClass = `theme-preview theme-preview-${theme.id}`
                  return (
                    <button
                      key={theme.id}
                      className={paletteClass}
                      onClick={() => setColorTheme(theme.id)}
                      aria-pressed={active}
                      style={{ borderColor: active ? 'var(--accent)' : 'var(--border)' }}
                    >
                      <span className="theme-preview-swatch" style={{ background: theme.accent }} />
                      <span className="theme-preview-copy">
                        <span className="theme-preview-name">{theme.name}</span>
                        <span className="theme-preview-description">{theme.description}</span>
                      </span>
                      <span className="theme-preview-bars" aria-hidden="true">
                        <i style={{ background: theme.accent }} />
                        <i style={{ background: theme.accentHi, width: '62%' }} />
                        <i style={{ background: 'var(--border2)', width: '78%' }} />
                      </span>
                      {active && <CheckCircle className="theme-preview-check" size={14} />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {tab === 'notifications' && (
          <div className="card anim-in" style={{ padding: 24 }}>
            <h2 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Notification Settings</h2>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 18 }}>Control helpful app updates. API keys and private credentials are never shown here.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                ['Document Processing Toasts', 'Show alerts when uploaded PDFs finish indexing.', docNotifications, setDocNotifications],
                ['Dashboard Auto-refresh', 'Refresh document status automatically while you work.', autoRefresh, setAutoRefresh],
                ['Weekly Learning Summary', 'Keep a local preference for a weekly progress reminder.', weeklyDigest, setWeeklyDigest],
              ].map(([label, description, enabled, setter]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{description}</div>
                  </div>
                  <button type="button" onClick={() => setter(!enabled)} className={`toggle ${enabled ? 'on' : ''}`} aria-label={`Toggle ${label}`} />
                </div>
              ))}
            </div>

            <button className="btn btn-primary" style={{ marginTop: 20, padding: '10px 20px' }} onClick={handleSaveNotifications}>
              <Save size={14} /> Save Notification Settings
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
