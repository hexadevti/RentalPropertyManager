import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { fetchUsagePlanCatalog, type UsagePlanCatalogItem } from '@/lib/usagePlans'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { CurrencyDollar, CheckCircle } from '@phosphor-icons/react'

type TenantOption = {
  id: string
  name: string
}

type TenantPlanRow = {
  tenant_id: string
  plan_code: string
  custom_max_properties: number | null
  custom_max_users: number | null
  custom_max_ai_tokens: number | null
  notes: string | null
}

function toNullablePositiveInt(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

export default function UsagePlansView() {
  const { isPlatformAdmin, currentTenantId, reloadTenantUsagePlan } = useAuth()
  const { t } = useLanguage()

  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [plans, setPlans] = useState<UsagePlanCatalogItem[]>([])
  const [selectedPlanCode, setSelectedPlanCode] = useState('starter')
  const [planMaxAiTokens, setPlanMaxAiTokens] = useState('')
  const [planAiEnabled, setPlanAiEnabled] = useState<'enabled' | 'blocked'>('enabled')
  const [customMaxProperties, setCustomMaxProperties] = useState('')
  const [customMaxUsers, setCustomMaxUsers] = useState('')
  const [customMaxAiTokens, setCustomMaxAiTokens] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingPlanCatalog, setIsSavingPlanCatalog] = useState(false)

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.code === selectedPlanCode) || null,
    [plans, selectedPlanCode]
  )

  const loadTenants = useCallback(async () => {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name')
      .order('created_at', { ascending: true })

    if (error) {
      toast.error(error.message || t.usage_plans_view.load_tenants_error)
      return
    }

    const next = (data || []) as TenantOption[]
    setTenants(next)
    setSelectedTenantId((current) => current || currentTenantId || next[0]?.id || '')
  }, [currentTenantId, t.usage_plans_view.load_tenants_error])

  const loadPlans = useCallback(async () => {
    try {
      const catalog = await fetchUsagePlanCatalog()
      setPlans(catalog)
      setSelectedPlanCode((current) => current || catalog[0]?.code || 'starter')
    } catch (error: any) {
      toast.error(error?.message || t.usage_plans_view.load_catalog_error)
    }
  }, [t.usage_plans_view.load_catalog_error])

  const loadTenantPlan = useCallback(async (tenantId: string) => {
    if (!tenantId) return
    const { data, error } = await supabase
      .from('tenant_usage_plans')
      .select('tenant_id, plan_code, custom_max_properties, custom_max_users, custom_max_ai_tokens, notes')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) {
      toast.error(error.message || t.usage_plans_view.load_tenant_plan_error)
      return
    }

    const row = (data || null) as TenantPlanRow | null
    if (!row) {
      setSelectedPlanCode('starter')
      setCustomMaxProperties('')
      setCustomMaxUsers('')
      setCustomMaxAiTokens('')
      setNotes('')
      return
    }

    setSelectedPlanCode(row.plan_code)
    setCustomMaxProperties(row.custom_max_properties ? String(row.custom_max_properties) : '')
    setCustomMaxUsers(row.custom_max_users ? String(row.custom_max_users) : '')
    setCustomMaxAiTokens(row.custom_max_ai_tokens ? String(row.custom_max_ai_tokens) : '')
    setNotes(row.notes || '')
  }, [])

  useEffect(() => {
    if (!isPlatformAdmin) return

    let canceled = false
    const run = async () => {
      setIsLoading(true)
      await Promise.all([loadTenants(), loadPlans()])
      if (!canceled) setIsLoading(false)
    }

    void run()
    return () => { canceled = true }
  }, [isPlatformAdmin, loadTenants, loadPlans])

  useEffect(() => {
    if (!selectedTenantId) return
    void loadTenantPlan(selectedTenantId)
  }, [selectedTenantId, loadTenantPlan])

  useEffect(() => {
    setPlanMaxAiTokens(selectedPlan?.maxAiTokens ? String(selectedPlan.maxAiTokens) : '')
    setPlanAiEnabled(selectedPlan?.aiEnabled === false ? 'blocked' : 'enabled')
  }, [selectedPlan])

  const handleSave = async () => {
    if (!selectedTenantId) {
      toast.error(t.usage_plans_view.select_tenant_error)
      return
    }

    if (!selectedPlanCode) {
      toast.error(t.usage_plans_view.select_plan_error)
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        tenant_id: selectedTenantId,
        plan_code: selectedPlanCode,
        custom_max_properties: toNullablePositiveInt(customMaxProperties),
        custom_max_users: toNullablePositiveInt(customMaxUsers),
        custom_max_ai_tokens: toNullablePositiveInt(customMaxAiTokens),
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('tenant_usage_plans')
        .upsert(payload, { onConflict: 'tenant_id' })

      if (error) throw error

      toast.success(t.usage_plans_view.save_success)
      if (selectedTenantId === currentTenantId) {
        await reloadTenantUsagePlan()
      }
    } catch (error: any) {
      toast.error(error?.message || t.usage_plans_view.save_error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSavePlanCatalog = async () => {
    if (!selectedPlanCode) {
      toast.error(t.usage_plans_view.select_plan_error)
      return
    }

    setIsSavingPlanCatalog(true)
    try {
      const { error } = await supabase
        .from('usage_plans')
        .update({
          max_ai_tokens: toNullablePositiveInt(planMaxAiTokens),
          ai_enabled: planAiEnabled === 'enabled',
          updated_at: new Date().toISOString(),
        })
        .eq('code', selectedPlanCode)

      if (error) throw error

      setPlans((current) => current.map((plan) => (
        plan.code === selectedPlanCode
          ? { ...plan, maxAiTokens: toNullablePositiveInt(planMaxAiTokens), aiEnabled: planAiEnabled === 'enabled' }
          : plan
      )))

      toast.success(t.usage_plans_view.save_plan_ai_settings_success)
    } catch (error: any) {
      toast.error(error?.message || t.usage_plans_view.save_plan_ai_settings_error)
    } finally {
      setIsSavingPlanCatalog(false)
    }
  }

  const handlePlanCardSelect = (planCode: string) => {
    setSelectedPlanCode(planCode)
    // Reset overrides so selected plan baseline values are applied.
    setCustomMaxProperties('')
    setCustomMaxUsers('')
    setCustomMaxAiTokens('')
    setNotes('')
  }

  if (!isPlatformAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.usage_plans_view.title}</CardTitle>
          <CardDescription>{t.usage_plans_view.restricted_access}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t.usage_plans_view.title}</h2>
        <p className="text-muted-foreground mt-1">{t.usage_plans_view.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CurrencyDollar size={20} weight="duotone" />
            {t.usage_plans_view.card_title}
          </CardTitle>
          <CardDescription>
            {t.usage_plans_view.card_description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.usage_plans_view.tenant_label}</Label>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId} disabled={isLoading || tenants.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={t.usage_plans_view.tenant_placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.usage_plans_view.plan_label}</Label>
              <Select value={selectedPlanCode} onValueChange={setSelectedPlanCode} disabled={plans.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={t.usage_plans_view.plan_placeholder} />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.code} value={plan.code}>{plan.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium">{t.usage_plans_view.plan_config_title}</p>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label>{t.usage_plans_view.ai_feature_access_label}</Label>
                <Select value={planAiEnabled} onValueChange={(value: 'enabled' | 'blocked') => setPlanAiEnabled(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enabled">{t.usage_plans_view.ai_feature_enabled}</SelectItem>
                    <SelectItem value="blocked">{t.usage_plans_view.ai_feature_blocked}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.usage_plans_view.plan_max_ai_tokens_catalog}</Label>
                <Input
                  value={planMaxAiTokens}
                  onChange={(event) => setPlanMaxAiTokens(event.target.value)}
                  placeholder={t.usage_plans_view.unlimited}
                />
              </div>
              <Button onClick={handleSavePlanCatalog} disabled={isSavingPlanCatalog || !selectedPlanCode}>
                {isSavingPlanCatalog ? t.usage_plans_view.saving : t.usage_plans_view.save_plan_ai_settings}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>{t.usage_plans_view.max_properties_override}</Label>
              <Input
                value={customMaxProperties}
                onChange={(event) => setCustomMaxProperties(event.target.value)}
                placeholder={selectedPlan?.maxProperties ? String(selectedPlan.maxProperties) : t.usage_plans_view.unlimited}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.usage_plans_view.max_users_override}</Label>
              <Input
                value={customMaxUsers}
                onChange={(event) => setCustomMaxUsers(event.target.value)}
                placeholder={selectedPlan?.maxUsers ? String(selectedPlan.maxUsers) : t.usage_plans_view.unlimited}
              />
            </div>
            <div className="space-y-2">
              <Label>{t.usage_plans_view.max_ai_tokens_override}</Label>
              <Input
                value={customMaxAiTokens}
                onChange={(event) => setCustomMaxAiTokens(event.target.value)}
                placeholder={selectedPlan?.maxAiTokens ? String(selectedPlan.maxAiTokens) : t.usage_plans_view.unlimited}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.usage_plans_view.internal_notes}</Label>
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t.usage_plans_view.internal_notes_placeholder} />
          </div>

          <Button onClick={handleSave} disabled={isSaving || !selectedTenantId}>
            {isSaving ? t.usage_plans_view.saving : t.usage_plans_view.save}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const isSelected = plan.code === selectedPlanCode
          return (
            <Card
              key={plan.code}
              role="button"
              tabIndex={0}
              onClick={() => handlePlanCardSelect(plan.code)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handlePlanCardSelect(plan.code)
                }
              }}
              className={isSelected ? 'border-primary shadow-sm cursor-pointer' : 'cursor-pointer hover:border-primary/40'}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {isSelected && <Badge>{t.usage_plans_view.selected}</Badge>}
                </div>
                <CardDescription>{plan.description || '-'}</CardDescription>
                <div className="text-3xl font-bold">
                  {plan.priceMonthlyBrl == null ? t.usage_plans_view.on_request : `R$ ${plan.priceMonthlyBrl.toFixed(0)}`}
                  {plan.priceMonthlyBrl == null ? '' : <span className="text-base font-normal text-muted-foreground"> {t.usage_plans_view.per_month_suffix}</span>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t.usage_plans_view.properties_count}: {plan.maxProperties ?? t.usage_plans_view.unlimited} | {t.usage_plans_view.users_count}: {plan.maxUsers ?? t.usage_plans_view.unlimited}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t.usage_plans_view.ai_tokens_per_month_label}: {plan.maxAiTokens?.toLocaleString() ?? t.usage_plans_view.unlimited}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t.usage_plans_view.ai_status_label}: {plan.aiEnabled === false ? t.usage_plans_view.ai_feature_blocked : t.usage_plans_view.ai_feature_enabled}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {plan.featureHighlights.map((feature) => (
                  <div key={`${plan.code}-${feature}`} className="flex items-start gap-2 text-sm">
                    <CheckCircle size={16} className="mt-0.5 text-primary" weight="fill" />
                    <span>{feature}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
