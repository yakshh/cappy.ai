import { useState, useEffect, useRef, useCallback } from 'react'
import { chatService, documentService } from '../services'
import MarkdownRenderer from '../components/MarkdownRenderer'
import SourceCitationCard from '../components/SourceCitationCard'
import TypingIndicator from '../components/TypingIndicator'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  Send, MessageSquare, Plus, Trash2, GraduationCap,
  ChevronDown, FileText
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

function ConversationItem({ conv, isActive, onClick, onDelete }) {
  return (
    <div
      onClick={() => onClick(conv.id)}
      className={`group flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer
                  transition-all duration-200 text-sm
                  ${isActive ? 'bg-brand-500/20 text-white border border-brand-500/30'
                             : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
    >
      <MessageSquare size={14} className="flex-shrink-0" />
      <span className="flex-1 truncate">{conv.title}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(conv.id) }}
        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

function ChatMessage({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center flex-shrink-0 shadow-brand mt-0.5">
          <GraduationCap size={16} className="text-white" />
        </div>
      )}
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm
            ${isUser
              ? 'bg-brand-500 text-white rounded-br-md'
              : 'glass text-slate-200 rounded-bl-md'
            }`}
        >
          {isUser ? (
            <p>{msg.content}</p>
          ) : (
            <MarkdownRenderer content={msg.content} />
          )}
        </div>
        {!isUser && msg.sources?.length > 0 && (
          <SourceCitationCard sources={msg.sources} />
        )}
        {msg.created_at && (
          <span className="text-xs text-slate-600 px-1">
            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
          </span>
        )}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [documents, setDocuments] = useState([])
  const [selectedDocIds, setSelectedDocIds] = useState([])
  const [showDocFilter, setShowDocFilter] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  // Load conversations and documents on mount
  useEffect(() => {
    Promise.all([
      chatService.getConversations(),
      documentService.list(),
    ]).then(([convRes, docRes]) => {
      setConversations(convRes.data)
      setDocuments(docRes.data.filter((d) => d.status === 'ready'))
    }).catch(console.error)
      .finally(() => setLoadingConvs(false))
  }, [])

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConvId) return
    setLoadingMsgs(true)
    chatService.getMessages(activeConvId)
      .then(({ data }) => setMessages(data.messages))
      .catch(console.error)
      .finally(() => setLoadingMsgs(false))
  }, [activeConvId])

  useEffect(() => { scrollToBottom() }, [messages])

  const handleSend = async () => {
    const question = input.trim()
    if (!question || sending) return

    const userMsg = { id: Date.now(), role: 'user', content: question, created_at: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const { data } = await chatService.sendMessage({
        question,
        conversation_id: activeConvId,
        document_ids: selectedDocIds.length > 0 ? selectedDocIds : null,
      })

      if (!activeConvId) {
        setActiveConvId(data.conversation_id)
        // Refresh conversations list
        const convRes = await chatService.getConversations()
        setConversations(convRes.data)
      }

      setMessages((prev) => [
        ...prev,
        {
          id: data.message_id,
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
          created_at: new Date().toISOString(),
        },
      ])
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to get response.')
      setMessages((prev) => prev.slice(0, -1)) // remove optimistic message
    } finally {
      setSending(false)
    }
  }

  const handleNewChat = () => {
    setActiveConvId(null)
    setMessages([])
    setInput('')
  }

  const handleDeleteConversation = async (convId) => {
    try {
      await chatService.deleteConversation(convId)
      setConversations((prev) => prev.filter((c) => c.id !== convId))
      if (activeConvId === convId) handleNewChat()
    } catch {
      toast.error('Failed to delete conversation.')
    }
  }

  const toggleDocFilter = (docId) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    )
  }

  return (
    <div className="flex flex-1 h-screen overflow-hidden">
      {/* Conversations sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-white/5 bg-dark-900/50 flex flex-col">
        <div className="p-3 border-b border-white/5">
          <button
            onClick={handleNewChat}
            id="new-chat-btn"
            className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingConvs ? (
            <div className="flex justify-center pt-8">
              <LoadingSpinner size="sm" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-8 px-3">
              No conversations yet. Ask your first question!
            </p>
          ) : (
            conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === activeConvId}
                onClick={(id) => { setActiveConvId(id); setMessages([]) }}
                onDelete={handleDeleteConversation}
              />
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="px-6 py-3 border-b border-white/5 flex items-center gap-3">
          <GraduationCap size={18} className="text-brand-400" />
          <span className="text-sm font-medium text-white">cappy.ai Chat</span>
          <div className="flex-1" />

          {/* Document filter */}
          <div className="relative">
            <button
              onClick={() => setShowDocFilter(!showDocFilter)}
              id="doc-filter-btn"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass text-xs text-slate-400 hover:text-white transition-all"
            >
              <FileText size={13} />
              {selectedDocIds.length === 0 ? 'All documents' : `${selectedDocIds.length} selected`}
              <ChevronDown size={12} />
            </button>

            {showDocFilter && (
              <div className="absolute right-0 top-full mt-1 w-64 glass-darker p-2 z-20 space-y-1 shadow-glass animate-slide-up">
                <p className="text-xs text-slate-500 px-2 py-1">Filter by document:</p>
                {documents.length === 0 ? (
                  <p className="text-xs text-slate-600 px-2 py-2">No ready documents</p>
                ) : documents.map((doc) => (
                  <label key={doc.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDocIds.includes(doc.id)}
                      onChange={() => toggleDocFilter(doc.id)}
                      className="accent-brand-500"
                    />
                    <span className="text-xs text-slate-300 truncate">{doc.filename}</span>
                  </label>
                ))}
                {selectedDocIds.length > 0 && (
                  <button onClick={() => setSelectedDocIds([])} className="text-xs text-brand-400 px-2 py-1 hover:text-brand-300">
                    Clear filter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {loadingMsgs ? (
            <div className="flex justify-center pt-12">
              <LoadingSpinner size="md" text="Loading messages..." />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
              <div className="w-20 h-20 rounded-2xl bg-gradient-brand shadow-brand flex items-center justify-center mb-6 animate-float">
                <GraduationCap size={36} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Ask anything about your notes</h2>
              <p className="text-slate-400 text-sm max-w-sm">
                Upload your PDFs from the Dashboard, then ask questions. I'll answer only from your documents.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-2 w-full max-w-sm">
                {[
                  'Summarize the key concepts from my notes',
                  'What is the definition of photosynthesis?',
                  'Explain Newton\'s laws of motion',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-left px-4 py-2.5 rounded-xl glass text-sm text-slate-400 hover:text-white hover:border-brand-500/30 transition-all duration-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => <ChatMessage key={msg.id} msg={msg} />)
          )}

          {sending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center flex-shrink-0 shadow-brand">
                <GraduationCap size={16} className="text-white" />
              </div>
              <div className="glass rounded-2xl rounded-bl-md px-2 py-1">
                <TypingIndicator />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="px-6 pb-6 pt-3 border-t border-white/5">
          <div className="flex gap-3 items-end glass p-2 rounded-2xl">
            <textarea
              id="chat-input"
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 resize-none
                         focus:outline-none px-3 py-2 min-h-[44px] max-h-[120px]"
              placeholder="Ask a question about your study materials..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              rows={1}
            />
            <button
              id="chat-send-btn"
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-10 h-10 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-30
                         flex items-center justify-center flex-shrink-0 transition-all duration-200
                         active:scale-95 shadow-brand"
            >
              <Send size={16} className="text-white" />
            </button>
          </div>
          <p className="text-xs text-slate-600 text-center mt-2">
            Answers are grounded in your uploaded documents only
          </p>
        </div>
      </div>
    </div>
  )
}
