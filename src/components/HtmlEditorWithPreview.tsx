import { useEffect, useRef, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface HtmlEditorWithPreviewProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

export default function HtmlEditorWithPreview({
  value,
  onChange,
  placeholder = '<p>...</p>',
  rows = 8,
  className,
}: HtmlEditorWithPreviewProps) {
  const [tab, setTab] = useState<'editor' | 'preview'>('editor')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (tab === 'preview' && iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) {
        doc.open()
        doc.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<style>
  body { font-family: system-ui, sans-serif; font-size: 14px; padding: 12px 16px; margin: 0; color: #1a1a1a; }
  * { box-sizing: border-box; }
</style>
</head><body>${value || '<p style="color:#aaa">Nenhum conteúdo</p>'}</body></html>`)
        doc.close()
      }
    }
  }, [tab, value])

  const lineCount = Math.max(rows, (value.match(/\n/g)?.length ?? 0) + 1)

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as 'editor' | 'preview')} className={cn('w-full', className)}>
      <TabsList className="h-8">
        <TabsTrigger value="editor" className="text-xs px-3 h-6">HTML</TabsTrigger>
        <TabsTrigger value="preview" className="text-xs px-3 h-6">Preview</TabsTrigger>
      </TabsList>

      <TabsContent value="editor" className="mt-1">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={lineCount}
          spellCheck={false}
          className={cn(
            'w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2',
            'font-mono text-xs leading-relaxed text-foreground shadow-sm',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'resize-y placeholder:text-muted-foreground',
          )}
        />
      </TabsContent>

      <TabsContent value="preview" className="mt-1">
        <div className="min-h-[120px] rounded-md border border-input overflow-hidden bg-white">
          <iframe
            ref={iframeRef}
            title="preview"
            sandbox="allow-same-origin"
            className="w-full border-0"
            style={{ minHeight: `${lineCount * 20}px`, height: 'auto' }}
            scrolling="no"
            onLoad={() => {
              // auto-height
              const iframe = iframeRef.current
              if (iframe?.contentDocument?.body) {
                iframe.style.height = iframe.contentDocument.body.scrollHeight + 'px'
              }
            }}
          />
        </div>
      </TabsContent>
    </Tabs>
  )
}
