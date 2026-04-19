import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, FontSize } from '@tiptap/extension-text-style'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
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
  tokenPreviewResolver?: ((xpath: string) => string | null) | null
}

export interface RichTextEditorHandle {
  insertTokenAtCursor: (token: string) => void
  focusAtLastSelection: () => void
  captureCurrentSelection: () => void
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

function sanitizePastedHtml(html: string): string {
  const cleanedHtml = html
    .replace(/<!--\s*StartFragment\s*-->/gi, '')
    .replace(/<!--\s*EndFragment\s*-->/gi, '')

  const parser = new DOMParser()
  const document = parser.parseFromString(cleanedHtml, 'text/html')

  document.querySelectorAll('script, style, meta, link, iframe, object, embed').forEach((node) => {
    node.remove()
  })

  const sanitizeStyle = (styleValue: string) => {
    const allowed = new Set([
      'font-size',
      'font-weight',
      'font-style',
      'text-decoration',
      'text-align',
    ])

    return styleValue
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => {
        const [property] = part.split(':')
        return allowed.has((property || '').trim().toLowerCase())
      })
      .join('; ')
  }

  document.querySelectorAll<HTMLElement>('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const attributeName = attribute.name.toLowerCase()
      if (attributeName.startsWith('on')) {
        element.removeAttribute(attribute.name)
      }

      if (attributeName === 'style') {
        const safeStyle = sanitizeStyle(attribute.value)
        if (safeStyle) {
          element.setAttribute('style', safeStyle)
        } else {
          element.removeAttribute('style')
        }
      }
    })

    // Convert style-based formatting commonly found in PDF clipboard HTML
    // into semantic tags that TipTap preserves as marks.
    const weight = element.style.fontWeight
    if (weight && (weight === 'bold' || Number(weight) >= 600)) {
      const strong = document.createElement('strong')
      while (element.firstChild) strong.appendChild(element.firstChild)
      element.appendChild(strong)
      element.style.fontWeight = ''
    }

    if (element.style.fontStyle === 'italic') {
      const em = document.createElement('em')
      while (element.firstChild) em.appendChild(element.firstChild)
      element.appendChild(em)
      element.style.fontStyle = ''
    }

    if (element.style.textDecoration.toLowerCase().includes('underline')) {
      const u = document.createElement('u')
      while (element.firstChild) u.appendChild(element.firstChild)
      element.appendChild(u)
      element.style.textDecoration = element.style.textDecoration
        .replace(/underline/gi, '')
        .trim()
    }
  })

  return document.body.innerHTML
}

function textToHtmlPreservingBreaks(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n')
  const paragraphs = normalized.split('\n\n')

  return paragraphs
    .map((paragraph) => {
      const escaped = escapeHtml(paragraph)
      const withLineBreaks = escaped.replace(/\n/g, '<br>')
      return `<p>${withLineBreaks || '<br>'}</p>`
    })
    .join('')
}

const tokenPreviewPluginKey = new PluginKey<{ editingTokenFrom: number | null }>('token-preview-decoration')

function findTokenRangeInTextNode(text: string, editingFrom: number): { startOffset: number; endOffset: number } | null {
  const tokenRegex = /\{\{\s*([\s\S]+?)\s*\}\}(?!\})/g
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    const startOffset = match.index
    const endOffset = match.index + match[0].length
    if (editingFrom >= startOffset && editingFrom < endOffset) {
      return { startOffset, endOffset }
    }
  }

  return null
}

function findTokenRangeAtDocPosition(doc: any, position: number): { from: number; to: number } | null {
  const safePosition = Math.max(0, Math.min(position, doc.content.size))
  const $pos = doc.resolve(safePosition)
  const parentText = $pos.parent.textContent || ''
  const parentStart = $pos.start()
  const range = findTokenRangeInTextNode(parentText, safePosition - parentStart)
  if (!range) return null
  return {
    from: parentStart + range.startOffset,
    to: parentStart + range.endOffset,
  }
}

function extractXPathFromToken(tokenText: string): string | null {
  const match = tokenText.match(/^\{\{\s*([\s\S]+?)\s*\}\}$/)
  if (!match) return null
  return (match[1] || '').trim()
}

