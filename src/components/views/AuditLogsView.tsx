import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClockCounterClockwise, ArrowsClockwise } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

type AuditLogRow = {
  id: string
  tenant_id: string | null
  actor_auth_user_id: string | null
  actor_login: string | null
  entity: string
  action: string
  record_id: string | null
  created_at: string
}

type ActorProfile = {
  auth_user_id: string
  github_login: string | null
  email: string | null
}

type PeriodFilter = 'last-hour' | 'today' | 'date' | 'range' | 'all'
type ActionFilter = 'all' | 'login' | 'logout' | 'create' | 'update' | 'delete'

function getDateRange(period: PeriodFilter, date: string, startDate: string, endDate: string) {
  const now = new Date()
  if (period === 'last-hour') {
    return { from: new Date(now.getTime() - 60 * 60 * 1000).toISOString(), to: now.toISOString() }
  }
  if (period === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: now.toISOString() }
  }
  if (period === 'date' && date) {
    const start = new Date(`${date}T00:00:00`)
    const end = new Date(`${date}T23:59:59.999`)
    return { from: start.toISOString(), to: end.toISOString() }
  }
  if (period === 'range' && startDate && endDate) {
    return {
      from: new Date(`${startDate}T00:00:00`).toISOString(),
      to: new Date(`${endDate}T23:59:59.999`).toISOString(),
    }
  }
  return { from: null, to: null }
}

