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
import InspectionsView from './components/views/InspectionsView'
import BugReportsView from './components/views/BugReportsView'
import MyBugReportsView from './components/views/MyBugReportsView'
import AuditLogsView from './components/views/AuditLogsView'
import AiAssistantView from './components/views/AiAssistantView'
import { Property, Transaction } from './types'
import { Toaster } from '@/components/ui/sonner'
import { LanguageProvider, useLanguage } from '@/lib/LanguageContext'
import { CurrencyProvider, useCurrency } from '@/lib/CurrencyContext'
import { NumberFormatProvider } from '@/lib/NumberFormatContext'
import { PhoneFormatProvider } from '@/lib/PhoneFormatContext'
import { DateFormatProvider } from '@/lib/DateFormatContext'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { ThemeProvider } from '@/components/ThemeProvider'
import { UserInfo } from '@/components/UserInfo'
import { Login } from '@/components/Login'
import { HomePage } from '@/components/HomePage'
import { PendingApproval } from '@/components/PendingApproval'
import { Rejected } from '@/components/Rejected'
import { useKVCleanup } from '@/hooks/use-kv-cleanup'
import { usePropertyMigration } from '@/hooks/use-property-migration'
import { useUserPresence } from '@/hooks/use-user-presence'
import { AppSidebar } from '@/components/AppSidebar'
import { BugReportDialog } from '@/components/BugReportDialog'
import { useTheme } from 'next-themes'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

type TenantOption = {
  id: string
  name: string
}

function AuthCallbackPage() {
  const { t } = useLanguage()
  const {
    isLoading,
    isAuthenticated,
    isApproved,
    isPending,
    isRejected,
  } = useAuth()

  useEffect(() => {
    if (isLoading) return

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

    if (isAuthenticated || isApproved || isPending || isRejected || authError) {
      window.location.replace(destination.toString())
      return
    }

    window.location.replace(destination.toString())
  }, [isApproved, isAuthenticated, isLoading, isPending, isRejected])

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
  const { formatCurrency } = useCurrency()
  const { resolvedTheme } = useTheme()
  const {
    isApproved,
    isPending,
    isRejected,
    isLoading,
    isAdmin,
    isPlatformAdmin,
    isGuest,
    isAuthenticated,
    currentUser,
    currentTenantId,
    setSessionTenant,
  } = useAuth()
  const [properties] = useKV<Property[]>('properties', [])
  const [transactions] = useKV<Transaction[]>('transactions', [])
  const [showLogin, setShowLogin] = useState(false)
  const [activeTab, setActiveTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('tab') || (isGuest ? 'calendar' : 'properties')
  })
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
    'users-permissions': t.tabs['users-permissions'],
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
  
  const calculateCurrentMonthBalance = () => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    return (transactions || []).filter((transaction) => {
      const transactionDate = new Date(transaction.date)
      return transactionDate.getFullYear() === currentYear && transactionDate.getMonth() === currentMonth
    }).reduce((acc, t) => {
      return t.type === 'income' ? acc + t.amount : acc - t.amount
    }, 0)
  }

  const currentMonthBalance = calculateCurrentMonthBalance()

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

  if (isRejected) {
    return <Rejected />
  }

  if (!isAuthenticated && !showLogin) {
    return <HomePage onLoginClick={() => setShowLogin(true)} />
  }

  if (!isAuthenticated) {
    return <Login onBack={() => setShowLogin(false)} />
  }

  if (!isApproved && isPending) {
    return <PendingApproval />
  }

  if (!isApproved) {
    return <PendingApproval />
  }

  return (
    <div id="spark-app" className={`min-h-screen bg-background ${resolvedTheme === 'dark' ? 'dark-theme' : ''}`}>
      <Toaster />
      
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pinnedItems={pinnedItems || []}
        onPinnedItemsChange={setPinnedItems}
      />

      <div className="min-h-screen pl-20 flex flex-col">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {tabTitleMap[activeTab] || t.appName}
                </h1>
              </div>
              <div className="flex items-center gap-8">
                <BugReportDialog
                  activeTab={activeTab}
                  activeTabLabel={tabTitleMap[activeTab] || t.appName}
                  tabTitleMap={tabTitleMap}
                />
                {isPlatformAdmin && (
                  <div className="min-w-[260px]">
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
                <UserInfo />
                {isAdmin && (
                  <>
                    <div className="h-12 w-px bg-border" />
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        {t.balance} {new Date().toLocaleDateString(undefined, { month: 'short' })}
                      </p>
                      <p className={`text-2xl font-bold ${currentMonthBalance >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(currentMonthBalance)}
                      </p>
                    </div>
                    <div className="h-12 w-px bg-border" />
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t.properties}</p>
                      <p className="text-2xl font-bold text-foreground">{(properties || []).length}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-6 py-6">
          {activeTab === 'properties' && isAdmin && <PropertiesView />}
          {activeTab === 'owners' && isAdmin && <OwnersView />}
          {activeTab === 'finances' && isAdmin && <FinancesView />}
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'tasks' && isAdmin && <TasksView />}
          {activeTab === 'reports' && isAdmin && <ReportsView />}
          {activeTab === 'guests' && isAdmin && <GuestsView />}
          {activeTab === 'contracts' && <ContractsView onNavigate={setActiveTab} />}
          {activeTab === 'documents' && isAdmin && <DocumentsView />}
          {activeTab === 'ai-assistant' && isAdmin && <AiAssistantView />}
          {activeTab === 'inspections' && isAdmin && <InspectionsView />}
          {activeTab === 'templates' && isAdmin && <ContractTemplatesView />}
          {activeTab === 'notifications' && isAdmin && <NotificationsView />}
          {activeTab === 'providers' && isAdmin && <ServiceProvidersView />}
          {activeTab === 'appointments' && <AppointmentsView />}
          {activeTab === 'my-bug-reports' && isAdmin && !isPlatformAdmin && <MyBugReportsView />}
          {activeTab === 'bug-reports' && isPlatformAdmin && <BugReportsView />}
          {activeTab === 'users-permissions' && isAdmin && <UsersPermissionsView />}
          {activeTab === 'audit-logs' && isAdmin && <AuditLogsView />}
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

export default App
