import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, Sparkles, GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.password) e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    const result = await login(form.email, form.password)
    if (result.success) {
      toast.success('Welcome back to cappy.ai!')
      navigate(from, { replace: true })
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="anim-in" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        
        {/* Brand Monogram & Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, position: 'relative', margin: '0 auto 16px', flexShrink: 0
          }}>
            <div style={{
              position: 'absolute', inset: 0, background: 'var(--accent)', borderRadius: 12,
              transform: 'rotate(8deg)', opacity: 0.35
            }} />
            <div style={{
              position: 'absolute', inset: 3, background: 'var(--accent)', borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <GraduationCap size={22} style={{ color: '#fff' }} />
            </div>
          </div>
          <h1 className="font-display" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
            Sign in to cappy.ai study intelligence
          </p>
        </div>

        {/* Card Form */}
        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
            
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 6 }}>
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                className="input"
                placeholder="you@university.edu"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                autoComplete="email"
              />
              {errors.email && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{errors.email}</p>}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  className="input"
                  style={{ paddingRight: 38 }}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.password && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{errors.password}</p>}
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '11px 16px', marginTop: 4 }}
            >
              {loading ? 'Signing in...' : <><Sparkles size={14} /> Sign In</>}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)', marginTop: 20, marginBottom: 0 }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Create one
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
