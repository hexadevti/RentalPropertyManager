import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  WhatsappLogo, MagnifyingGlass, ArrowsClockwise, ChatCircleText,
  User, ChartBar, Trash, Clock, WarningCircle, CheckCircle, ProhibitInset,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useLanguage } from '@/lib/LanguageContext'

type Tenant = { id: string; name: string }

type ChatMessage = {
  id: string
  phone: string
  tenant_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

type BotLog = {
  id: string
  phone: string
  tenant_id: string | null
  user_login: string | null
  incoming: string
  response: string
  status: 'success' | 'not_found' | 'blocked' | 'pending' | 'command' | 'error'
  created_at: string
}

type ConversationSummary = {
  phone: string
  tenant_id: string
  tenantName: string
  userLogin: string
  lastMessage: string
  lastRole: 'user' | 'assistant'
  lastAt: string
  totalMessages: number
}

type UsageStat = {
  total_conversations: number
  total_messages: number
  total_tokens: number
  estimated_cost_usd: number
  messages_today: number
  denied_today: number
}

const STATUS_CONFIG: Record<BotLog['status'], { label: string; color: string; icon: React.ReactNode }> = {
  success:   { label: 'Sucesso',     color: 'text-green-600 bg-green-50 border-green-200',   icon: <CheckCircle size={13} /> },
  command:   { label: 'Comando',     color: 'text-blue-600 bg-blue-50 border-blue-200',      icon: <CheckCircle size={13} /> },
  not_found: { label: 'Não cadastrado', color: 'text-red-600 bg-red-50 border-red-200',      icon: <WarningCircle size={13} /> },
  blocked:   { label: 'Bloqueado',   color: 'text-red-700 bg-red-100 border-red-300',        icon: <ProhibitInset size={13} /> },
  pending:   { label: 'Pendente',    color: 'text-amber-600 bg-amber-50 border-amber-200',   icon: <Clock size={13} /> },
  error:     { label: 'Erro',        color: 'text-orange-600 bg-orange-50 border-orange-200', icon: <WarningCircle size={13} /> },
}

export default function WhatsAppBotView() {
  const { language } = useLanguage()
  const locale = language === 'pt' ? ptBR : undefined

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [profiles, setProfiles] = useState<{ phone: string; github_login: string; email: string; tenant_id: string }[]>([])
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([])
  const [logs, setLogs] = useState<BotLog[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)
  const [conversationMessages, setConversationMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [search, setSearch] = useState('')
  const [logSearch, setLogSearch] = useState('')
  const [logStatusFilter, setLogStatusFilter] = useState<string>('all')
  const [tenantFilter, setTenantFilter] = useState('all')
  const [stats, setStats] = useState<UsageStat | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)

      const [tenantsRes, profilesRes, messagesRes, logsRes, usageRes] = await Promise.all([
        supabase.from('tenants').select('id, name').order('name'),
        supabase.from('user_profiles').select('phone, github_login, email, tenant_id').not('phone', 'is', null),
        supabase.from('whatsapp_chat_history').select('id, phone, tenant_id, role, content, created_at').order('created_at', { ascending: false }).limit(2000),
        supabase.from('whatsapp_bot_logs').select('id, phone, tenant_id, user_login, incoming, response, status, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('ai_usage_logs').select('total_tokens, estimated_cost_usd, created_at').eq('model', 'claude-haiku-4-5-20251001'),
      ])

      const tenantList = (tenantsRes.data ?? []) as Tenant[]
      setTenants(tenantList)
      setProfiles((profilesRes.data ?? []) as any[])

      const messages = (messagesRes.data ?? []) as ChatMessage[]
      setAllMessages(messages)

      const botLogs = (logsRes.data ?? []) as BotLog[]
      setLogs(botLogs)

      const usageLogs = usageRes.data ?? []
      const todayMessages = messages.filter(m => m.created_at.startsWith(today))
      const todayDenied = botLogs.filter(l =>
        l.created_at.startsWith(today) && ['not_found', 'blocked', 'pending', 'error'].includes(l.status)
      )

      const uniqueConversations = new Set(messages.map(m => `${m.phone}::${m.tenant_id}`))

      setStats({
        total_conversations: uniqueConversations.size,
        total_messages: messages.length,
        total_tokens: usageLogs.reduce((s, r: any) => s + (r.total_tokens ?? 0), 0),
        estimated_cost_usd: usageLogs.reduce((s, r: any) => s + Number(r.estimated_cost_usd ?? 0), 0),
        messages_today: todayMessages.length,
        denied_today: todayDenied.length,
      })
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const loadConversation = async (phone: string, tenantId: string) => {
    setLoadingMessages(true)
    setSelectedPhone(phone)
    setSelectedTenantId(tenantId)
    try {
      const { data } = await supabase
        .from('whatsapp_chat_history')
        .select('id, phone, tenant_id, role, content, created_at')
        .eq('phone', phone)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true })
      setConversationMessages((data ?? []) as ChatMessage[])
    } finally {
      setLoadingMessages(false)
    }
  }

  const clearConversation = async (phone: string, tenantId: string) => {
    if (!confirm(`Apagar toda a conversa do número +${phone}?`)) return
    await supabase.from('whatsapp_chat_history').delete().eq('phone', phone).eq('tenant_id', tenantId)
    toast.success('Conversa apagada')
    setSelectedPhone(null)
    setSelectedTenantId(null)
    setConversationMessages([])
    loadData()
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [conversationMessages])

  // Build conversation summaries
  const conversations: ConversationSummary[] = (() => {
    const map = new Map<string, ConversationSummary>()
    const tenantMap = new Map(tenants.map(t => [t.id, t.name]))
    const profileMap = new Map(profiles.map(p => [`${p.phone}::${p.tenant_id}`, p]))

    for (const msg of allMessages) {
      const key = `${msg.phone}::${msg.tenant_id}`
      const existing = map.get(key)
      if (!existing) {
        const profile = profileMap.get(key)
        map.set(key, {
          phone: msg.phone,
          tenant_id: msg.tenant_id,
          tenantName: tenantMap.get(msg.tenant_id) ?? msg.tenant_id,
          userLogin: profile?.github_login || profile?.email || msg.phone,
          lastMessage: msg.content,
          lastRole: msg.role,
          lastAt: msg.created_at,
          totalMessages: 1,
        })
      } else {
        existing.totalMessages += 1
        if (msg.created_at > existing.lastAt) {
          existing.lastAt = msg.created_at
          existing.lastMessage = msg.content
          existing.lastRole = msg.role
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt))
  })()

  const filteredConversations = conversations.filter(c => {
    if (tenantFilter !== 'all' && c.tenant_id !== tenantFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return c.phone.includes(q) || c.userLogin.toLowerCase().includes(q) || c.tenantName.toLowerCase().includes(q)
    }
    return true
  })

  const filteredLogs = logs.filter(l => {
    if (logStatusFilter !== 'all' && l.status !== logStatusFilter) return false
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase()
      return l.phone.includes(q) || (l.user_login ?? '').toLowerCase().includes(q) || l.incoming.toLowerCase().includes(q)
    }
    return true
  })

  const selectedConv = selectedPhone
    ? conversations.find(c => c.phone === selectedPhone && c.tenant_id === selectedTenantId)
    : null

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WhatsappLogo size={28} weight="fill" className="text-green-500" />
          <h2 className="text-2xl font-semibold">Bot WhatsApp</h2>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={loadData} disabled={loading}>
          <ArrowsClockwise size={14} weight="bold" className={loading ? 'animate-spin' : ''} />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[
            { label: 'Conversas',  value: stats.total_conversations, icon: <ChatCircleText size={14} /> },
            { label: 'Mensagens',  value: stats.total_messages,      icon: <ChatCircleText size={14} /> },
            { label: 'Hoje',       value: stats.messages_today,      icon: <Clock size={14} /> },
            { label: 'Recusados hoje', value: stats.denied_today,    icon: <WarningCircle size={14} className="text-red-500" /> },
            { label: 'Tokens',     value: stats.total_tokens.toLocaleString(), icon: <ChartBar size={14} /> },
            { label: 'Custo',      value: `$${stats.estimated_cost_usd.toFixed(4)}`, icon: <ChartBar size={14} /> },
          ].map(s => (
            <Card key={s.label} className="py-3">
              <CardContent className="px-4 py-0">
                <p className="text-xs text-muted-foreground flex items-center gap-1">{s.icon} {s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="conversations" className="flex flex-col flex-1 min-h-0">
        <TabsList className="shrink-0 w-fit">
          <TabsTrigger value="conversations" className="gap-1.5">
            <ChatCircleText size={14} /> Conversas ({conversations.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <WarningCircle size={14} /> Logs ({logs.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Conversations tab ── */}
        <TabsContent value="conversations" className="flex flex-1 gap-4 min-h-0 mt-3">
          {/* Conversation list */}
          <div className="flex w-72 shrink-0 flex-col gap-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>
              <Select value={tenantFilter} onValueChange={setTenantFilter}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 rounded-lg border bg-muted/20 p-1">
              {loading ? (
                <p className="p-4 text-sm text-muted-foreground text-center">Carregando...</p>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                  <ChatCircleText size={32} weight="duotone" />
                  <p className="text-sm">Nenhuma conversa</p>
                </div>
              ) : filteredConversations.map(c => {
                const isSelected = c.phone === selectedPhone && c.tenant_id === selectedTenantId
                return (
                  <button key={`${c.phone}::${c.tenant_id}`}
                    onClick={() => loadConversation(c.phone, c.tenant_id)}
                    className={`w-full rounded-md p-2.5 text-left transition-colors hover:bg-accent ${isSelected ? 'bg-accent' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{c.userLogin}</span>
                      <Badge variant="outline" className="text-xs shrink-0">{c.totalMessages}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">+{c.phone}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5 italic">
                      {c.lastRole === 'assistant' ? '🤖 ' : '👤 '}{c.lastMessage.slice(0, 45)}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <Badge variant="secondary" className="text-xs">{c.tenantName}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(c.lastAt), { addSuffix: true, locale })}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Conversation detail */}
          <div className="flex flex-1 min-w-0 flex-col rounded-lg border bg-background">
            {!selectedConv ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
                <WhatsappLogo size={48} weight="duotone" className="text-green-500/40" />
                <p className="text-sm">Selecione uma conversa</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <WhatsappLogo size={16} weight="fill" className="text-green-500" />
                      <span className="font-medium">{selectedConv.userLogin}</span>
                      <span className="text-sm text-muted-foreground">+{selectedConv.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-xs">{selectedConv.tenantName}</Badge>
                      <span className="text-xs text-muted-foreground">{selectedConv.totalMessages} mensagens</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => clearConversation(selectedConv.phone, selectedConv.tenant_id)}>
                    <Trash size={14} /> Apagar conversa
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {loadingMessages ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
                  ) : conversationMessages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        msg.role === 'user' ? 'bg-green-500 text-white' : 'bg-muted text-foreground'
                      }`}>
                        <p className="text-xs opacity-60 mb-0.5">
                          {msg.role === 'user' ? '👤' : '🤖'} {format(new Date(msg.created_at), 'HH:mm dd/MM')}
                        </p>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ── Logs tab ── */}
        <TabsContent value="logs" className="flex flex-col flex-1 min-h-0 mt-3 gap-3">
          <div className="flex gap-2 shrink-0">
            <div className="relative w-64">
              <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar número ou mensagem..." value={logSearch} onChange={e => setLogSearch(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
            <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
              <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground self-center">{filteredLogs.length} registros</span>
          </div>

          <div className="flex-1 overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium w-36">Data/Hora</th>
                  <th className="text-left px-3 py-2 font-medium w-32">Número</th>
                  <th className="text-left px-3 py-2 font-medium w-28">Usuário</th>
                  <th className="text-left px-3 py-2 font-medium w-28">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Mensagem enviada</th>
                  <th className="text-left px-3 py-2 font-medium">Resposta do bot</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      Nenhum log encontrado
                    </td>
                  </tr>
                ) : filteredLogs.map(log => {
                  const cfg = STATUS_CONFIG[log.status]
                  return (
                    <tr key={log.id} className="border-t hover:bg-muted/20">
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), 'dd/MM HH:mm:ss')}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">+{log.phone}</td>
                      <td className="px-3 py-2 text-xs truncate max-w-[7rem]">{log.user_login ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs max-w-[220px]">
                        <p className="truncate" title={log.incoming}>{log.incoming}</p>
                      </td>
                      <td className="px-3 py-2 text-xs max-w-[220px]">
                        <p className="truncate text-muted-foreground" title={log.response}>{log.response}</p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
