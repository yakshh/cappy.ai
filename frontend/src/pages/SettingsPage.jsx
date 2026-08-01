import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { authService } from '../services'
import { useTheme } from '../context/ThemeContext'
import {
  User, Mail, Save, GraduationCap,
  Moon, Sun, Shield, CheckCircle,
  Eye, EyeOff, Palette, Info,
  Sparkles, BookOpen, Search, FileText,
  Layers, ShieldCheck, Cpu
} from 'lucide-react'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'profile',  icon: User,     label: 'Profile'            },
  { id: 'security', icon: Shield,   label: 'Security'           },
  { id: 'prefs',    icon: Palette,  label: 'Appearance & Theme' },
  { id: 'about',    icon: Info,     label: 'About cappy.ai'     },
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

        {/* About cappy.ai Tab */}
        {tab === 'about' && (
          <div className="card anim-in" style={{ padding: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12, background: 'var(--accent-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)'
              }}>
                <GraduationCap size={24} />
              </div>
              <div>
                <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                  About cappy.ai
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text2)', margin: 0, marginTop: 2 }}>
                  Your RAG-Powered AI Study Intelligence Platform
                </p>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 20 }}>
              <strong style={{ color: 'var(--text)' }}>cappy.ai</strong> is an advanced AI learning assistant designed specifically for university students. By uploading your course PDFs, textbook units, and lecture notes, cappy.ai indexes your materials using Retrieval-Augmented Generation (RAG) to provide grounded answers, exam paper generation, and model solutions without hallucinations.
            </p>

            {/* Feature Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>

              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  <Sparkles size={16} /> GTU Exam Paper Generator
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text2)', margin: 0, lineHeight: 1.5 }}>
                  Generates realistic 70-mark university question papers (Q1–Q5 with 3m, 4m, and 7m sections and OR choices) grounded strictly in your study notes.
                </p>
              </div>

              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  <BookOpen size={16} /> Exam Paper Solver
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text2)', margin: 0, lineHeight: 1.5 }}>
                  Upload official question papers to receive comprehensive model solutions. Output length scales according to marks (up to 500+ words for 7-mark questions).
                </p>
              </div>

              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  <Search size={16} /> Deep Search & Retrieval
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text2)', margin: 0, lineHeight: 1.5 }}>
                  Search across all your uploaded course materials with semantic and keyword matching, pinpointing exact pages and source text snippets.
                </p>
              </div>

              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                  <Layers size={16} /> Summaries, Quizzes & Flashcards
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text2)', margin: 0, lineHeight: 1.5 }}>
                  Instantly transform long PDFs into short or detailed summaries, interactive multiple-choice quizzes, and study flashcards.
                </p>
              </div>

            </div>

            {/* Tech & Security Footnote */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Cpu size={12} /> Powered by Groq LPU & Llama 3.3 70B
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <ShieldCheck size={12} /> PostgreSQL & Neon Secured
              </span>
              <span>Version 1.1.0</span>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
