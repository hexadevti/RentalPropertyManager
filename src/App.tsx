import { useKV } from '@/lib/useSupabaseKV'
import { useEffect, useState } from 'react'
import PropertiesView from './components/views/PropertiesView'
import FinancesView from './components/views/FinancesView'
import CalendarView from './components/views/CalendarView'
import TasksView from './components/views/TasksView'
import ReportsView from './components/views/ReportsView'
import GuestsView from './components/views/GuestsView'
import ContractsView from './components/views/ContractsView'
import DocumentsView from './components/views/DocumentsView'
import ContractTemplatesView from './components/views/ContractTemplatesView'
import NotificationsView from './components/views/NotificationsView'
import ServiceProvidersView from './components/views/ServiceProvidersView'
import AppointmentsView from './components/views/AppointmentsView'
import OwnersView from './components/views/OwnersView'
import UsersPermissionsView from './components/views/UsersPermissionsView'
import AccessProfilesView from './components/views/AccessProfilesView'
import TenantManagementView from './components/views/TenantManagementView'
import InspectionsView from './components/views/InspectionsView'
import BugReportsView from './components/views/BugReportsView'
import MyBugReportsView from './components/views/MyBugReportsView'
import ContactMessagesView from './components/views/ContactMessagesView'
import WhatsAppBotView from './components/views/WhatsAppBotView'
import AuditLogsView from './components/views/AuditLogsView'
import AiAssistantView from './components/views/AiAssistantView'
import UsagePlansView from './components/views/UsagePlansView'
import { Toaster } from '@/components/ui/sonner'
import { LanguageProvider, useLanguage } from '@/lib/LanguageContext'
import { CurrencyProvider, useCurrency } from '@/lib/CurrencyContext'
import { NumberFormatProvider, useNumberFormat } from '@/lib/NumberFormatContext'
import { PhoneFormatProvider } from '@/lib/PhoneFormatContext'
import { DateFormatProvider, useDateFormat } from '@/lib/DateFormatContext'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { ThemeProvider } from '@/components/ThemeProvider'
import { UserInfo } from '@/components/UserInfo'
import { Login } from '@/components/Login'
import { HomePage } from '@/components/HomePage'
import { Blocked } from '@/components/Rejected'
import { PasswordRecoveryForm } from '@/components/PasswordRecoveryForm'
import { useKVCleanup } from '@/hooks/use-kv-cleanup'
import { usePropertyMigration } from '@/hooks/use-property-migration'
import { useUserPresence } from '@/hooks/use-user-presence'
import { AppSidebar } from '@/components/AppSidebar'
import { useTheme } from 'next-themes'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { detectRegionalPreferenceDefaults } from '@/lib/regionalPreferences'
import { APP_TABS_BY_ACCESS_ROLE, EXTRA_ACCESS_CONTROLLED_TABS } from '@/lib/accessControl'
import type { AccessRoleId } from './types'

type TenantOption = {
  id: string
  name: string
}

function AuthCallbackPage() {
  const { t } = useLanguage()
  const {
    isLoading,
    isApproved,
    isPending,
    isBlocked,
  } = useAuth()
  const searchParams = new URLSearchParams(window.location.search)
  const isPasswordRecoveryMode = searchParams.get('mode') === 'reset-password'
  const [hasCheckedRecoverySession, setHasCheckedRecoverySession] = useState(false)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)

  useEffect(() => {
    if (!isPasswordRecoveryMode) return

    let isMounted = true
    const checkRecoverySession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!isMounted) return

      if (error) {
        console.error('Failed to load recovery session:', error)
      }

      setHasRecoverySession(!!data.session)
      setHasCheckedRecoverySession(true)
    }

    void checkRecoverySession()

    return () => {
      isMounted = false
    }
  }, [isPasswordRecoveryMode])

  useEffect(() => {
    if (isLoading || isPasswordRecoveryMode) return

    const destination = new URL(window.location.origin)
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const authError =
      searchParams.get('error_description')
      || searchParams.get('error')
      || hashParams.get('error_description')
      || hashParams.get('error')

    if (authError) {
      toast.error(authError)
    }

    if (isApproved || isPending || isBlocked || authError) {
      window.location.replace(destination.toString())
      return
    }

    window.location.replace(destination.toString())
  }, [isApproved, isBlocked, isLoading, isPasswordRecoveryMode, isPending])

  if (isPasswordRecoveryMode && (isLoading || !hasCheckedRecoverySession)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <p className="text-lg font-semibold">{t.appName}</p>
            <p className="text-muted-foreground">Validando link de redefinição...</p>
          </div>
        </div>
      </div>
    )
  }

  if (isPasswordRecoveryMode && !hasRecoverySession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-lg">
          <h1 className="text-xl font-semibold text-foreground">Link inválido ou expirado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Não foi possível criar a sessão de recuperação. Solicite um novo e-mail de redefinição de senha.
          </p>
        </div>
      </div>
    )
  }

  if (isPasswordRecoveryMode) {
    return <PasswordRecoveryForm />
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="space-y-1">
          <p className="text-lg font-semibold">{t.appName}</p>
          <p className="text-muted-foreground">{t.common.auth_redirecting}</p>
        </div>
      </div>
    </div>
  )
}

