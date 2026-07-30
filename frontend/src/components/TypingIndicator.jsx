/**
 * TypingIndicator — animated "..." dots shown while AI is generating.
 */
export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="typing-dot" style={{ animationDelay: '0ms' }} />
      <div className="typing-dot" style={{ animationDelay: '150ms' }} />
      <div className="typing-dot" style={{ animationDelay: '300ms' }} />
    </div>
  )
}
