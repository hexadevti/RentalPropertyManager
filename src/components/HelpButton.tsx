import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Question } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface HelpButtonProps {
  content: string
  title?: string
}

export function HelpButton({ content, title = 'Ajuda' }: HelpButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="Ajuda"
        type="button"
      >
        <Question size={17} weight="duotone" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-4xl flex-col overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <Question size={18} weight="duotone" className="text-primary" />
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="mb-4 mt-2 text-xl font-bold text-foreground">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-3 mt-5 text-base font-bold text-foreground border-b pb-1">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-2 mt-4 text-sm font-semibold text-foreground">{children}</h3>,
                p: ({ children }) => <p className="mb-3 text-sm leading-relaxed text-foreground/90">{children}</p>,
                ul: ({ children }) => <ul className="mb-3 ml-4 space-y-1 list-disc text-sm text-foreground/90">{children}</ul>,
                ol: ({ children }) => <ol className="mb-3 ml-4 space-y-1 list-decimal text-sm text-foreground/90">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                code: ({ children }) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</code>,
                blockquote: ({ children }) => (
                  <blockquote className="mb-3 border-l-4 border-primary/40 bg-primary/5 pl-4 pr-3 py-2 rounded-r-lg text-sm text-muted-foreground italic">
                    {children}
                  </blockquote>
                ),
                hr: () => <hr className="my-4 border-border" />,
                table: ({ children }) => (
                  <div className="mb-4 overflow-x-auto rounded-lg border border-border">
                    <table className="w-full border-collapse text-sm">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-muted/70">{children}</thead>,
                tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
                tr: ({ children }) => <tr className="hover:bg-muted/30 transition-colors">{children}</tr>,
                th: ({ children }) => <th className="border-b border-border px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground">{children}</th>,
                td: ({ children }) => <td className="px-4 py-2.5 text-sm text-foreground/80">{children}</td>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
