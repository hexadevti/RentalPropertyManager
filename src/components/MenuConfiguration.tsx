import { useAuth } from '@/lib/AuthContext'
import { useKV } from '@/lib/useSupabaseKV'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { menuItems } from '@/components/AppSidebar'
import { PushPin, PushPinSlash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function MenuConfiguration() {
  const { isAdmin, currentUser } = useAuth()
  const [pinnedItems, setPinnedItems] = useKV<string[]>(`pinned-items-${currentUser?.login}`, [])

  const visibleItems = menuItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false
    return true
  })

  const togglePin = (itemId: string) => {
    setPinnedItems((current) => {
      const currentPinned = current || []
      if (currentPinned.includes(itemId)) {
        toast.success('Item removido do topo do menu')
        return currentPinned.filter(id => id !== itemId)
      } else {
        toast.success('Item fixado no topo do menu')
        return [...currentPinned, itemId]
      }
    })
  }

  const pinnedCount = (pinnedItems || []).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <PushPin size={24} weight="duotone" className="text-accent" />
          </div>
          <div>
            <CardTitle>Organização do Menu</CardTitle>
            <CardDescription>
              Fixe os itens mais importantes no topo do menu lateral ({pinnedCount} {pinnedCount === 1 ? 'item fixado' : 'itens fixados'})
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isPinned = (pinnedItems || []).includes(item.id)

            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-colors",
                  isPinned ? "bg-accent/5 border-accent/20" : "bg-card border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon 
                    weight={isPinned ? "fill" : "duotone"} 
                    size={20}
                    className={isPinned ? "text-accent" : "text-muted-foreground"}
                  />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <Button
                  variant={isPinned ? "default" : "outline"}
                  size="sm"
                  onClick={() => togglePin(item.id)}
                  className="gap-2"
                >
                  {isPinned ? (
                    <>
                      <PushPinSlash size={16} />
                      Desafixar
                    </>
                  ) : (
                    <>
                      <PushPin size={16} />
                      Fixar no Topo
                    </>
                  )}
                </Button>
              </div>
            )
          })}
        </div>
        
        {pinnedCount > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground">
              💡 Os itens fixados aparecem no topo do menu lateral, separados por uma linha divisória.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
