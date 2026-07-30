export default function LoadingSpinner({ size = 'md', text = null }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-[3px]',
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`${sizes[size]} rounded-full border-brand-500/30 border-t-brand-500 animate-spin`}
      />
      {text && <p className="text-sm text-slate-400 animate-pulse">{text}</p>}
    </div>
  )
}