function AppContent() {
  const { t } = useLanguage()
  const { resolvedTheme } = useTheme()
  const {
    userProfile,
    isApproved,
    isBlocked,
    isLoading,
    isAdmin,
    isPlatformAdmin,
    isGuest,
    isAuthenticated,
    hasAccess,
    currentUser,
    currentTenantId,
    setSessionTenant,
  } = useAuth()
  const { signInWithEmail } = useAuth()
  const [showLogin, setShowLogin] = useState(false)
  const [isDemoLoggingIn, setIsDemoLoggingIn] = useState(false)

  const handleDemoLogin = async () => {
    setIsDemoLoggingIn(true)
    try {
      await signInWithEmail('demo@rpm.app', 'Demo@2026!')
    } catch {
      setShowLogin(true)
    } finally {
      setIsDemoLoggingIn(false)
    }
  }
  const hasInviteParam = new URLSearchParams(window.location.search).has('invite')
  const DEMO_TENANT_ID = 'aaaaaaaa-0000-4000-a000-000000000001'

  const [activeTab, setActiveTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('tab') || (isGuest ? 'calendar' : 'properties')
  })

  // Force 'properties' as landing tab for the demo tenant
  useEffect(() => {
    if (!currentTenantId) return
    if (currentTenantId === DEMO_TENANT_ID) {
      const params = new URLSearchParams(window.location.search)
      if (!params.get('tab')) setActiveTab('properties')
    }
  }, [currentTenantId])
  const [pinnedItems, setPinnedItems] = useKV<string[]>(`pinned-items-${currentUser?.login ?? 'anonymous'}`, [])
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([])
  const [isChangingTenant, setIsChangingTenant] = useState(false)
  const isAuthCallbackRoute = window.location.pathname === '/auth/callback'

  const tabTitleMap: Record<string, string> = {
    properties: t.tabs.properties,
    owners: t.tabs.owners,
    finances: t.tabs.finances,
    calendar: t.tabs.calendar,
    tasks: t.tabs.tasks,
    reports: t.tabs.reports,
    guests: t.tabs.guests,
    contracts: t.tabs.contracts,
    documents: t.tabs.documents,
    'ai-assistant': t.tabs['ai-assistant'],
    inspections: t.tabs.inspections,
    templates: t.tabs.templates,
    notifications: t.tabs.notifications,
    providers: t.tabs.providers,
    appointments: t.tabs.appointments,
    'bug-reports': t.tabs['bug-reports'],
    'my-bug-reports': t.tabs['my-bug-reports'],
    'contact-messages': t.tabs['contact-messages'],
    'usage-plans': t.tabs['usage-plans'] || 'Planos de uso',
    'users-permissions': t.tabs['users-permissions'],
    tenant: t.tabs.tenant,
    'access-profiles': 'Perfis de acesso',
    'audit-logs': t.tabs['audit-logs'],
  }
  
  useKVCleanup()
  usePropertyMigration()
  useUserPresence(activeTab, tabTitleMap[activeTab] || t.appName)

  useEffect(() => {
    const loadTenantsForMaster = async () => {
      if (!isPlatformAdmin) {
        setTenantOptions([])
        return
      }
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .order('created_at', { ascending: true })
      if (error) {
        console.warn('Failed to load tenant options:', error)
        return
      }
      setTenantOptions((data || []) as TenantOption[])
    }

    void loadTenantsForMaster()
  }, [isPlatformAdmin])
  
  const canRead = (roleId: AccessRoleId) => hasAccess(roleId, 'read')
  const canWrite = (roleId: AccessRoleId) => hasAccess(roleId, 'write')

  useEffect(() => {
    const roleBasedTabs = [
      ...(Object.entries(APP_TABS_BY_ACCESS_ROLE) as Array<[AccessRoleId, string]>)
        .filter(([roleId]) => canRead(roleId))
        .map(([, tab]) => tab),
      ...EXTRA_ACCESS_CONTROLLED_TABS
        .filter(({ roleId }) => canRead(roleId))
        .map(({ tab }) => tab),
    ]

    const specialTabs = [
      ...(isPlatformAdmin ? ['contact-messages', 'bug-reports', 'whatsapp-bot', 'usage-plans'] : []),
    ]

    const accessibleTabs = [...new Set([...roleBasedTabs, ...specialTabs])]

    if (!accessibleTabs.length) return
    if (!accessibleTabs.includes(activeTab)) {
      setActiveTab(accessibleTabs[0])
    }
  }, [activeTab, hasAccess, isAdmin, isPlatformAdmin])

  if (isAuthCallbackRoute) {
    return <AuthCallbackPage />
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (isBlocked) {
    return <Blocked />
  }

  if (isAuthenticated && !userProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated && !showLogin) {
    if (hasInviteParam) {
      return <Login onBack={() => {
        const nextUrl = new URL(window.location.href)
        nextUrl.searchParams.delete('invite')
        window.history.replaceState({}, document.title, `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
        setShowLogin(false)
      }} />
    }
    return <HomePage onLoginClick={() => setShowLogin(true)} onDemoClick={handleDemoLogin} isDemoLoggingIn={isDemoLoggingIn} />
  }

  if (!isAuthenticated) {
    return <Login onBack={() => {
      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.delete('invite')
      window.history.replaceState({}, document.title, `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
      setShowLogin(false)
    }} />
  }

  if (!isApproved) {
    return <Blocked />
  }

  return (
    <div id="rpm-app" className={`min-h-screen bg-background ${resolvedTheme === 'dark' ? 'dark-theme' : ''}`}>
      <Toaster />
      
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pinnedItems={pinnedItems || []}
        onPinnedItemsChange={setPinnedItems}
      />

      <div className="flex min-h-screen flex-col pb-24 md:pl-20 md:pb-0">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm md:sticky md:top-0 z-40">
          <div className="container mx-auto px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {tabTitleMap[activeTab] || t.appName}
                </h1>
              </div>
              <div className="flex flex-col gap-4 xl:items-end">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-end">
                {isPlatformAdmin && (
                  <div className="w-full min-w-0 xl:min-w-[260px]">
                    <p className="mb-1 text-xs text-muted-foreground font-medium uppercase tracking-wider">Tenant da Sessao</p>
                    <Select
                      value={currentTenantId || ''}
                      onValueChange={async (value) => {
                        if (!value || value === currentTenantId) return
                        setIsChangingTenant(true)
                        try {
                          await setSessionTenant(value)
                          const selected = tenantOptions.find((tenant) => tenant.id === value)
                          toast.success(`Sessao alterada para tenant: ${selected?.name || value}`)
                        } catch (error: any) {
                          toast.error(error?.message || 'Falha ao alterar tenant da sessao')
                        } finally {
                          setIsChangingTenant(false)
                        }
                      }}
                      disabled={isChangingTenant || tenantOptions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um tenant" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenantOptions.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <UserInfo
                  activeTab={activeTab}
                  activeTabLabel={tabTitleMap[activeTab] || t.appName}
                  tabTitleMap={tabTitleMap}
                />
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto flex-1 px-4 py-6 sm:px-6">
          {activeTab === 'properties' && canRead('properties') && <PropertiesView readOnly={!canWrite('properties')} />}
          {activeTab === 'owners' && canRead('owners') && <OwnersView />}
          {activeTab === 'finances' && canRead('finances') && <FinancesView />}
          {activeTab === 'calendar' && canRead('calendar') && <CalendarView />}
          {activeTab === 'tasks' && canRead('tasks') && <TasksView />}
          {activeTab === 'reports' && canRead('reports') && <ReportsView />}
          {activeTab === 'guests' && canRead('guests') && <GuestsView />}
          {activeTab === 'contracts' && canRead('contracts') && <ContractsView onNavigate={setActiveTab} />}
          {activeTab === 'documents' && canRead('documents') && <DocumentsView />}
          {activeTab === 'ai-assistant' && canRead('ai-assistant') && <AiAssistantView />}
          {activeTab === 'inspections' && canRead('inspections') && <InspectionsView />}
          {activeTab === 'templates' && canRead('templates') && <ContractTemplatesView />}
          {activeTab === 'notifications' && canRead('notifications') && <NotificationsView />}
          {activeTab === 'providers' && canRead('providers') && <ServiceProvidersView />}
          {activeTab === 'appointments' && canRead('appointments') && <AppointmentsView />}
          {activeTab === 'my-bug-reports' && canRead('my-bug-reports') && !isPlatformAdmin && <MyBugReportsView />}
          {activeTab === 'contact-messages' && isPlatformAdmin && <ContactMessagesView />}
          {activeTab === 'bug-reports' && isPlatformAdmin && <BugReportsView />}
          {activeTab === 'whatsapp-bot' && isPlatformAdmin && <WhatsAppBotView />}
          {activeTab === 'usage-plans' && isPlatformAdmin && <UsagePlansView />}
          {activeTab === 'tenant' && canRead('tenant') && <TenantManagementView />}
          {activeTab === 'users-permissions' && canRead('users-permissions') && <UsersPermissionsView />}
          {activeTab === 'access-profiles' && canRead('access-profiles') && <AccessProfilesView readOnly={!canWrite('access-profiles')} />}
          {activeTab === 'audit-logs' && canRead('audit-logs') && <AuditLogsView />}
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LanguageProvider>
          <CurrencyProvider>
            <NumberFormatProvider>
              <PhoneFormatProvider>
                <DateFormatProvider>
                  <RegionalPreferenceBootstrap />
                  <AppContent />
                </DateFormatProvider>
              </PhoneFormatProvider>
            </NumberFormatProvider>
          </CurrencyProvider>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

function RegionalPreferenceBootstrap() {
  const { currentUser } = useAuth()
  const { setLanguage } = useLanguage()
  const { setCurrency } = useCurrency()
  const { setDateFormat } = useDateFormat()
  const { setDecimalSeparator } = useNumberFormat()

  useEffect(() => {
    if (!currentUser?.id) return

    let isMounted = true

    const syncMissingSettings = async () => {
      const defaults = detectRegionalPreferenceDefaults()
      const trackedKeys = [
        'app-language',
        'app-currency',
        'app-date-format',
        'app-decimal-separator',
      ]

      const { data, error } = await supabase
        .from('user_settings')
        .select('key')
        .eq('auth_user_id', currentUser.id)
        .in('key', trackedKeys)

      if (!isMounted || error) return

      const existingKeys = new Set((data || []).map((row) => row.key))

      if (!existingKeys.has('app-language')) setLanguage(defaults.language)
      if (!existingKeys.has('app-currency')) setCurrency(defaults.currency)
      if (!existingKeys.has('app-date-format')) setDateFormat(defaults.dateFormat)
      if (!existingKeys.has('app-decimal-separator')) setDecimalSeparator(defaults.decimalSeparator)
    }

    void syncMissingSettings()

    return () => {
      isMounted = false
    }
  }, [currentUser?.id, setCurrency, setDateFormat, setDecimalSeparator, setLanguage])

  return null
}

export default App
