import { useKV } from '@/lib/useSupabaseKV'
import { useState } from 'react'
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
import { Property, Transaction } from './types'
import { Toaster } from '@/components/ui/sonner'
import { LanguageProvider, useLanguage } from '@/lib/LanguageContext'
import { CurrencyProvider, useCurrency } from '@/lib/CurrencyContext'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { UserInfo } from '@/components/UserInfo'
import { Login } from '@/components/Login'
import { PendingApproval } from '@/components/PendingApproval'
import { Rejected } from '@/components/Rejected'
import { useKVCleanup } from '@/hooks/use-kv-cleanup'
import { usePropertyMigration } from '@/hooks/use-property-migration'
import { AppSidebar } from '@/components/AppSidebar'

function AppContent() {
  const { t } = useLanguage()
  const { formatCurrency } = useCurrency()
  const { isApproved, isPending, isRejected, isLoading, isAdmin, isGuest, isAuthenticated, currentUser } = useAuth()
  const [properties] = useKV<Property[]>('properties', [])
  const [transactions] = useKV<Transaction[]>('transactions', [])
  const [activeTab, setActiveTab] = useState<string>(isGuest ? 'calendar' : 'properties')
  const [pinnedItems] = useKV<string[]>(`pinned-items-${currentUser?.login ?? 'anonymous'}`, [])
  const [sidebarCollapsed, setSidebarCollapsed] = useKV<boolean>(`sidebar-collapsed-${currentUser?.login ?? 'anonymous'}`, false)
  
  useKVCleanup()
  usePropertyMigration()
  
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

  if (!isAuthenticated) {
    return <Login />
  }

  if (!isApproved && isPending) {
    return <PendingApproval />
  }

  if (!isApproved) {
    return <PendingApproval />
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Toaster />
      
      <AppSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        pinnedItems={pinnedItems || []}
      />

      <div className="flex-1 flex flex-col">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {activeTab === 'properties' && 'Propriedades'}
                  {activeTab === 'owners' && 'Proprietários'}
                  {activeTab === 'finances' && 'Finanças'}
                  {activeTab === 'calendar' && 'Calendário'}
                  {activeTab === 'tasks' && 'Tarefas'}
                  {activeTab === 'reports' && 'Relatórios'}
                  {activeTab === 'guests' && 'Hóspedes'}
                  {activeTab === 'contracts' && 'Contratos'}
                  {activeTab === 'templates' && 'Templates'}
                  {activeTab === 'providers' && 'Prestadores'}
                  {activeTab === 'appointments' && 'Compromissos'}
                  {activeTab === 'settings' && 'Configurações'}
                </h1>
              </div>
              <div className="flex items-center gap-8">
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
          {activeTab === 'contracts' && <ContractsView />}
          {activeTab === 'templates' && isAdmin && <ContractTemplatesView />}
          {activeTab === 'providers' && isAdmin && <ServiceProvidersView />}
          {activeTab === 'appointments' && <AppointmentsView />}
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
          <AppContent />
        </CurrencyProvider>
      </LanguageProvider>
    </AuthProvider>
  )
}

export default App
