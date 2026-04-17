import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, FontSize } from '@tiptap/extension-text-style'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  TextB,
  TextItalic,
  TextUnderline,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  TextAlignJustify,
} from '@phosphor-icons/react'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
}

/** Convert legacy plain-text template content to HTML for TipTap */
export function plainTextToHTML(text: string): string {
  if (/<[a-z][\s\S]*>/i.test(text)) return text // already HTML
  return text
    .split('\n')
    .map((line) => `<p>${line === '' ? '<br>' : escapeHtml(line)}</p>`)
    .join('')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export default function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Underline,
      TextStyle,
      FontSize,
      TextAlign.configure({ types: ['paragraph'] }),
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[420px] p-3 text-sm',
      },
    },
  })

  // Sync external content changes (e.g. when editing a different template)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  }, [content]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null

  const currentFontSize = editor.getAttributes('textStyle').fontSize || ''

  const ToolbarButton = ({
    active,
    onClick,
    children,
  }: {
    active?: boolean
    onClick: () => void
    children: React.ReactNode
  }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={`h-7 w-7 flex items-center justify-center rounded text-sm transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-muted text-foreground'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="border rounded-md overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/40">
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <TextB size={14} weight="bold" />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <TextItalic size={14} />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <TextUnderline size={14} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Font size */}
        <Select
          value={currentFontSize}
          onValueChange={(v) =>
            v === 'default'
              ? editor.chain().focus().unsetFontSize().run()
              : (editor.chain().focus() as any).setFontSize(v).run()
          }
        >
          <SelectTrigger className="h-7 w-[72px] text-xs px-2">
            <SelectValue placeholder="Tam." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Padrão</SelectItem>
            <SelectItem value="8pt">8pt</SelectItem>
            <SelectItem value="9pt">9pt</SelectItem>
            <SelectItem value="10pt">10pt</SelectItem>
            <SelectItem value="11pt">11pt</SelectItem>
            <SelectItem value="12pt">12pt</SelectItem>
            <SelectItem value="14pt">14pt</SelectItem>
            <SelectItem value="16pt">16pt</SelectItem>
            <SelectItem value="18pt">18pt</SelectItem>
            <SelectItem value="20pt">20pt</SelectItem>
            <SelectItem value="24pt">24pt</SelectItem>
            <SelectItem value="28pt">28pt</SelectItem>
            <SelectItem value="32pt">32pt</SelectItem>
          </SelectContent>
        </Select>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Alignment */}
        <ToolbarButton
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <TextAlignLeft size={14} />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <TextAlignCenter size={14} />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <TextAlignRight size={14} />
        </ToolbarButton>

        <ToolbarButton
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        >
          <TextAlignJustify size={14} />
        </ToolbarButton>
      </div>

      {/* Editor content area */}
      <div className="overflow-y-auto max-h-[500px] bg-background">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
