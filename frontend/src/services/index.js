import api from './api'

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  getMe:    ()     => api.get('/users/me'),
  updateProfile: (data) => api.patch('/users/me', data),
  changePassword: (data) => api.post('/users/me/change-password', data),
}

export const documentService = {
  upload:  (formData, onProgress) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  }),
  list:    ()   => api.get('/documents/'),
  get:     (id) => api.get(`/documents/${id}`),
  delete:  (id) => api.delete(`/documents/${id}`),
  updateCategory: (id, category) => api.patch(`/documents/${id}/category`, { category }),
}

export const chatService = {
  sendMessage:     (data) => api.post('/chat/', data),
  getConversations: ()    => api.get('/chat/conversations'),
  getMessages:     (id)   => api.get(`/chat/conversations/${id}/messages`),
  deleteConversation: (id) => api.delete(`/chat/conversations/${id}`),
}

export const summaryService = {
  generate: (data) => api.post('/summary/', data),
}

export const quizService = {
  generate: (data) => api.post('/quiz/', data),
}

export const flashcardService = {
  generate: (data) => api.post('/flashcards/', data),
}

export const searchService = {
  search: (data) => api.post('/search/', data),
}

export const samplePaperService = {
  generate: (data) => api.post('/sample-paper/', data),
  solve:    (data) => api.post('/sample-paper/solve', data),
}