export default function AuditLogsView() {
  const { currentTenantId } = useAuth()
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [actorProfiles, setActorProfiles] = useState<Record<string, ActorProfile>>({})
  const [userOptions, setUserOptions] = useState<ActorProfile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [period, setPeriod] = useState<PeriodFilter>('last-hour')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [entityFilter, setEntityFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all')
  const [userFilter, setUserFilter] = useState('all')
  const [recordSearch, setRecordSearch] = useState('')

  const loadUserOptions = useCallback(async () => {
    if (!currentTenantId) {
      setUserOptions([])
      return
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('auth_user_id, github_login, email')
      .eq('tenant_id', currentTenantId)
      .not('auth_user_id', 'is', null)
      .order('github_login', { ascending: true })

    if (error) {
      console.warn('Failed to load audit user options:', error)
      setUserOptions([])
      return
    }

    setUserOptions((data || []) as ActorProfile[])
  }, [currentTenantId])

  const loadLogs = useCallback(async () => {
    if (!currentTenantId) {
      setLogs([])
      setActorProfiles({})
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const range = getDateRange(period, date, startDate, endDate)

    let query = supabase
      .from('app_audit_logs')
      .select('id, tenant_id, actor_auth_user_id, actor_login, entity, action, record_id, created_at')
      .eq('tenant_id', currentTenantId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (range.from) query = query.gte('created_at', range.from)
    if (range.to) query = query.lte('created_at', range.to)
    if (entityFilter !== 'all') query = query.eq('entity', entityFilter)
    if (actionFilter !== 'all') query = query.eq('action', actionFilter)
    if (userFilter !== 'all') query = query.eq('actor_auth_user_id', userFilter)
    if (recordSearch.trim()) query = query.ilike('record_id', `%${recordSearch.trim()}%`)

    const { data, error } = await query

    if (error) {
      console.warn('Failed to load app audit logs:', error)
      setLogs([])
      setActorProfiles({})
    } else {
      const loadedLogs = (data || []) as AuditLogRow[]
      setLogs(loadedLogs)

      const actorIds = Array.from(new Set(
        loadedLogs
          .map((log) => log.actor_auth_user_id)
          .filter((id): id is string => Boolean(id))
      ))

      if (actorIds.length === 0) {
        setActorProfiles({})
      } else {
        const { data: profiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('auth_user_id, github_login, email')
          .eq('tenant_id', currentTenantId)
          .in('auth_user_id', actorIds)

        if (profilesError) {
          console.warn('Failed to load audit actor profiles:', profilesError)
          setActorProfiles({})
        } else {
          const profileMap = userOptions.reduce<Record<string, ActorProfile>>((acc, profile) => {
            if (profile.auth_user_id) acc[profile.auth_user_id] = profile
            return acc
          }, {})

          for (const profile of (profiles || []) as ActorProfile[]) {
            if (profile.auth_user_id) profileMap[profile.auth_user_id] = profile
          }

          setActorProfiles(profileMap)
        }
      }
    }

    setIsLoading(false)
  }, [actionFilter, currentTenantId, date, endDate, entityFilter, period, recordSearch, startDate, userFilter, userOptions])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  useEffect(() => {
    void loadUserOptions()
  }, [loadUserOptions])

  const entityOptions = useMemo(() => {
    return Array.from(new Set([
      ...logs.map((log) => log.entity),
      ...(entityFilter !== 'all' ? [entityFilter] : []),
    ])).sort()
  }, [entityFilter, logs])

  const getActorLabel = (log: AuditLogRow) => {
    const profile = log.actor_auth_user_id ? actorProfiles[log.actor_auth_user_id] : null
    if (profile?.github_login) return profile.github_login
    if (profile?.email) return profile.email
    if (log.actor_login) return log.actor_login
    if (log.actor_auth_user_id) return `Usuário não encontrado (${log.actor_auth_user_id.slice(0, 8)})`
    return 'sistema'
  }

  const getActorEmail = (log: AuditLogRow) => {
    const profile = log.actor_auth_user_id ? actorProfiles[log.actor_auth_user_id] : null
    return profile?.email || '-'
  }

  const getUserOptionLabel = (profile: ActorProfile) => {
    if (profile.github_login && profile.email) return `${profile.github_login} (${profile.email})`
    return profile.github_login || profile.email || profile.auth_user_id
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Log de auditoria</h2>
          <p className="text-muted-foreground mt-1">
            Consulte ações de login, logout, criação, alteração e exclusão registradas no app.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadLogs()} disabled={isLoading} className="gap-2">
          <ArrowsClockwise size={16} />
          {isLoading ? 'Atualizando...' : 'Atualizar'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Por padrão, a tela carrega apenas registros da última hora.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={period} onValueChange={(value) => setPeriod(value as PeriodFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="last-hour">Última hora</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="date">Data específica</SelectItem>
                <SelectItem value="range">Intervalo</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {period === 'date' && (
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
          )}

          {period === 'range' && (
            <>
              <div className="space-y-2">
                <Label>Data inicial</Label>
                <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data final</Label>
                <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Entidade</Label>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {entityOptions.map((entity) => (
                  <SelectItem key={entity} value={entity}>{entity}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de evento</Label>
            <Select value={actionFilter} onValueChange={(value) => setActionFilter(value as ActionFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="login">login</SelectItem>
                <SelectItem value="logout">logout</SelectItem>
                <SelectItem value="create">create</SelectItem>
                <SelectItem value="update">update</SelectItem>
                <SelectItem value="delete">delete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Usuário</Label>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {userOptions.map((profile) => (
                  <SelectItem key={profile.auth_user_id} value={profile.auth_user_id}>
                    {getUserOptionLabel(profile)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Buscar por ID</Label>
            <Input
              value={recordSearch}
              onChange={(event) => setRecordSearch(event.target.value)}
              placeholder="ID do registro"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClockCounterClockwise size={20} weight="duotone" />
            Eventos
          </CardTitle>
          <CardDescription>{logs.length} registro(s) encontrados.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border">
            <div className="grid min-w-[1040px] grid-cols-[150px_110px_150px_180px_220px_1fr] gap-3 border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span>Data</span>
              <span>Evento</span>
              <span>Entidade</span>
              <span>Usuário</span>
              <span>E-mail</span>
              <span>Registro</span>
            </div>
            {logs.map((log) => (
              <div
                key={log.id}
                className="grid min-w-[1040px] grid-cols-[150px_110px_150px_180px_220px_1fr] gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0"
              >
                <span className="text-xs text-muted-foreground">
                  {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                </span>
                <span>
                  <Badge variant="secondary" className="h-5 px-2 text-[11px]">{log.action}</Badge>
                </span>
                <span>
                  <Badge variant="outline" className="h-5 max-w-full truncate px-2 text-[11px]">{log.entity}</Badge>
                </span>
                <span className="truncate" title={getActorLabel(log)}>{getActorLabel(log)}</span>
                <span className="truncate text-muted-foreground" title={getActorEmail(log)}>{getActorEmail(log)}</span>
                <span className="truncate font-mono text-xs text-muted-foreground" title={log.record_id || '-'}>
                  {log.record_id || '-'}
                </span>
              </div>
            ))}
          </div>
          {!isLoading && logs.length === 0 && (
            <div className="mt-3 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum evento encontrado para os filtros selecionados.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
