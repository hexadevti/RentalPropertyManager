import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLanguage } from '@/lib/LanguageContext'
import { supabase } from '@/lib/supabase'
import { logAppAudit } from '@/lib/appAudit'
import { Brain, BuildingOffice, ChartBar, CurrencyDollar, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'

type TenantOption = {
  id: string
  name: string
}

type AiUsageRow = {
  user_login: string
  model: string
  total_tokens: number
  estimated_cost_usd: number
  created_at: string
}

type TenantUsageSummary = {
  tenantId: string
  tenantName: string
  totalQueries: number
  totalTokens: number
  totalCostUsd: number
  lastQueryAt: string | null
}

export default function TenantManagementView() {
  const { isAdmin, isPlatformAdmin, currentTenantId, currentUser, setSessionTenant } = useAuth()
  const { t } = useLanguage()

  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState<string>('')
  const [tenantDraft, setTenantDraft] = useState('')
  const [isLoadingTenants, setIsLoadingTenants] = useState(false)
  const [isSavingTenant, setIsSavingTenant] = useState(false)
  const [isDeleteTenantConfirmOpen, setIsDeleteTenantConfirmOpen] = useState(false)
  const [deleteTenantNameInput, setDeleteTenantNameInput] = useState('')
  const [isDeletingTenant, setIsDeletingTenant] = useState(false)
  const [aiUsageLogs, setAiUsageLogs] = useState<AiUsageRow[]>([])
  const [allTenantsUsage, setAllTenantsUsage] = useState<TenantUsageSummary[]>([])
  const [isLoadingAiUsage, setIsLoadingAiUsage] = useState(false)

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) || null,
    [tenants, selectedTenantId]
  )

  const aiUsageByUser = useMemo(() => {
    const map = new Map<string, { queries: number; tokens: number; cost: number }>()
    for (const row of aiUsageLogs) {
      const key = row.user_login || 'unknown'
      const curr = map.get(key) ?? { queries: 0, tokens: 0, cost: 0 }
      map.set(key, {
        queries: curr.queries + 1,
        tokens: curr.tokens + row.total_tokens,
        cost: curr.cost + Number(row.estimated_cost_usd),
      })
    }
    return Array.from(map.entries())
      .map(([login, stats]) => ({ login, ...stats }))
      .sort((a, b) => b.cost - a.cost)
  }, [aiUsageLogs])

  const aiTotals = useMemo(() => ({
    queries: aiUsageLogs.length,
    tokens: aiUsageLogs.reduce((sum, row) => sum + row.total_tokens, 0),
    cost: aiUsageLogs.reduce((sum, row) => sum + Number(row.estimated_cost_usd), 0),
  }), [aiUsageLogs])

  useEffect(() => {
    setTenantDraft(selectedTenant?.name || '')
  }, [selectedTenant])

  const loadAllTenantsUsage = useCallback(async (tenantList: TenantOption[]) => {
    if (!tenantList.length) return
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('ai_usage_logs')
      .select('tenant_id, total_tokens, estimated_cost_usd, created_at')
      .gte('created_at', since)

    if (error || !data) return

    const map = new Map<string, { queries: number; tokens: number; cost: number; lastAt: string | null }>()
    for (const row of data as { tenant_id: string; total_tokens: number; estimated_cost_usd: number; created_at: string }[]) {
      const current = map.get(row.tenant_id) ?? { queries: 0, tokens: 0, cost: 0, lastAt: null }
      map.set(row.tenant_id, {
        queries: current.queries + 1,
        tokens: current.tokens + row.total_tokens,
        cost: current.cost + Number(row.estimated_cost_usd),
        lastAt: current.lastAt && current.lastAt > row.created_at ? current.lastAt : row.created_at,
      })
    }

    setAllTenantsUsage(
      Array.from(map.entries())
        .map(([tenantId, stats]) => ({
          tenantId,
          tenantName: tenantList.find((tenant) => tenant.id === tenantId)?.name ?? tenantId,
          totalQueries: stats.queries,
          totalTokens: stats.tokens,
          totalCostUsd: stats.cost,
          lastQueryAt: stats.lastAt,
        }))
        .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
    )
  }, [])

  const loadTenants = useCallback(async () => {
    setIsLoadingTenants(true)
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name')
      .order('created_at', { ascending: true })

    if (error) {
      toast.error(t.users_permissions_view.tenants_load_error)
      setTenants([])
      setIsLoadingTenants(false)
      return
    }

    const loaded = (data || []) as TenantOption[]
    setTenants(loaded)
    setSelectedTenantId((current) => current || currentTenantId || loaded[0]?.id || '')
    if (isPlatformAdmin) void loadAllTenantsUsage(loaded)
    setIsLoadingTenants(false)
  }, [currentTenantId, isPlatformAdmin, loadAllTenantsUsage, t.users_permissions_view.tenants_load_error])

  const loadAiUsage = useCallback(async (tenantId: string) => {
    if (!tenantId) return
    setIsLoadingAiUsage(true)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('ai_usage_logs')
      .select('user_login, model, total_tokens, estimated_cost_usd, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500)

    if (!error) {
      setAiUsageLogs((data || []) as AiUsageRow[])
    }
    setIsLoadingAiUsage(false)
  }, [])

  useEffect(() => {
    void loadTenants()
  }, [loadTenants])

  useEffect(() => {
    if (!selectedTenantId) return
    void loadAiUsage(selectedTenantId)
  }, [selectedTenantId, loadAiUsage])

  const handleSaveTenant = async () => {
    if (!selectedTenantId) return
    setIsSavingTenant(true)
    try {
      const trimmed = tenantDraft.trim()
      if (!trimmed) {
        toast.error(t.users_permissions_view.tenant_name_required)
        return
      }

      const { error } = await supabase
        .from('tenants')
        .update({ name: trimmed })
        .eq('id', selectedTenantId)

      if (error) throw error

      setTenants((current) => current.map((tenant) => (
        tenant.id === selectedTenantId ? { ...tenant, name: trimmed } : tenant
      )))

      await logAppAudit({
        entity: 'tenants',
        action: 'update',
        recordId: selectedTenantId,
        tenantId: selectedTenantId,
        actorAuthUserId: currentUser?.id,
        actorLogin: currentUser?.login,
      })

      toast.success(t.users_permissions_view.tenant_updated_success)
    } catch (error: any) {
      toast.error(error?.message || t.users_permissions_view.tenant_update_error)
    } finally {
      setIsSavingTenant(false)
    }
  }

  const handleDeleteTenant = async () => {
    if (!selectedTenantId || !selectedTenant) return
    if (deleteTenantNameInput.trim() !== selectedTenant.name.trim()) {
      toast.error(t.users_permissions_view.delete_tenant_name_mismatch)
      return
    }
    if (selectedTenantId === currentTenantId) {
      toast.error(t.users_permissions_view.delete_tenant_switch_session_first)
      return
    }

    setIsDeletingTenant(true)
    try {
      const { data, error } = await supabase.rpc('delete_tenant', {
        p_tenant_id: selectedTenantId,
        p_confirmation_name: deleteTenantNameInput.trim(),
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      const remainingTenants = tenants.filter((tenant) => tenant.id !== selectedTenantId)
      setTenants(remainingTenants)
      setSelectedTenantId(remainingTenants[0]?.id || '')
      setAiUsageLogs([])
      setDeleteTenantNameInput('')
      setIsDeleteTenantConfirmOpen(false)
      toast.success(t.users_permissions_view.delete_tenant_success)
    } catch (error: any) {
      toast.error(error?.message || t.users_permissions_view.delete_tenant_error)
    } finally {
      setIsDeletingTenant(false)
    }
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BuildingOffice size={20} weight="duotone" />
            {t.users_permissions_view.restricted_access}
          </CardTitle>
          <CardDescription>{t.users_permissions_view.restricted_access_description}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Tenant</h2>
        <p className="text-muted-foreground mt-1">
          Controle o tenant atual e acompanhe o consumo do assistente IA.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BuildingOffice size={20} weight="duotone" />
            {t.users_permissions_view.tenant_control_title}
          </CardTitle>
          <CardDescription>
            {t.users_permissions_view.tenant_control_description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tenant-selector">{t.users_permissions_view.tenant_in_focus}</Label>
              <Select
                value={selectedTenantId}
                onValueChange={setSelectedTenantId}
                disabled={isLoadingTenants || tenants.length === 0 || !isPlatformAdmin}
              >
                <SelectTrigger id="tenant-selector">
                  <SelectValue placeholder={t.users_permissions_view.select_tenant} />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-name">{t.users_permissions_view.tenant_name}</Label>
              <Input
                id="tenant-name"
                value={tenantDraft}
                onChange={(event) => setTenantDraft(event.target.value)}
                placeholder={t.users_permissions_view.organization_name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-id">{t.users_permissions_view.tenant_id}</Label>
              <Input id="tenant-id" value={selectedTenantId || ''} disabled />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t.users_permissions_view.logged_user_tenant}: {currentTenantId || '-'}
          </p>
          {!isPlatformAdmin && (
            <p className="text-xs text-muted-foreground">
              {t.users_permissions_view.only_master_session_and_move}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            {isPlatformAdmin && (
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!selectedTenantId) return
                  try {
                    await setSessionTenant(selectedTenantId)
                    toast.success(t.users_permissions_view.session_tenant_updated)
                  } catch (error: any) {
                    toast.error(error?.message || t.users_permissions_view.session_tenant_update_error)
                  }
                }}
                disabled={!selectedTenantId}
              >
                {t.users_permissions_view.use_selected_tenant}
              </Button>
            )}
            <Button onClick={handleSaveTenant} disabled={isSavingTenant || !tenantDraft.trim()}>
              {isSavingTenant ? t.users_permissions_view.saving : t.users_permissions_view.save_tenant}
            </Button>
            {isPlatformAdmin && (
              <Button
                variant="destructive"
                onClick={() => {
                  setDeleteTenantNameInput('')
                  setIsDeleteTenantConfirmOpen(true)
                }}
                disabled={!selectedTenantId}
              >
                <Trash size={16} className="mr-2" />
                {t.users_permissions_view.delete_tenant}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain size={20} weight="duotone" />
            {t.users_permissions_view.ai_usage_title}
          </CardTitle>
          <CardDescription>
            {t.users_permissions_view.ai_usage_description_prefix} <strong>{selectedTenant?.name ?? selectedTenantId}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingAiUsage ? (
            <p className="text-sm text-muted-foreground">{t.users_permissions_view.loading}</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t.users_permissions_view.queries}</p>
                  <p className="text-2xl font-bold">{aiTotals.queries}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t.users_permissions_view.total_tokens}</p>
                  <p className="text-2xl font-bold">{aiTotals.tokens.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <CurrencyDollar size={13} />{t.users_permissions_view.estimated_cost_usd}
                  </p>
                  <p className="text-2xl font-bold">${aiTotals.cost.toFixed(6)}</p>
                </div>
              </div>

              {aiUsageByUser.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-2">{t.users_permissions_view.user}</th>
                        <th className="px-4 py-2 text-right">{t.users_permissions_view.queries}</th>
                        <th className="px-4 py-2 text-right">{t.users_permissions_view.tokens}</th>
                        <th className="px-4 py-2 text-right">{t.users_permissions_view.cost_usd}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiUsageByUser.map((row) => (
                        <tr key={row.login} className="border-t border-border">
                          <td className="px-4 py-2 font-medium">{row.login}</td>
                          <td className="px-4 py-2 text-right">{row.queries}</td>
                          <td className="px-4 py-2 text-right">{row.tokens.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right">${row.cost.toFixed(6)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {aiUsageLogs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t.users_permissions_view.no_usage_last_30_days}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {isPlatformAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartBar size={20} weight="duotone" />
              {t.users_permissions_view.tenant_spend_title}
            </CardTitle>
            <CardDescription>
              {t.users_permissions_view.tenant_spend_description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allTenantsUsage.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t.users_permissions_view.no_usage_last_30_days}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2">{t.users_permissions_view.tenant}</th>
                      <th className="px-4 py-2 text-right">{t.users_permissions_view.queries}</th>
                      <th className="px-4 py-2 text-right">{t.users_permissions_view.tokens}</th>
                      <th className="px-4 py-2 text-right">{t.users_permissions_view.cost_usd}</th>
                      <th className="px-4 py-2 text-right">{t.users_permissions_view.last_query}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTenantsUsage.map((row) => (
                      <tr key={row.tenantId} className="border-t border-border">
                        <td className="px-4 py-2 font-medium">{row.tenantName}</td>
                        <td className="px-4 py-2 text-right">{row.totalQueries}</td>
                        <td className="px-4 py-2 text-right">{row.totalTokens.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right">${row.totalCostUsd.toFixed(6)}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {row.lastQueryAt ? new Date(row.lastQueryAt).toLocaleDateString() : t.users_permissions_view.not_available}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="px-4 py-2">{t.users_permissions_view.total}</td>
                      <td className="px-4 py-2 text-right">{allTenantsUsage.reduce((sum, row) => sum + row.totalQueries, 0)}</td>
                      <td className="px-4 py-2 text-right">{allTenantsUsage.reduce((sum, row) => sum + row.totalTokens, 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">${allTenantsUsage.reduce((sum, row) => sum + row.totalCostUsd, 0).toFixed(6)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={isDeleteTenantConfirmOpen} onOpenChange={setIsDeleteTenantConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.users_permissions_view.delete_tenant_title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.users_permissions_view.delete_tenant_description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-tenant-confirm">{t.users_permissions_view.delete_tenant_confirm_label}</Label>
            <Input
              id="delete-tenant-confirm"
              value={deleteTenantNameInput}
              onChange={(event) => setDeleteTenantNameInput(event.target.value)}
              placeholder={t.users_permissions_view.delete_tenant_confirm_placeholder}
            />
            {selectedTenant && (
              <p className="text-sm text-muted-foreground">
                {t.users_permissions_view.delete_tenant_confirm_target}: <strong>{selectedTenant.name}</strong>
              </p>
            )}
            {selectedTenantId === currentTenantId && (
              <p className="text-sm text-destructive">
                {t.users_permissions_view.delete_tenant_switch_session_first}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTenant}>{t.properties_view.delete_confirm_cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteTenant()} disabled={isDeletingTenant}>
              {isDeletingTenant ? t.users_permissions_view.delete_tenant_deleting : t.users_permissions_view.delete_tenant_confirm_button}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
