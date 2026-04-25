import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import logo1 from '@/assets/logo1.PNG'
import logoFull from '@/assets/rpm-go-tranparent.png'
import type { AccessRoleId } from '@/types'
import {
  Wallet,
  Calendar,
  CheckSquare,
  ChartBar,
  User,
  BuildingOffice,
  Files,
  Wrench,
  CalendarCheck,
  FileText,
  Users,
  House,
  ShieldCheck,
  PushPin,
  PushPinSlash,
  ClipboardText,
  FolderOpen,
  Bug,
  ChatCircleDots,
  WhatsappLogo,
  ClockCounterClockwise,
  Bell,
  ArrowUp,
  ArrowDown,
  Brain,
  ArrowSquareUpRightIcon,
  DotsThreeOutline
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

export interface MenuItem {
  id: string
  icon: any
  value: string
  accessRoleId?: AccessRoleId
  adminOnly?: boolean
  platformAdminOnly?: boolean
  regularAdminOnly?: boolean
}

export const menuItems: MenuItem[] = [
  { id: 'properties', icon: House, value: 'properties', accessRoleId: 'properties' },
  { id: 'owners', icon: Users, value: 'owners', accessRoleId: 'owners' },
  { id: 'finances', icon: Wallet, value: 'finances', accessRoleId: 'finances' },
  { id: 'calendar', icon: Calendar, value: 'calendar', accessRoleId: 'calendar' },
  { id: 'tasks', icon: CheckSquare, value: 'tasks', accessRoleId: 'tasks' },
  { id: 'reports', icon: ChartBar, value: 'reports', accessRoleId: 'reports' },
  { id: 'guests', icon: User, value: 'guests', accessRoleId: 'guests' },
  { id: 'contracts', icon: Files, value: 'contracts', accessRoleId: 'contracts' },
  { id: 'documents', icon: FolderOpen, value: 'documents', accessRoleId: 'documents' },
  { id: 'ai-assistant', icon: Brain, value: 'ai-assistant', accessRoleId: 'ai-assistant' },
  { id: 'inspections', icon: ClipboardText, value: 'inspections', accessRoleId: 'inspections' },
  { id: 'templates', icon: FileText, value: 'templates', accessRoleId: 'templates' },
  { id: 'notifications', icon: Bell, value: 'notifications', accessRoleId: 'notifications' },
  { id: 'providers', icon: Wrench, value: 'providers', accessRoleId: 'providers' },
  { id: 'appointments', icon: CalendarCheck, value: 'appointments', accessRoleId: 'appointments' },
  { id: 'tenant', icon: BuildingOffice, value: 'tenant', accessRoleId: 'tenant' },
  { id: 'my-bug-reports', icon: Bug, value: 'my-bug-reports', regularAdminOnly: true },
  { id: 'contact-messages', icon: ChatCircleDots, value: 'contact-messages', platformAdminOnly: true },
  { id: 'bug-reports', icon: Bug, value: 'bug-reports', platformAdminOnly: true },
  { id: 'whatsapp-bot', icon: WhatsappLogo, value: 'whatsapp-bot', platformAdminOnly: true },
  { id: 'users-permissions', icon: ShieldCheck, value: 'users-permissions', accessRoleId: 'users-permissions' },
  { id: 'access-profiles', icon: ShieldCheck, value: 'access-profiles', accessRoleId: 'access-profiles' },
  { id: 'audit-logs', icon: ClockCounterClockwise, value: 'audit-logs', accessRoleId: 'audit-logs' },
]

interface AppSidebarProps {
  activeTab: string
  onTabChange: (value: string) => void
  pinnedItems: string[]
  onPinnedItemsChange: Dispatch<SetStateAction<string[]>>
}

export function AppSidebar({ activeTab, onTabChange, pinnedItems, onPinnedItemsChange }: AppSidebarProps) {
  const { isAdmin, isPlatformAdmin, hasAccess } = useAuth()
  const { t, language } = useLanguage()
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [draggedPinnedItemId, setDraggedPinnedItemId] = useState<string | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const visibleItems = menuItems.filter(item => {
    if (item.accessRoleId && !hasAccess(item.accessRoleId, 'read')) return false
    if (item.platformAdminOnly && !isPlatformAdmin) return false
    if (item.regularAdminOnly && (!isAdmin || isPlatformAdmin)) return false
    return true
  })

  const safePinnedItems = pinnedItems || []
  const pinnedMenuItems = safePinnedItems
    .map(itemId => visibleItems.find(item => item.id === itemId))
    .filter((item): item is MenuItem => Boolean(item))
  const unpinnedMenuItems = visibleItems.filter(item => !pinnedItems?.includes(item.id))
  const sidebarExpanded = contextMenuOpen
  const mobilePrimaryItems = useMemo(() => {
    const preferredOrder = ['calendar', 'contracts', 'appointments', 'properties']
    const preferredItems = preferredOrder
      .map((value) => visibleItems.find((item) => item.value === value))
      .filter((item): item is MenuItem => Boolean(item))

    const fallbackItems = visibleItems.filter((item) => !preferredItems.some((preferred) => preferred.id === item.id))
    const baseItems = [...preferredItems, ...fallbackItems].slice(0, 4)
    const activeItem = visibleItems.find((item) => item.value === activeTab)

    if (activeItem && !baseItems.some((item) => item.id === activeItem.id)) {
      return [...baseItems.slice(0, 3), activeItem]
    }

    return baseItems
  }, [activeTab, visibleItems])

  const pinItem = (itemId: string) => {
    onPinnedItemsChange((current) => {
      const currentPinned = current || []
      return currentPinned.includes(itemId) ? currentPinned : [...currentPinned, itemId]
    })
  }

  const unpinItem = (itemId: string) => {
    onPinnedItemsChange((current) => (current || []).filter(id => id !== itemId))
  }

  const movePinnedItem = (itemId: string, direction: 'up' | 'down') => {
    onPinnedItemsChange((current) => {
      const visibleIds = new Set(visibleItems.map(item => item.id))
      const orderedPinned = (current || []).filter(id => visibleIds.has(id))
      const currentIndex = orderedPinned.indexOf(itemId)
      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedPinned.length) {
        return orderedPinned
      }

      const nextPinned = [...orderedPinned]
      ;[nextPinned[currentIndex], nextPinned[nextIndex]] = [nextPinned[nextIndex], nextPinned[currentIndex]]
      return nextPinned
    })
  }

  const reorderPinnedItem = (sourceItemId: string, targetItemId: string) => {
    if (sourceItemId === targetItemId) return

    onPinnedItemsChange((current) => {
      const visibleIds = new Set(visibleItems.map(item => item.id))
      const orderedPinned = (current || []).filter(id => visibleIds.has(id))
      const sourceIndex = orderedPinned.indexOf(sourceItemId)
      const targetIndex = orderedPinned.indexOf(targetItemId)

      if (sourceIndex < 0 || targetIndex < 0) return orderedPinned

      const nextPinned = [...orderedPinned]
      const [movedItem] = nextPinned.splice(sourceIndex, 1)
      nextPinned.splice(targetIndex, 0, movedItem)
      return nextPinned
    })
  }

  const openInNewTab = (tabValue: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tabValue)
    window.open(url.href, '_blank')
  }

  const renderMenuItem = (item: MenuItem, isPinned: boolean) => {
    const Icon = item.icon
    const label = t.tabs[item.value as keyof typeof t.tabs] || item.value
    const isActive = activeTab === item.value
    const isFirstPinned = isPinned && pinnedMenuItems[0]?.id === item.id
    const isLastPinned = isPinned && pinnedMenuItems[pinnedMenuItems.length - 1]?.id === item.id

    return (
      <ContextMenu key={item.id} onOpenChange={setContextMenuOpen}>
        <ContextMenuTrigger asChild>
          <button
            onClick={() => onTabChange(item.value)}
            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); openInNewTab(item.value) } }}
            draggable={isPinned}
            onDragStart={(event) => {
              if (!isPinned) return
              setDraggedPinnedItemId(item.id)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', item.id)
            }}
            onDragOver={(event) => {
              if (!isPinned || !draggedPinnedItemId || draggedPinnedItemId === item.id) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(event) => {
              event.preventDefault()
              const sourceItemId = draggedPinnedItemId || event.dataTransfer.getData('text/plain')
              if (isPinned && sourceItemId) reorderPinnedItem(sourceItemId, item.id)
              setDraggedPinnedItemId(null)
            }}
            onDragEnd={() => setDraggedPinnedItemId(null)}
            title={label}
            className={cn(
              "w-full flex items-center py-3 text-left transition-all duration-200 ease-out rounded-lg group relative overflow-hidden",
              "justify-center px-2",
              "group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-4",
              sidebarExpanded && "justify-start gap-3 px-4",
              draggedPinnedItemId === item.id && "opacity-60",
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
                sidebarExpanded && "scale-100",
                isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className={cn(
              "text-sm font-medium whitespace-nowrap transition-all duration-200 ease-out origin-left",
              "max-w-0 opacity-0 -translate-x-2",
              "group-hover/sidebar:max-w-[180px] group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0",
              sidebarExpanded && "max-w-[180px] opacity-100 translate-x-0",
              isActive ? "text-primary-foreground" : ""
            )}>
              {label}
            </span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => openInNewTab(item.value)}>
            <ArrowSquareUpRightIcon size={16} />
            {t.sidebar.open_in_new_tab}
          </ContextMenuItem>
          <ContextMenuSeparator />
          {isPinned ? (
            <>
              <ContextMenuItem onSelect={() => unpinItem(item.id)}>
                <PushPinSlash size={16} />
                {t.sidebar.unpin}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem disabled={isFirstPinned} onSelect={() => movePinnedItem(item.id, 'up')}>
                <ArrowUp size={16} />
                {t.sidebar.move_up}
              </ContextMenuItem>
              <ContextMenuItem disabled={isLastPinned} onSelect={() => movePinnedItem(item.id, 'down')}>
                <ArrowDown size={16} />
                {t.sidebar.move_down}
              </ContextMenuItem>
            </>
          ) : (
            <ContextMenuItem onSelect={() => pinItem(item.id)}>
              <PushPin size={16} />
              {t.sidebar.pin}
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  return (
    <>
      <aside className={cn(
        "group/sidebar fixed left-0 top-0 z-50 hidden h-screen flex-col border-r border-border bg-card/50 backdrop-blur-sm md:flex",
        "w-20 hover:w-64 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        sidebarExpanded && "w-64"
      )}>
        <div className="border-b border-border h-20 px-3 flex items-center overflow-hidden">
          <img
            src={logo1}
            alt="RPM GO"
            className={cn(
              "h-12 w-auto shrink-0 object-contain transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/sidebar:hidden",
              sidebarExpanded && "hidden"
            )}
          />
          <img
            src={logoFull}
            alt="RPM GO"
            className={cn(
              "hidden group-hover/sidebar:block w-full h-full object-contain object-center py-2 px-1",
              sidebarExpanded && "block"
            )}
          />
        </div>

        <ScrollArea className={cn(
          "min-h-0 flex-1 px-2 py-4 transition-all duration-300 ease-out group-hover/sidebar:px-3",
          sidebarExpanded && "px-3"
        )}>
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

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 px-2 py-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon
            const label = t.tabs[item.value as keyof typeof t.tabs] || item.value
            const isActive = activeTab === item.value

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.value)}
                className={cn(
                  "flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon size={18} weight={isActive ? "fill" : "duotone"} />
                <span className="max-w-[64px] truncate">{label}</span>
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={cn(
              "flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors",
              !mobilePrimaryItems.some((item) => item.value === activeTab)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <DotsThreeOutline size={18} weight={!mobilePrimaryItems.some((item) => item.value === activeTab) ? 'fill' : 'duotone'} />
            <span className="max-w-[64px] truncate">Mais</span>
          </button>
        </div>
      </nav>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl px-0 pb-6 md:hidden">
          <SheetHeader className="px-5 pb-3">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-full px-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {visibleItems.map((item) => {
                const Icon = item.icon
                const label = t.tabs[item.value as keyof typeof t.tabs] || item.value
                const isActive = activeTab === item.value

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onTabChange(item.value)
                      setMobileMenuOpen(false)
                    }}
                    className={cn(
                      "flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl border px-3 py-4 text-center text-sm font-medium transition-colors",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-foreground hover:bg-accent"
                    )}
                  >
                    <Icon size={20} weight={isActive ? "fill" : "duotone"} />
                    <span className="max-w-[120px] leading-tight">{label}</span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
