import { useKV } from '@github/spark/hooks'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { House, Wallet, Calendar, CheckSquare, FileText, ChartBar, Gear } from '@phosphor-icons/react'
import PropertiesView from './components/views/PropertiesView'
import FinancesView from './components/views/FinancesView'
import CalendarView from './components/views/CalendarView'
import TasksView from './components/views/TasksView'
import DocumentsView from './components/views/DocumentsView'
import ReportsView from './components/views/ReportsView'
import SettingsView from './components/views/SettingsView'
import { Property, Transaction } from './types'
import { Toaster } from '@/components/ui/sonner'
import { LanguageProvider, useLanguage } from '@/lib/LanguageContext'

function AppContent() {
  const { t } = useLanguage()
  const [properties] = useKV<Property[]>('properties', [])
  const [transactions] = useKV<Transaction[]>('transactions', [])
  
  const calculateBalance = () => {
    return (transactions || []).reduce((acc, t) => {
      return t.type === 'income' ? acc + t.amount : acc - t.amount
    }, 0)
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{t.appName}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{t.appSubtitle}</p>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t.balance}</p>
                <p className={`text-2xl font-bold ${calculateBalance() >= 0 ? 'text-success' : 'text-destructive'}`}>
                  ${calculateBalance().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t.properties}</p>
                <p className="text-2xl font-bold text-foreground">{(properties || []).length}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <Tabs defaultValue="properties" className="w-full">
          <TabsList className="grid w-full grid-cols-7 h-auto p-1 bg-card border border-border">
            <TabsTrigger value="properties" className="flex items-center gap-2 py-3">
              <House weight="duotone" size={20} />
              <span className="hidden sm:inline">{t.tabs.properties}</span>
            </TabsTrigger>
            <TabsTrigger value="finances" className="flex items-center gap-2 py-3">
              <Wallet weight="duotone" size={20} />
              <span className="hidden sm:inline">{t.tabs.finances}</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2 py-3">
              <Calendar weight="duotone" size={20} />
              <span className="hidden sm:inline">{t.tabs.calendar}</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2 py-3">
              <CheckSquare weight="duotone" size={20} />
              <span className="hidden sm:inline">{t.tabs.tasks}</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2 py-3">
              <FileText weight="duotone" size={20} />
              <span className="hidden sm:inline">{t.tabs.documents}</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2 py-3">
              <ChartBar weight="duotone" size={20} />
              <span className="hidden sm:inline">{t.tabs.reports}</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 py-3">
              <Gear weight="duotone" size={20} />
              <span className="hidden sm:inline">{t.tabs.settings}</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="properties" className="mt-0">
              <PropertiesView />
            </TabsContent>
            <TabsContent value="finances" className="mt-0">
              <FinancesView />
            </TabsContent>
            <TabsContent value="calendar" className="mt-0">
              <CalendarView />
            </TabsContent>
            <TabsContent value="tasks" className="mt-0">
              <TasksView />
            </TabsContent>
            <TabsContent value="documents" className="mt-0">
              <DocumentsView />
            </TabsContent>
            <TabsContent value="reports" className="mt-0">
              <ReportsView />
            </TabsContent>
            <TabsContent value="settings" className="mt-0">
              <SettingsView />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  )
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  )
}

export default App
