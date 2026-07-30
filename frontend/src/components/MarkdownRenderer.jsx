import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * MarkdownRenderer — renders AI response text as styled markdown.
 */
export default function MarkdownRenderer({ content }) {
  return (
    <div className="prose-dark">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
