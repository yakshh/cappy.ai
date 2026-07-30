import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, UserPlus, GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const { register, loading } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    if (!form.email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    const result = await register(form.fullName, form.email, form.password)
    if (result.success) {
      toast.success('Account created! Welcome to cappy.ai')
      navigate('/dashboard', { replace: true })
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="anim-in" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        
        {/* Brand Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
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
            Create an Account
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
            Start studying smarter with cappy.ai
          </p>
        </div>

        {/* Card Form */}
        <div className="card" style={{ padding: 26 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
            
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 5 }}>
                Full Name
              </label>
              <input
                id="register-fullName"
                type="text"
                className="input"
                placeholder="Your full name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
              {errors.fullName && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{errors.fullName}</p>}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 5 }}>
                Email Address
              </label>
              <input
                id="register-email"
                type="email"
                className="input"
                placeholder="you@university.edu"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              {errors.email && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{errors.email}</p>}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 5 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="register-password"
                  type={showPass ? 'text' : 'password'}
                  className="input"
                  style={{ paddingRight: 38 }}
                  placeholder="Min 8 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.password && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{errors.password}</p>}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 5 }}>
                Confirm Password
              </label>
              <input
                id="register-confirmPassword"
                type={showPass ? 'text' : 'password'}
                className="input"
                placeholder="Repeat password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              />
              {errors.confirmPassword && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>{errors.confirmPassword}</p>}
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '11px 16px', marginTop: 4 }}
            >
              {loading ? 'Creating account...' : <><UserPlus size={14} /> Create Account</>}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)', marginTop: 18, marginBottom: 0 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
