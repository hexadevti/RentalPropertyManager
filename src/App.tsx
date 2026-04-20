import { useKV } from '@/lib/useSupabaseKV'
import { useEffect, useState } from 'react'
import { House, Wallet, Calendar, CheckSquare, ChartBar, User, Gear, Files, Wrench, CalendarCheck, FileText, Users } from '@phosphor-icons/react'
import PropertiesView from './components/views/PropertiesView'
import FinancesView from './components/views/FinancesView'
import CalendarView from './components/views/CalendarView'
import TasksView from './components/views/TasksView'
import ReportsView from './components/views/ReportsView'
import GuestsView from './components/views/GuestsView'
import ContractsView from './components/views/ContractsView'
import ContractTemplatesView from './components/views/ContractTemplatesView'
import ServiceProvidersView from './components/views/ServiceProvidersView'
import AppointmentsView from './components/views/AppointmentsView'
import OwnersView from './components/views/OwnersView'
import SettingsView from './components/views/SettingsView'
import UsersPermissionsView from './components/views/UsersPermissionsView'
import InspectionsView from './components/views/InspectionsView'
import { Property, Transaction } from './types'
import { Toaster } from '@/components/ui/sonner'
import { LanguageProvider, useLanguage } from '@/lib/LanguageContext'
import { CurrencyProvider, useCurrency } from '@/lib/CurrencyContext'
import { DateFormatProvider } from '@/lib/DateFormatContext'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { UserInfo } from '@/components/UserInfo'
import { Login } from '@/components/Login'
import { HomePage } from '@/components/HomePage'
import { PendingApproval } from '@/components/PendingApproval'
import { Rejected } from '@/components/Rejected'
import { useKVCleanup } from '@/hooks/use-kv-cleanup'
import { usePropertyMigration } from '@/hooks/use-property-migration'
import { AppSidebar } from '@/components/AppSidebar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

type TenantOption = {
  id: string
  name: string
}

function AppContent() {
  const { t } = useLanguage()
  const { formatCurrency } = useCurrency()
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
  const [activeTab, setActiveTab] = useState<string>(isGuest ? 'calendar' : 'properties')
  const [pinnedItems] = useKV<string[]>(`pinned-items-${currentUser?.login ?? 'anonymous'}`, [])
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([])
  const [isChangingTenant, setIsChangingTenant] = useState(false)

  const tabTitleMap: Record<string, string> = {
    properties: t.tabs.properties,
    owners: t.tabs.owners,
    finances: t.tabs.finances,
    calendar: t.tabs.calendar,
    tasks: t.tabs.tasks,
    reports: t.tabs.reports,
    guests: t.tabs.guests,
    contracts: t.tabs.contracts,
    inspections: t.tabs.inspections,
    templates: t.tabs.templates,
    providers: t.tabs.providers,
    appointments: t.tabs.appointments,
    'users-permissions': t.tabs['users-permissions'],
    settings: t.tabs.settings,
  }
  
  useKVCleanup()
  usePropertyMigration()

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
  
  const calculateBalance = () => {
    return (transactions || []).reduce((acc, t) => {
      return t.type === 'income' ? acc + t.amount : acc - t.amount
    }, 0)
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
    <div className="min-h-screen bg-background">
      <Toaster />
      
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pinnedItems={pinnedItems || []}
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
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t.balance}</p>
                      <p className={`text-2xl font-bold ${calculateBalance() >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(calculateBalance())}
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
          {activeTab === 'inspections' && isAdmin && <InspectionsView />}
          {activeTab === 'templates' && isAdmin && <ContractTemplatesView />}
          {activeTab === 'providers' && isAdmin && <ServiceProvidersView />}
          {activeTab === 'appointments' && <AppointmentsView />}
          {activeTab === 'users-permissions' && isAdmin && <UsersPermissionsView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <CurrencyProvider>
          <DateFormatProvider>
            <AppContent />
          </DateFormatProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </AuthProvider>
  )
}

export default App
