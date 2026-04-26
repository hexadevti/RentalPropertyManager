import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Brain, PaperPlaneTilt, Sparkle, Trash, WarningCircle } from '@phosphor-icons/react'

import { HelpButton } from '@/components/HelpButton'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getEdgeFunctionErrorFromInvokeError, getEdgeFunctionErrorFromPayload, getEdgeFunctionAnswerFromPayload, getEdgeFunctionMessage } from '@/lib/edgeFunctionMessages'
import { useLanguage } from '@/lib/LanguageContext'
import { supabase } from '@/lib/supabase'

type AssistantMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type AssistantResponse = {
  answer?: string
  answerKey?: string
  answerParams?: Record<string, string | number>
  error?: string
  errorKey?: string
  errorParams?: Record<string, string | number>
  details?: unknown
  model?: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    costUsd: number
    iterations?: number
  }
}

type ModelOption = {
  value: string
  label: string
  description: string
}

// Module-level state — survives component unmount/remount during tab navigation
let _messages: AssistantMessage[] = []
let _selectedModel = 'claude-sonnet-4-6'
let _lastUsage: AssistantResponse['usage'] | null = null
let _lastModelUsed = ''

function formatUsdCost(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return '$0.000000'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }).format(value)
}

export default function AiAssistantView() {
  const { t } = useLanguage()
  const suggestions = useMemo(() => ([
    t.ai_assistant_view.suggestions.s1,
    t.ai_assistant_view.suggestions.s2,
    t.ai_assistant_view.suggestions.s3,
    t.ai_assistant_view.suggestions.s4,
  ]), [t])
  const modelOptions: ModelOption[] = useMemo(() => ([
    {
      value: 'claude-sonnet-4-6',
      label: t.ai_assistant_view.models.sonnet_label,
      description: t.ai_assistant_view.models.sonnet_description,
    },
    {
      value: 'claude-haiku-4-5-20251001',
      label: t.ai_assistant_view.models.haiku_label,
      description: t.ai_assistant_view.models.haiku_description,
    },
    {
      value: 'claude-opus-4-7',
      label: t.ai_assistant_view.models.opus_label,
      description: t.ai_assistant_view.models.opus_description,
    },
  ]), [t])
  const [messages, setMessages] = useState<AssistantMessage[]>(_messages)
  const [question, setQuestion] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [selectedModel, setSelectedModel] = useState(_selectedModel)
  const [lastUsage, setLastUsage] = useState<AssistantResponse['usage'] | null>(_lastUsage)
  const [lastModelUsed, setLastModelUsed] = useState(_lastModelUsed)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)

  // Sync module-level vars so they survive unmount
  const updateMessages = (fn: (prev: AssistantMessage[]) => AssistantMessage[]) => {
    setMessages((prev) => {
      const next = fn(prev)
      _messages = next
      return next
    })
  }

  // Scroll only inside the chat container, without moving the whole page.
  useEffect(() => {
    const container = chatScrollRef.current
    if (!container) return

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, isSending])

  const visibleHistory = useMemo(() => (
    messages.slice(-8).map((m) => ({ role: m.role, content: m.content }))
  ), [messages])

  const askAssistant = async (text?: string) => {
    const trimmed = (text ?? question).trim()
    if (!trimmed || isSending) return

    updateMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', content: trimmed }])
    setQuestion('')
    setIsSending(true)

    try {
      const { data, error } = await supabase.functions.invoke<AssistantResponse>('ai-assistant', {
        body: { question: trimmed, history: visibleHistory, model: selectedModel },
      })

      if (error) throw await getEdgeFunctionErrorFromInvokeError(error, t.ai_assistant_view.consult_error)
      const responseError = getEdgeFunctionErrorFromPayload(data, t.ai_assistant_view.consult_error)
      if (responseError) throw responseError

      const answer = getEdgeFunctionAnswerFromPayload(data, t, t.ai_assistant_view.no_answer)
      setLastUsage(data?.usage || null)
      _lastUsage = data?.usage || null
      setLastModelUsed(data?.model || selectedModel)
      _lastModelUsed = data?.model || selectedModel
      updateMessages((prev) => [...prev, { id: `assistant-${Date.now()}`, role: 'assistant', content: answer }])
    } catch (error: any) {
      const msg = getEdgeFunctionMessage(error, t, t.ai_assistant_view.consult_error)
      toast.error(msg)
      updateMessages((prev) => [...prev, {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: `${t.ai_assistant_view.cannot_answer_now}\n\n${t.ai_assistant_view.technical_detail_prefix} ${msg}`,
      }])
    } finally {
      setIsSending(false)
      window.setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      // Ctrl+Enter → insert line break at cursor
      event.preventDefault()
      const el = event.currentTarget
      const pos = el.selectionStart ?? question.length
      setQuestion((q) => q.slice(0, pos) + '\n' + q.slice(pos))
      window.setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = pos + 1
          textareaRef.current.selectionEnd = pos + 1
        }
      }, 0)
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      // Enter → send
      event.preventDefault()
      void askAssistant()
    }
  }

  const handleClear = () => {
    _messages = []
    _lastUsage = null
    _lastModelUsed = ''
    setMessages([])
    setLastUsage(null)
    setLastModelUsed('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Brain size={28} weight="duotone" className="text-primary" />
            <div className="flex items-center gap-1">
              <h2 className="text-3xl font-bold tracking-tight">{t.ai_assistant_view.title}</h2>
              <HelpButton docKey="ai-assistant" title={t.ai_assistant_view.help_title} />
            </div>
          </div>
          <p className="text-muted-foreground mt-1">
            {t.ai_assistant_view.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px]">
            <Select
              value={selectedModel}
              onValueChange={(value) => {
                _selectedModel = value
                setSelectedModel(value)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t.ai_assistant_view.select_model_placeholder} />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" className="gap-2 text-muted-foreground" onClick={handleClear}>
              <Trash size={14} />
              {t.ai_assistant_view.clear_conversation}
            </Button>
          )}
          <Badge variant="outline" className="w-fit gap-1.5">
            <Sparkle size={14} weight="fill" />
            {t.ai_assistant_view.provider_badge}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="min-h-[806px]">
          <CardHeader>
            <CardTitle>{t.ai_assistant_view.chat_title}</CardTitle>
            <CardDescription>
              {t.ai_assistant_view.chat_description}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex h-[676px] flex-col gap-4">
            {/* Scrollable message area */}
            <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-muted/20 p-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <Brain size={30} weight="duotone" className="text-primary" />
                  </div>
                    <h3 className="text-lg font-semibold">{t.ai_assistant_view.empty_title}</h3>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      {t.ai_assistant_view.empty_description}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground whitespace-pre-wrap'
                            : 'border border-border bg-card text-foreground'
                        }`}
                      >
                        {message.role === 'user' ? message.content : (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p:      ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                              em:     ({ children }) => <em className="italic">{children}</em>,
                              ul:     ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
                              ol:     ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
                              li:     ({ children }) => <li>{children}</li>,
                              h1:     ({ children }) => <h1 className="mb-1 text-base font-bold">{children}</h1>,
                              h2:     ({ children }) => <h2 className="mb-1 text-sm font-bold">{children}</h2>,
                              h3:     ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
                              code:   ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>,
                              pre:    ({ children }) => <pre className="mb-2 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">{children}</pre>,
                              blockquote: ({ children }) => <blockquote className="mb-2 border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>,
                              hr:     () => <hr className="my-2 border-border" />,
                              table: ({ children }) => (
                                <div className="mb-3 overflow-x-auto rounded-lg border border-border">
                                  <table className="w-full border-collapse text-sm">{children}</table>
                                </div>
                              ),
                              thead: ({ children }) => <thead className="bg-muted/70">{children}</thead>,
                              tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
                              tr: ({ children }) => <tr className="hover:bg-muted/30 transition-colors">{children}</tr>,
                              th: ({ children }) => (
                                <th className="border-b border-border px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-foreground">
                                  {children}
                                </th>
                              ),
                              td: ({ children }) => <td className="px-4 py-2.5 align-top text-sm text-foreground/80">{children}</td>,
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  ))}
                  {isSending && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                        {t.ai_assistant_view.sending_analysis}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Textarea
                ref={textareaRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t.ai_assistant_view.question_placeholder}
                className="min-h-24 resize-none"
                disabled={isSending}
                onKeyDown={handleKeyDown}
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {t.ai_assistant_view.input_hint.replace('{model}', selectedModel)}
                </p>
                <Button onClick={() => void askAssistant()} disabled={isSending || !question.trim()} className="gap-2">
                  <PaperPlaneTilt size={16} weight="fill" />
                  {isSending ? t.ai_assistant_view.sending : t.ai_assistant_view.send}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.ai_assistant_view.model_and_usage_title}</CardTitle>
              <CardDescription>
                {t.ai_assistant_view.model_and_usage_description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <span className="font-medium">{t.ai_assistant_view.selected_model}</span>
                <Badge variant="secondary">{selectedModel}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <span className="font-medium">{t.ai_assistant_view.used_model}</span>
                <Badge variant="outline">{lastModelUsed || '-'}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{t.ai_assistant_view.input_tokens}</p>
                  <p className="font-semibold">{lastUsage?.inputTokens ?? 0}</p>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{t.ai_assistant_view.output_tokens}</p>
                  <p className="font-semibold">{lastUsage?.outputTokens ?? 0}</p>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{t.ai_assistant_view.total_tokens}</p>
                  <p className="font-semibold">{lastUsage?.totalTokens ?? 0}</p>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">{t.ai_assistant_view.estimated_cost}</p>
                  <p className="font-semibold">{formatUsdCost(lastUsage?.costUsd)}</p>
                </div>
              </div>
              <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                {modelOptions.find((model) => model.value === selectedModel)?.description}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.ai_assistant_view.quick_questions_title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  className="h-auto w-full justify-start whitespace-normal text-left"
                  disabled={isSending}
                  onClick={() => void askAssistant(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <WarningCircle size={18} weight="duotone" />
                {t.ai_assistant_view.queries_made_title}
              </CardTitle>
              <CardDescription>
                {t.ai_assistant_view.queries_made_description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {lastUsage?.iterations != null ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <span className="font-medium">{t.ai_assistant_view.query_iterations}</span>
                  <Badge variant="secondary">{lastUsage.iterations}</Badge>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {t.ai_assistant_view.no_queries_yet}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
