import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { useLanguage } from '@/lib/LanguageContext'
import { createBillingCheckoutSession } from '@/lib/billing'
import { fetchUsagePlanCatalog, type UsagePlanCatalogItem } from '@/lib/usagePlans'
import { supabase } from '@/lib/supabase'
import { logAppAudit } from '@/lib/appAudit'
import { Brain, BuildingOffice, ChartBar, CurrencyDollar, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'

type TenantOption = {
  id: string
  name: string
  created_at: string
}

type AiUsageRow = {
  user_login: string
  model: string
  total_tokens: number
  estimated_cost_usd: number
  created_at: string
}

type AiUsageWindow = {
  cycleStartIso: string
  renewalDateIso: string
}

type TenantUsageSummary = {
  tenantId: string
  tenantName: string
  totalQueries: number
  totalTokens: number
  totalCostUsd: number
  lastQueryAt: string | null
}

type BillingAccountRow = {
  provider: string
  provider_subscription_id: string | null
  subscription_status: string | null
  active_plan_code: string | null
  current_period_end: string | null
}

type EffectivePlanRow = {
  planCode?: string
  planName?: string
  maxAiTokens?: number | null
  aiEnabled?: boolean
}

type AiCycleUsage = {
  usedTokens: number
  maxTokens: number | null
  remainingTokens: number | null
  progressPercent: number
  cycleStartIso: string
  renewalDateIso: string
}

function getUtcDateForAnchorDay(year: number, month: number, anchorDay: number) {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(Math.max(anchorDay, 1), daysInMonth)
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
}

function resolveTenantCycleWindow(now: Date, anchorDay: number) {
  const normalizedAnchorDay = Number.isFinite(anchorDay) && anchorDay > 0 ? Math.floor(anchorDay) : 1
  let cycleStart = getUtcDateForAnchorDay(now.getUTCFullYear(), now.getUTCMonth(), normalizedAnchorDay)

  if (now.getTime() < cycleStart.getTime()) {
    const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    cycleStart = getUtcDateForAnchorDay(previousMonth.getUTCFullYear(), previousMonth.getUTCMonth(), normalizedAnchorDay)
  }

  const renewalDate = getUtcDateForAnchorDay(cycleStart.getUTCFullYear(), cycleStart.getUTCMonth() + 1, normalizedAnchorDay)
  return { cycleStart, renewalDate }
}

export default function TenantManagementView() {
  const { isAdmin, isPlatformAdmin, currentTenantId, currentUser, setSessionTenant, tenantUsagePlan, reloadTenantUsagePlan } = useAuth()
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
  const [aiUsageWindow, setAiUsageWindow] = useState<AiUsageWindow | null>(null)
  const [allTenantsUsage, setAllTenantsUsage] = useState<TenantUsageSummary[]>([])
  const [isLoadingAiUsage, setIsLoadingAiUsage] = useState(false)
  const [catalogPlans, setCatalogPlans] = useState<UsagePlanCatalogItem[]>([])
  const [billingAccount, setBillingAccount] = useState<BillingAccountRow | null>(null)
  const [selectedTenantPlan, setSelectedTenantPlan] = useState<EffectivePlanRow | null>(null)
  const [aiCycleUsage, setAiCycleUsage] = useState<AiCycleUsage | null>(null)
  const [isLoadingBilling, setIsLoadingBilling] = useState(false)
  const [isStartingCheckout, setIsStartingCheckout] = useState<string | null>(null)
  const billingCardRef = useRef<HTMLDivElement | null>(null)

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
      .select('id, name, created_at')
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

  const loadBillingData = useCallback(async () => {
    if (!selectedTenantId) return
    setIsLoadingBilling(true)

    try {
      const [plansResult, accountResult, planResult, tenantResult] = await Promise.all([
        fetchUsagePlanCatalog(),
        supabase
          .from('billing_accounts')
          .select('provider, provider_subscription_id, subscription_status, active_plan_code, current_period_end')
          .eq('tenant_id', selectedTenantId)
          .maybeSingle(),
        supabase.rpc('get_effective_tenant_usage_plan', {
          p_tenant_id: selectedTenantId,
        }),
        supabase
          .from('tenants')
          .select('created_at')
          .eq('id', selectedTenantId)
          .maybeSingle(),
      ])

      setCatalogPlans(plansResult)

      if (accountResult.error) {
        throw accountResult.error
      }

      if (tenantResult.error) {
        throw tenantResult.error
      }

      const tenantCreatedAt = tenantResult.data?.created_at
      const anchorDay = tenantCreatedAt ? new Date(String(tenantCreatedAt)).getUTCDate() : 1
      const { cycleStart, renewalDate } = resolveTenantCycleWindow(new Date(), anchorDay)

      const usageResult = await supabase
        .from('ai_usage_logs')
        .select('total_tokens')
        .eq('tenant_id', selectedTenantId)
        .gte('created_at', cycleStart.toISOString())
        .lt('created_at', renewalDate.toISOString())

      if (usageResult.error) {
        throw usageResult.error
      }

      const usedTokens = (usageResult.data || []).reduce((sum, row) => sum + Number(row.total_tokens || 0), 0)
      const effectivePlan = (planResult.data || null) as EffectivePlanRow | null
      const maxTokens = effectivePlan?.maxAiTokens ?? null
      const remainingTokens = maxTokens == null ? null : Math.max(0, maxTokens - usedTokens)
      const progressPercent = maxTokens == null || maxTokens <= 0
        ? 0
        : Math.min(100, Math.round((usedTokens / maxTokens) * 100))

      setBillingAccount((accountResult.data || null) as BillingAccountRow | null)
      setSelectedTenantPlan(effectivePlan)
      setAiCycleUsage({
        usedTokens,
        maxTokens,
        remainingTokens,
        progressPercent,
        cycleStartIso: cycleStart.toISOString(),
        renewalDateIso: renewalDate.toISOString(),
      })
    } catch (error: any) {
      console.warn('Failed to load billing data', error)
      setCatalogPlans([])
      setBillingAccount(null)
      setSelectedTenantPlan(null)
      setAiCycleUsage(null)
    } finally {
      setIsLoadingBilling(false)
    }
  }, [selectedTenantId])

  const loadAiUsage = useCallback(async (tenantId: string) => {
    if (!tenantId) return
    setIsLoadingAiUsage(true)

    const tenantCreatedAt = tenants.find((tenant) => tenant.id === tenantId)?.created_at
    const anchorDay = tenantCreatedAt ? new Date(String(tenantCreatedAt)).getUTCDate() : 1
    const { cycleStart, renewalDate } = resolveTenantCycleWindow(new Date(), anchorDay)

    const { data, error } = await supabase
      .from('ai_usage_logs')
      .select('user_login, model, total_tokens, estimated_cost_usd, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', cycleStart.toISOString())
      .lt('created_at', renewalDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(500)

    if (!error) {
      setAiUsageLogs((data || []) as AiUsageRow[])
      setAiUsageWindow({
        cycleStartIso: cycleStart.toISOString(),
        renewalDateIso: renewalDate.toISOString(),
      })
    } else {
      setAiUsageWindow(null)
    }
    setIsLoadingAiUsage(false)
  }, [tenants])

  useEffect(() => {
    void loadTenants()
  }, [loadTenants])

  useEffect(() => {
    if (!selectedTenantId) return
    void loadAiUsage(selectedTenantId)
  }, [selectedTenantId, loadAiUsage])

  useEffect(() => {
    if (!selectedTenantId) return
    void loadBillingData()
  }, [selectedTenantId, loadBillingData])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const billingState = String(params.get('billing') || '').trim().toLowerCase()
    if (!billingState) return

    if (billingState === 'success') {
      toast.success(t.users_permissions_view.billing_checkout_started)
    } else if (billingState === 'cancelled') {
      toast.message(t.users_permissions_view.billing_checkout_cancelled)
    }

    if (billingState === 'upgrade' || billingState === 'success' || billingState === 'cancelled') {
      window.requestAnimationFrame(() => {
        billingCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }

    if (billingState !== 'upgrade') {
      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.delete('billing')
      window.history.replaceState({}, document.title, `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
    }
  }, [t.users_permissions_view.billing_checkout_cancelled, t.users_permissions_view.billing_checkout_started])

  const paidPlans = useMemo(
    () => catalogPlans.filter((plan) => plan.isActive && plan.code !== 'starter' && plan.priceMonthlyBrl != null),
    [catalogPlans]
  )

  const currentPlanCode = String(selectedTenantPlan?.planCode || tenantUsagePlan?.planCode || 'starter').toLowerCase()
  const currentPlanName = selectedTenantPlan?.planName || tenantUsagePlan?.planName || 'Starter'
  const isAiBlockedForPlan = selectedTenantPlan?.aiEnabled === false

  const handleStartCheckout = async (planCode: string) => {
    if (!selectedTenantId) {
      toast.error(t.users_permissions_view.billing_select_tenant_error)
      return
    }

    setIsStartingCheckout(planCode)
    try {
      const result = await createBillingCheckoutSession({
        tenantId: selectedTenantId,
        planCode,
      })

      window.location.href = result.checkoutUrl
    } catch (error: any) {
      toast.error(error?.message || 'Falha ao iniciar o checkout.')
    } finally {
      setIsStartingCheckout(null)
    }
  }

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
      <Card ref={billingCardRef}>
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
        <h2 className="text-3xl font-bold tracking-tight">{t.users_permissions_view.tenant_page_title}</h2>
        <p className="text-muted-foreground mt-1">
          {t.users_permissions_view.tenant_page_subtitle}
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
            <CurrencyDollar size={20} weight="duotone" />
            {t.users_permissions_view.billing_title}
          </CardTitle>
          <CardDescription>
            {t.users_permissions_view.billing_description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingBilling ? (
            <p className="text-sm text-muted-foreground">{t.users_permissions_view.billing_loading}</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t.users_permissions_view.billing_current_plan}</p>
                  <p className="text-xl font-semibold">{currentPlanName}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.users_permissions_view.billing_code}: {currentPlanCode}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t.users_permissions_view.billing_provider}</p>
                  <p className="text-xl font-semibold uppercase">{billingAccount?.provider || 'stripe'}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.users_permissions_view.billing_status}: {billingAccount?.subscription_status || t.users_permissions_view.billing_status_not_started}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{t.users_permissions_view.billing_current_period}</p>
                  <p className="text-xl font-semibold">
                    {billingAccount?.current_period_end ? new Date(billingAccount.current_period_end).toLocaleDateString() : t.users_permissions_view.billing_no_active_cycle}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{t.users_permissions_view.billing_tenant}: {selectedTenant?.name || selectedTenantId}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{t.users_permissions_view.billing_ai_cycle_usage_title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.users_permissions_view.billing_renewal}: {aiCycleUsage ? new Date(aiCycleUsage.renewalDateIso).toLocaleDateString() : '-'}
                  </p>
                </div>
                <Progress value={aiCycleUsage?.progressPercent ?? 0} className="h-2" />
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  {isAiBlockedForPlan ? (
                    <p className="font-medium">
                      {t.users_permissions_view.restricted_access}
                    </p>
                  ) : (
                    <>
                      <p className="font-medium">
                        {(aiCycleUsage?.usedTokens || 0).toLocaleString()} {t.users_permissions_view.billing_used_tokens}
                        {aiCycleUsage?.maxTokens != null ? ` ${t.users_permissions_view.billing_of} ${aiCycleUsage.maxTokens.toLocaleString()}` : ` (${t.usage_plans_view.unlimited})`}
                      </p>
                      <p className="text-muted-foreground">
                        {aiCycleUsage?.remainingTokens != null
                          ? `${aiCycleUsage.remainingTokens.toLocaleString()} ${t.users_permissions_view.billing_remaining_tokens}`
                          : t.users_permissions_view.billing_no_monthly_limit}
                      </p>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.users_permissions_view.billing_cycle_period}: {aiCycleUsage ? new Date(aiCycleUsage.cycleStartIso).toLocaleDateString() : '-'} {t.users_permissions_view.billing_until} {aiCycleUsage ? new Date(aiCycleUsage.renewalDateIso).toLocaleDateString() : '-'}.
                </p>
              </div>

              {paidPlans.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.users_permissions_view.billing_no_paid_plans}</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {paidPlans.map((plan) => {
                    const planCode = String(plan.code)
                    const isCurrent = currentPlanCode === planCode.toLowerCase()
                    const isBusy = isStartingCheckout === planCode
                    return (
                      <div key={planCode} className="rounded-lg border border-border p-4 space-y-3">
                        <div>
                          <p className="font-semibold">{plan.name}</p>
                          <p className="text-sm text-muted-foreground">{plan.description || t.users_permissions_view.billing_paid_plan_fallback}</p>
                        </div>
                        <p className="text-2xl font-bold">R$ {Number(plan.priceMonthlyBrl).toFixed(0)}<span className="text-sm font-normal text-muted-foreground"> {t.users_permissions_view.billing_per_month_suffix}</span></p>
                        <Button
                          onClick={() => void handleStartCheckout(planCode)}
                          disabled={isCurrent || !!isStartingCheckout}
                          className="w-full"
                        >
                          {isCurrent ? t.users_permissions_view.billing_current_plan : isBusy ? t.users_permissions_view.billing_redirecting : `${t.users_permissions_view.billing_subscribe} ${plan.name}`}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    void loadBillingData()
                    void reloadTenantUsagePlan()
                  }}
                >
                  {t.users_permissions_view.billing_refresh_status}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain size={20} weight="duotone" />
            {t.users_permissions_view.ai_usage_title}
          </CardTitle>
          <CardDescription>
            {t.users_permissions_view.ai_usage_current_period_summary} <strong>{selectedTenant?.name ?? selectedTenantId}</strong>.
            {aiUsageWindow && (
              <>
                {' '}{t.users_permissions_view.ai_usage_cycle_label}: {new Date(aiUsageWindow.cycleStartIso).toLocaleDateString()} {t.users_permissions_view.billing_until} {new Date(aiUsageWindow.renewalDateIso).toLocaleDateString()}.
              </>
            )}
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
                  {t.users_permissions_view.ai_usage_no_usage_current_period}
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
