import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { useKV } from '@github/spark/hooks'
import { 
  House, 
  Wallet, 
  Calendar, 
  CheckSquare, 
  ChartBar, 
  User, 
  Gear, 
  Files, 
  Wrench, 
  CalendarCheck, 
  FileText, 
  Users,
  PushPin
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface MenuItem {
  id: string
  label: string
  icon: any
  value: string
  adminOnly?: boolean
}

export const menuItems: MenuItem[] = [
  { id: 'properties', label: 'Propriedades', icon: House, value: 'properties', adminOnly: true },
  { id: 'owners', label: 'Proprietários', icon: Users, value: 'owners', adminOnly: true },
  { id: 'finances', label: 'Finanças', icon: Wallet, value: 'finances', adminOnly: true },
  { id: 'calendar', label: 'Calendário', icon: Calendar, value: 'calendar' },
  { id: 'tasks', label: 'Tarefas', icon: CheckSquare, value: 'tasks', adminOnly: true },
  { id: 'reports', label: 'Relatórios', icon: ChartBar, value: 'reports', adminOnly: true },
  { id: 'guests', label: 'Hóspedes', icon: User, value: 'guests', adminOnly: true },
  { id: 'contracts', label: 'Contratos', icon: Files, value: 'contracts' },
  { id: 'templates', label: 'Templates', icon: FileText, value: 'templates', adminOnly: true },
  { id: 'providers', label: 'Prestadores', icon: Wrench, value: 'providers', adminOnly: true },
  { id: 'appointments', label: 'Compromissos', icon: CalendarCheck, value: 'appointments' },
  { id: 'settings', label: 'Configurações', icon: Gear, value: 'settings' },
]

interface AppSidebarProps {
  activeTab: string
  onTabChange: (value: string) => void
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const { isAdmin, currentUser } = useAuth()
  const { t } = useLanguage()
  const [pinnedItems] = useKV<string[]>(`pinned-items-${currentUser?.login}`, [])

  const visibleItems = menuItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false
    return true
  })

  const pinnedMenuItems = visibleItems.filter(item => pinnedItems?.includes(item.id))
  const unpinnedMenuItems = visibleItems.filter(item => !pinnedItems?.includes(item.id))

  const renderMenuItem = (item: MenuItem, isPinned: boolean) => {
    const Icon = item.icon
    const isActive = activeTab === item.value

    return (
      <button
        key={item.id}
        onClick={() => onTabChange(item.value)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left transition-all rounded-lg group",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "hover:bg-accent text-foreground"
        )}
      >
        {isPinned && (
          <PushPin 
            weight="fill" 
            size={12} 
            className={cn(
              "absolute left-1 top-1",
              isActive ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          />
        )}
        <Icon 
          weight={isActive ? "fill" : "duotone"} 
          size={20}
          className={cn(
            isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
          )}
        />
        <span className={cn(
          "text-sm font-medium",
          isActive ? "text-primary-foreground" : ""
        )}>
          {item.label}
        </span>
      </button>
    )
  }

  return (
    <aside className="w-64 border-r border-border bg-card/50 backdrop-blur-sm flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-bold text-foreground">{t.appName}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{t.appSubtitle}</p>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {pinnedMenuItems.length > 0 && (
            <>
              {pinnedMenuItems.map(item => (
                <div key={item.id} className="relative">
                  {renderMenuItem(item, true)}
                </div>
              ))}
              {unpinnedMenuItems.length > 0 && (
                <div className="h-px bg-border my-3" />
              )}
            </>
          )}
          {unpinnedMenuItems.map(item => (
            <div key={item.id} className="relative">
              {renderMenuItem(item, false)}
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  )
}
