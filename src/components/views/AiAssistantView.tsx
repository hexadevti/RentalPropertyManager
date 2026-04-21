import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Brain, PaperPlaneTilt, Sparkle, Trash, WarningCircle } from '@phosphor-icons/react'
import helpContent from '@/docs/ai-assistant.md?raw'
import { HelpButton } from '@/components/HelpButton'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'

type AssistantMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type AssistantResponse = {
  answer?: string
  error?: string
  details?: unknown
  model?: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    costUsd: number
  }
  contextSummary?: Array<{ name: string; countLoaded: number; error?: string }>
}

type ModelOption = {
  value: string
  label: string
  description: string
}

// Module-level state — survives component unmount/remount during tab navigation
let _messages: AssistantMessage[] = []
let _contextSummary: AssistantResponse['contextSummary'] = []
let _selectedModel = 'gpt-4o-mini'
let _lastUsage: AssistantResponse['usage'] | null = null
let _lastModelUsed = ''

const SUGGESTIONS = [
  'Qual é o saldo do mês atual e quais categorias mais impactaram?',
  'Quais propriedades estão com contrato ativo?',
  'Liste tarefas pendentes relacionadas a propriedades.',
  'Existe algum contrato vencendo ou encerrado recentemente?',
]

const MODEL_OPTIONS: ModelOption[] = [
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini', description: 'Mais econÃ´mico para uso do dia a dia' },
  { value: 'gpt-4o', label: 'gpt-4o', description: 'Mais capacidade de raciocÃ­nio e resposta' },
  { value: 'gpt-5', label: 'gpt-5', description: 'Modelo mais avanÃ§ado, com custo maior' },
]

function formatUsdCost(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return '$0.000000'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }).format(value)
}

async function readFunctionError(error: any) {
  if (!error?.context) return error?.message || 'Falha ao consultar o assistente de IA'
  try {
    const body = await error.context.json()
    if (body?.error) return body.error
    return JSON.stringify(body)
  } catch {
    try { return await error.context.text() } catch {
      return error?.message || 'Falha ao consultar o assistente de IA'
    }
  }
}

export default function AiAssistantView() {
  const [messages, setMessages] = useState<AssistantMessage[]>(_messages)
  const [question, setQuestion] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [selectedModel, setSelectedModel] = useState(_selectedModel)
  const [lastContextSummary, setLastContextSummary] = useState<AssistantResponse['contextSummary']>(_contextSummary)
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

      if (error) throw new Error(await readFunctionError(error))
      if (data?.error) throw new Error(data.error)

      const answer = data?.answer || 'Não consegui gerar uma resposta para essa pergunta.'
      const summary = data?.contextSummary || []
      setLastContextSummary(summary)
      _contextSummary = summary
      setLastUsage(data?.usage || null)
      _lastUsage = data?.usage || null
      setLastModelUsed(data?.model || selectedModel)
      _lastModelUsed = data?.model || selectedModel
      updateMessages((prev) => [...prev, { id: `assistant-${Date.now()}`, role: 'assistant', content: answer }])
    } catch (error: any) {
      const msg = error?.message || 'Falha ao consultar o assistente de IA'
      toast.error(msg)
      updateMessages((prev) => [...prev, {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: `Não consegui responder agora.\n\nDetalhe técnico: ${msg}`,
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
    _contextSummary = []
    _lastUsage = null
    _lastModelUsed = ''
    setMessages([])
    setLastContextSummary([])
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
              <h2 className="text-3xl font-bold tracking-tight">Assistente IA</h2>
              <HelpButton content={helpContent} title="Ajuda — Assistente IA" />
            </div>
          </div>
          <p className="text-muted-foreground mt-1">
            Faça perguntas sobre seus cadastros. O contexto é montado com os dados do tenant atual.
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
                <SelectValue placeholder="Selecione o modelo" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((model) => (
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
              Limpar conversa
            </Button>
          )}
          <Badge variant="outline" className="w-fit gap-1.5">
            <Sparkle size={14} weight="fill" />
            ChatGPT via Supabase Edge Function
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card className="min-h-[806px]">
          <CardHeader>
            <CardTitle>Chat</CardTitle>
            <CardDescription>
              O assistente responde com base em propriedades, contratos, hóspedes, finanças, tarefas, documentos, vistorias e agenda.
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
                  <h3 className="text-lg font-semibold">Pergunte sobre seus dados</h3>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    Exemplos: saldo do mês, contratos ativos, propriedades sem contrato, tarefas pendentes ou documentos vinculados.
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
                        Analisando cadastros e preparando resposta...
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
                placeholder="Ex.: Quais propriedades disponíveis geraram mais receita este mês?"
                className="min-h-24 resize-none"
                disabled={isSending}
                onKeyDown={handleKeyDown}
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Enter para enviar · Ctrl+Enter para nova linha · Modelo atual: {selectedModel} · Não inclua dados sensíveis.
                </p>
                <Button onClick={() => void askAssistant()} disabled={isSending || !question.trim()} className="gap-2">
                  <PaperPlaneTilt size={16} weight="fill" />
                  {isSending ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Modelo e consumo</CardTitle>
              <CardDescription>
                O custo estimado considera o modelo usado na resposta mais recente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <span className="font-medium">Modelo selecionado</span>
                <Badge variant="secondary">{selectedModel}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <span className="font-medium">Modelo usado</span>
                <Badge variant="outline">{lastModelUsed || '-'}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Input tokens</p>
                  <p className="font-semibold">{lastUsage?.inputTokens ?? 0}</p>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Output tokens</p>
                  <p className="font-semibold">{lastUsage?.outputTokens ?? 0}</p>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Total tokens</p>
                  <p className="font-semibold">{lastUsage?.totalTokens ?? 0}</p>
                </div>
                <div className="rounded-lg border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Custo estimado</p>
                  <p className="font-semibold">{formatUsdCost(lastUsage?.costUsd)}</p>
                </div>
              </div>
              <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                {MODEL_OPTIONS.find((model) => model.value === selectedModel)?.description}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Perguntas rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {SUGGESTIONS.map((suggestion) => (
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
                Contexto carregado
              </CardTitle>
              <CardDescription>
                A função limita o volume de dados enviado para manter a resposta rápida.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {lastContextSummary && lastContextSummary.length > 0 ? (
                lastContextSummary.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <span className="font-medium">{item.name}</span>
                    <Badge variant={item.error ? 'destructive' : 'secondary'}>
                      {item.error ? 'erro' : item.countLoaded}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">
                  Envie uma pergunta para ver quais cadastros foram usados no contexto.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
