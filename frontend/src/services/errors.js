// Pages read errors as `err.response.data.detail` (the old API shape), so every
// service throws errors in that shape.
export function apiError(detail, status = 400) {
  const err = new Error(detail)
  err.response = { status, data: { detail } }
  return err
}

const AUTH_MESSAGES = {
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/wrong-password': 'Invalid email or password.',
  'auth/user-not-found': 'Invalid email or password.',
  'auth/invalid-email': 'Please provide a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password must be at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/requires-recent-login': 'Please log in again before making this change.',
}

export function toApiError(err, fallback = 'Something went wrong.') {
  if (err?.response?.data?.detail) return err
  if (err?.code && AUTH_MESSAGES[err.code]) return apiError(AUTH_MESSAGES[err.code], 401)
  if (err?.code === 'permission-denied') return apiError('You do not have permission to do that.', 403)
  return apiError(err?.message || fallback, 500)
}
