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
  PushPin
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface MenuItem {
  id: string
  icon: any
  value: string
  adminOnly?: boolean
}

export const menuItems: MenuItem[] = [
  { id: 'properties', icon: House, value: 'properties', adminOnly: true },
  { id: 'owners', icon: Users, value: 'owners', adminOnly: true },
  { id: 'finances', icon: Wallet, value: 'finances', adminOnly: true },
  { id: 'calendar', icon: Calendar, value: 'calendar' },
  { id: 'tasks', icon: CheckSquare, value: 'tasks', adminOnly: true },
  { id: 'reports', icon: ChartBar, value: 'reports', adminOnly: true },
  { id: 'guests', icon: User, value: 'guests', adminOnly: true },
  { id: 'contracts', icon: Files, value: 'contracts' },
  { id: 'templates', icon: FileText, value: 'templates', adminOnly: true },
  { id: 'providers', icon: Wrench, value: 'providers', adminOnly: true },
  { id: 'appointments', icon: CalendarCheck, value: 'appointments' },
  { id: 'settings', icon: Gear, value: 'settings' },
]

interface AppSidebarProps {
  activeTab: string
  onTabChange: (value: string) => void
  pinnedItems: string[]
}

export function AppSidebar({ activeTab, onTabChange, pinnedItems }: AppSidebarProps) {
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
    const label = t.tabs[item.value as keyof typeof t.tabs] || item.value
    const isActive = activeTab === item.value

    return (
      <button
        key={item.id}
        onClick={() => onTabChange(item.value)}
        title={label}
        className={cn(
          "w-full flex items-center py-3 text-left transition-all duration-200 ease-out rounded-lg group relative overflow-hidden",
          "justify-center px-2",
          "group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-4",
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
            "scale-105 group-hover/sidebar:scale-100",
            isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
          )}
        />
        <span className={cn(
          "text-sm font-medium whitespace-nowrap transition-all duration-200 ease-out origin-left",
          "max-w-0 opacity-0 -translate-x-2",
          "group-hover/sidebar:max-w-[180px] group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0",
          isActive ? "text-primary-foreground" : ""
        )}>
            {label}
          </span>
      </button>
    )
  }

  return (
    <aside className={cn(
      "group/sidebar fixed left-0 top-0 z-50 border-r border-border bg-card/50 backdrop-blur-sm flex flex-col h-screen",
      "w-20 hover:w-64 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
    )}>
      <div className="border-b border-border h-20 px-3">
        <div className="h-full flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center transition-[margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] mx-auto group-hover/sidebar:mx-0">
            <House size={24} weight="duotone" className="text-primary" />
          </div>

          <div className="min-w-0 overflow-hidden">
            <h2 className="text-xl font-bold text-foreground whitespace-nowrap max-w-0 opacity-0 -translate-x-2 transition-all duration-300 ease-out group-hover/sidebar:max-w-[180px] group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0">
              {t.appName}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap max-w-0 opacity-0 -translate-x-2 transition-all duration-300 ease-out group-hover/sidebar:max-w-[180px] group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0">
              {t.appSubtitle}
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 py-4 px-2 transition-all duration-300 ease-out group-hover/sidebar:px-3">
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
