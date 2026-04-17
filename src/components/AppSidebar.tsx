import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
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
  PushPin,
  Sidebar,
  CaretDoubleLeft,
  CaretDoubleRight
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
  collapsed: boolean
  onToggleCollapsed: () => void
  pinnedItems: string[]
}

export function AppSidebar({ activeTab, onTabChange, collapsed, onToggleCollapsed, pinnedItems }: AppSidebarProps) {
  const { isAdmin } = useAuth()
  const { t } = useLanguage()

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
        title={collapsed ? item.label : undefined}
        className={cn(
          "w-full flex items-center py-3 text-left transition-all duration-200 ease-out rounded-lg group relative overflow-hidden",
          collapsed ? "justify-center px-2" : "gap-3 px-4",
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
            "transition-all duration-200 ease-out",
            collapsed ? "scale-105" : "scale-100",
            isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
          )}
        />
        <span className={cn(
          "text-sm font-medium whitespace-nowrap transition-all duration-200 ease-out origin-left",
          collapsed ? "max-w-0 opacity-0 -translate-x-2" : "max-w-[180px] opacity-100 translate-x-0",
          isActive ? "text-primary-foreground" : ""
        )}>
            {item.label}
          </span>
      </button>
    )
  }

  return (
    <aside className={cn(
      "border-r border-border bg-card/50 backdrop-blur-sm flex flex-col h-screen sticky top-0 transition-[width] duration-300 ease-out",
      collapsed ? "w-20" : "w-64"
    )}>
      <div className={cn("border-b border-border transition-all duration-300 ease-out", collapsed ? "px-3 py-4" : "p-6")}>
        <div className={cn("flex items-start transition-all duration-300 ease-out", collapsed ? "justify-center" : "justify-between gap-3")}>
          <div className={cn(
            "transition-all duration-300 ease-out overflow-hidden",
            collapsed ? "max-w-0" : "max-w-[180px]"
          )}>
            {!collapsed && (
              <div className="animate-in fade-in-0 slide-in-from-left-1 duration-200">
                <h2 className="text-xl font-bold text-foreground whitespace-nowrap">{t.appName}</h2>
                <p className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">{t.appSubtitle}</p>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapsed}
            className={cn("shrink-0 transition-transform duration-200 ease-out", collapsed ? "ml-0" : "ml-2")}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <span className={cn("transition-transform duration-300 ease-out", collapsed ? "rotate-0" : "rotate-0")}>
              {collapsed ? <CaretDoubleRight size={18} /> : <CaretDoubleLeft size={18} />}
            </span>
          </Button>
        </div>
      </div>

      <ScrollArea className={cn("flex-1 py-4", collapsed ? "px-2" : "px-3")}>
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
