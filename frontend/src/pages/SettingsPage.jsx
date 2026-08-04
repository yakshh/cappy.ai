import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { authService } from '../services'
import { useTheme } from '../context/ThemeContext'
import {
  User, Mail, Lock, Save, GraduationCap,
  Moon, Sun, Shield, CheckCircle,
  Eye, EyeOff, Palette, Info
} from 'lucide-react'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'profile',   icon: User,     label: 'Profile'            },
  { id: 'security',  icon: Shield,   label: 'Security'           },
  { id: 'prefs',     icon: Palette,  label: 'Appearance & Theme' },
  { id: 'about',     icon: Info,     label: 'About'              },
]

export default function SettingsPage() {
  const { user, updateUser } = useAuth()
  const { isDark, setIsDark, colorTheme, setColorTheme, colorThemes } = useTheme()
  const [tab, setTab] = useState('profile')

  // Profile state
  const [name, setName] = useState(user?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [field, setField] = useState(user?.field || '')
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.full_name || '')
      setEmail(user.email || '')
      setField(user.field || '')
    }
  }, [user])

  // Password state
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' })
  const [changingPwd, setChangingPwd] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSaveProfile = async () => {
    if (!name.trim()) { toast.error('Name cannot be empty.'); return }
    if (!email.trim()) { toast.error('Email address cannot be empty.'); return }
    setSavingProfile(true)
    try {
      const { data } = await authService.updateProfile({
        full_name: name.trim(),
        email: email.trim(),
        field: field.trim(),
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
            <div style={{ fontSize: 11, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.field || user?.email || 'Student'}
            </div>
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
                <Label><GraduationCap size={9} style={{ display: 'inline', marginRight: 5 }} />Field</Label>
                <input className="input" placeholder="e.g. Computer Engineering, Business, Medicine" value={field} onChange={(e) => setField(e.target.value)} />
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
            <h2 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>Password \& Authentication</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <Label><Lock size={9} style={{ display: 'inline', marginRight: 5 }} />Current Password</Label>
                <div style={{ position: 'relative' }}>
                  <input className="input" type={showPass ? 'text' : 'password'} value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} style={{ paddingRight: 38 }} />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <Label><Lock size={9} style={{ display: 'inline', marginRight: 5 }} />New Password</Label>
                <input className="input" type={showPass ? 'text' : 'password'} value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })} placeholder="Min 8 characters" />
              </div>
              <div>
                <Label><Lock size={9} style={{ display: 'inline', marginRight: 5 }} />Confirm New Password</Label>
                <input className="input" type={showPass ? 'text' : 'password'} value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} placeholder="Repeat new password" />
              </div>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 20, padding: '10px 20px' }} onClick={handleChangePassword} disabled={changingPwd}>
              {changingPwd ? 'Updating...' : <><Shield size={14} /> Update Password</>}
            </button>
          </div>
        )}

        {/* Preferences / Theme Tab */}
        {tab === 'prefs' && (
          <div className="card anim-in" style={{ padding: 24 }}>
            <h2 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>Appearance \& Theme</h2>
            
            {/* Mode Switch */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Theme Mode</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Toggle between dark and light appearance</div>
              </div>
              <div style={{ display: 'flex', gap: 6, background: 'var(--surface2)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
                <button
                  onClick={() => setIsDark(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 500,
                    background: isDark ? 'var(--surface)' : 'transparent',
                    color: isDark ? 'var(--accent)' : 'var(--text2)',
                    boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                  }}
                >
                  <Moon size={13} /> Dark
                </button>
                <button
                  onClick={() => setIsDark(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 500,
                    background: !isDark ? 'var(--surface)' : 'transparent',
                    color: !isDark ? 'var(--accent)' : 'var(--text2)',
                    boxShadow: !isDark ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                  }}
                >
                  <Sun size={13} /> Light
                </button>
              </div>
            </div>

            {/* Color Palette Grid */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Accent Palette</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>Choose a curated color theme for your workspace</div>
              <div className="theme-palette-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
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

        {/* About Tab */}
        {tab === 'about' && (
          <div className="card anim-in" style={{ padding: 26 }}>
            
            {/* Header Box */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 11,
                background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', flexShrink: 0,
                boxShadow: '0 4px 14px var(--accent-dim)'
              }}>
                <GraduationCap size={24} />
              </div>
              <div>
                <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
                  About
                </h2>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginTop: 3 }}>
                  Study Intelligence Platform
                </div>
              </div>
            </div>

            {/* Platform Description */}
            <p style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 24 }}>
              cappy.ai is an artificial intelligence platform designed to help students analyze course materials, accelerate revision, and master university examinations.
            </p>

            {/* Feature Cards Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              <div style={{
                padding: '16px 18px',
                borderRadius: 'var(--radius)',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                  Document Processing and Indexing
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                  Upload course PDFs and study guides up to 25MB. The system automatically extracts, indexes, and chunks text for fast retrieval.
                </div>
              </div>

              <div style={{
                padding: '16px 18px',
                borderRadius: 'var(--radius)',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                  RAG Grounded Intelligence
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                  Ask questions across your uploaded documents. Answers are generated directly from your uploaded materials with exact page citations.
                </div>
              </div>

              <div style={{
                padding: '16px 18px',
                borderRadius: 'var(--radius)',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                  Automated Summaries, Quizzes, and Flashcards
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                  Generate short, detailed, or bulleted notes, multiple-choice quizzes, and study flashcards directly from lecture content.
                </div>
              </div>

              <div style={{
                padding: '16px 18px',
                borderRadius: 'var(--radius)',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                  Exam Paper Synthesis and Step-by-Step Solutions
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
                  Create university-format sample question papers grounded in your syllabus, or upload existing question papers to generate step-by-step model solutions.
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  )
}