const TokenPreviewDecorationExtension = Extension.create<{
  getResolver: () => ((xpath: string) => string | null) | null
}>({
  name: 'tokenPreviewDecoration',

  addOptions() {
    return {
      getResolver: () => null,
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<{ editingTokenFrom: number | null }>({
        key: tokenPreviewPluginKey,

        state: {
          init: () => ({ editingTokenFrom: null }),
          apply: (tr, pluginState, _oldState, newState) => {
            let editingTokenFrom = pluginState.editingTokenFrom

            if (editingTokenFrom !== null) {
              const mapped = tr.mapping.mapResult(editingTokenFrom)
              editingTokenFrom = mapped.deleted ? null : mapped.pos
            }

            const meta = tr.getMeta(tokenPreviewPluginKey) as { editingTokenFrom?: number | null } | undefined
            if (meta && Object.prototype.hasOwnProperty.call(meta, 'editingTokenFrom')) {
              editingTokenFrom = meta.editingTokenFrom ?? null
            }

            if (editingTokenFrom !== null) {
              const tokenRange = findTokenRangeAtDocPosition(tr.doc, editingTokenFrom)
              if (!tokenRange) {
                editingTokenFrom = null
              } else {
                const selectionFrom = newState.selection.from
                const selectionTo = newState.selection.to
                const selectionInsideToken =
                  selectionFrom >= tokenRange.from &&
                  selectionTo <= tokenRange.to

                if (!selectionInsideToken) {
                  editingTokenFrom = null
                }
              }
            }

            return { editingTokenFrom }
          },
        },

        props: {
          handleDOMEvents: {
            blur: (view) => {
              const pluginState = tokenPreviewPluginKey.getState(view.state)
              if (pluginState?.editingTokenFrom === null) return false

              view.dispatch(
                view.state.tr.setMeta(tokenPreviewPluginKey, { editingTokenFrom: null })
              )
              return false
            },
            dblclick: (view, event) => {
              const rawTarget = event.target as EventTarget | null
              const targetElement =
                rawTarget instanceof HTMLElement
                  ? rawTarget
                  : rawTarget instanceof Node
                    ? rawTarget.parentElement
                    : null
              const badge = targetElement?.closest?.('[data-token-from][data-token-to]') as HTMLElement | null
              if (!badge) return false

              const from = Number(badge.dataset.tokenFrom)
              const to = Number(badge.dataset.tokenTo)
              if (!Number.isFinite(from) || !Number.isFinite(to)) return false

              event.preventDefault()
              event.stopPropagation()

              view.dispatch(
                view.state.tr
                  .setSelection(TextSelection.create(view.state.doc, from, to))
                  .setMeta(tokenPreviewPluginKey, { editingTokenFrom: from })
              )
              view.focus()
              return true
            },
          },
          handleDoubleClick: (view, pos, event) => {
            const resolver = this.options.getResolver()
            if (!resolver) return false

            const tokenRange = findTokenRangeAtDocPosition(view.state.doc, pos)
            if (!tokenRange) return false

            const tokenText = view.state.doc.textBetween(tokenRange.from, tokenRange.to, '', '')
            const xpath = extractXPathFromToken(tokenText)
            if (!xpath) return false

            const resolved = resolver(xpath)
            if (resolved === null) return false

            event.preventDefault()
            event.stopPropagation()

            view.dispatch(
              view.state.tr
                .setSelection(TextSelection.create(view.state.doc, tokenRange.from, tokenRange.to))
                .setMeta(tokenPreviewPluginKey, { editingTokenFrom: tokenRange.from })
            )
            view.focus()
            return true
          },
          decorations: (state) => {
            const resolver = this.options.getResolver()
            if (!resolver) return null

            const pluginState = tokenPreviewPluginKey.getState(state)
            const editingTokenFrom = pluginState?.editingTokenFrom ?? null
            const decorations: Decoration[] = []
            const tokenRegex = /\{\{\s*([\s\S]+?)\s*\}\}(?!\})/g

            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return

              tokenRegex.lastIndex = 0
              let match: RegExpExecArray | null
              while ((match = tokenRegex.exec(node.text)) !== null) {
                const from = pos + match.index
                const to = from + match[0].length

                if (editingTokenFrom !== null && editingTokenFrom >= from && editingTokenFrom < to) {
                  continue
                }

                const resolvedValue = resolver((match[1] || '').trim())
                if (resolvedValue === null) continue

                const displayValue = resolvedValue.trim() || '(vazio)'
                const tokenText = match[0]

                decorations.push(
                  Decoration.inline(from, to, {
                    style: 'display:none;',
                  })
                )

                decorations.push(
                  Decoration.widget(from, () => {
                    const activateTokenEditing = (event: MouseEvent) => {
                      event.preventDefault()
                      event.stopPropagation()
                      const { view } = this.editor
                      const selection = TextSelection.create(view.state.doc, from, to)
                      const transaction = view.state.tr
                        .setSelection(selection)
                        .setMeta(tokenPreviewPluginKey, { editingTokenFrom: from })
                      view.dispatch(transaction)
                      view.focus()
                    }

                    const badge = document.createElement('span')
                    badge.className = 'inline-block max-w-full cursor-pointer select-none rounded border bg-muted px-2 py-0.5 text-xs font-medium text-foreground align-middle whitespace-pre-wrap break-words'
                    badge.textContent = displayValue
                    badge.title = `${tokenText}\n${displayValue}`
                    badge.contentEditable = 'false'
                    badge.dataset.tokenFrom = String(from)
                    badge.dataset.tokenTo = String(to)
                    badge.style.whiteSpace = 'pre-line'
                    badge.style.display = 'inline-block'
                    badge.style.maxWidth = '100%'

                    badge.addEventListener('dblclick', (event) => {
                      activateTokenEditing(event)
                    })

                    badge.addEventListener('mousedown', (event) => {
                      if (event.detail === 2) {
                        activateTokenEditing(event)
                      }
                    })

                    badge.addEventListener('click', (event) => {
                      if (event.detail === 2) {
                        activateTokenEditing(event)
                      }
                    })

                    return badge
                  }, {
                    side: -1,
                  })
                )
              }
            })

            return decorations.length ? DecorationSet.create(state.doc, decorations) : null
          },
        },
      }),
    ]
  },
})

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { content, onChange, tokenPreviewResolver = null },
  ref
) {
  const lastSelectionRef = useRef({ from: 1, to: 1 })
  const tokenPreviewResolverRef = useRef<((xpath: string) => string | null) | null>(tokenPreviewResolver)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false }),
      Underline,
      TextStyle,
      FontSize,
      TextAlign.configure({ types: ['paragraph'] }),
      TokenPreviewDecorationExtension.configure({
        getResolver: () => tokenPreviewResolverRef.current,
      }),
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    onSelectionUpdate({ editor }) {
      lastSelectionRef.current = {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      }
    },
    editorProps: {
      transformPastedHTML(html) {
        return sanitizePastedHtml(html)
      },
      handlePaste(_view, event) {
        const clipboard = event.clipboardData
        if (!clipboard) return false

        const html = clipboard.getData('text/html')
        if (html && /<[a-z][\s\S]*>/i.test(html)) {
          const safeHtml = sanitizePastedHtml(html)
          editor?.chain().focus().insertContent(safeHtml).run()
          return true
        }

        const text = clipboard.getData('text/plain')
        if (!text) return false

        const safeHtmlFromText = textToHtmlPreservingBreaks(text)
        editor?.chain().focus().insertContent(safeHtmlFromText).run()
        return true
      },
      attributes: {
        class: 'outline-none min-h-[180px] p-3 text-sm h-auto',
      },
    },
  })

  useEffect(() => {
    tokenPreviewResolverRef.current = tokenPreviewResolver
    if (!editor) return
    editor.view.dispatch(editor.state.tr.setMeta(tokenPreviewPluginKey, { editingTokenFrom: null }))
  }, [editor, tokenPreviewResolver])

  // Sync external content changes (e.g. when editing a different template)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  }, [content]) // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    insertTokenAtCursor(token: string) {
      if (!editor) return
      editor.chain().focus().insertContent(token).run()
    },
    focusAtLastSelection() {
      if (!editor) return

      const docSize = editor.state.doc.content.size
      const from = Math.max(1, Math.min(lastSelectionRef.current.from, docSize))
      const to = Math.max(1, Math.min(lastSelectionRef.current.to, docSize))

      editor.chain().focus().setTextSelection({ from, to }).run()
    },
    captureCurrentSelection() {
      if (!editor) return
      lastSelectionRef.current = {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      }
    },
  }), [editor])

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
})

export default RichTextEditor
