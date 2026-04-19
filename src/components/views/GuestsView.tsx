import { useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { MagnifyingGlass, Plus, Pencil, Trash, User, Envelope, Phone, IdentificationCard, MapPin, Flag, Cake, ArrowsClockwise, Users } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Guest, Contract } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import { format } from 'date-fns'
import GuestDialogForm from '@/components/GuestDialogForm'

export default function GuestsView() {
  const { t, language } = useLanguage()
  const [guests, setGuests] = useKV<Guest[]>('guests', [])
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)

  const resetForm = () => {
    setEditingGuest(null)
  }

  const handleEdit = (guest: Guest) => {
    setEditingGuest(guest)
    setDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    setGuests((currentGuests) => (currentGuests || []).filter(g => g.id !== id))
    toast.success(t.guests_view.deleted_success)
  }

  const filteredGuests = (guests || []).filter(guest =>
    guest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    guest.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    guest.phone.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleRefresh = () => {
    setGuests((current) => [...(current || [])])
    toast.success(t.common.refreshed_success)
  }

  const getGuestContracts = (guestId: string) => {
    return (contracts || []).filter(contract => contract.guestId === guestId)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{t.guests_view.title}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {t.common.refresh}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus weight="bold" />
                {t.guests_view.add_guest}
              </Button>
            </DialogTrigger>
        </Dialog>
        </div>
      </div>

      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <Input
          placeholder={t.guests_view.search_placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredGuests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <User size={64} weight="duotone" className="text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {searchQuery ? t.guests_view.no_guests : t.guests_view.no_guests}
            </h3>
            {!searchQuery && (
              <p className="text-muted-foreground text-center max-w-md">
                {t.guests_view.add_first}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredGuests.map((guest) => {
            const guestContracts = getGuestContracts(guest.id)
            return (
              <Card key={guest.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User size={24} weight="duotone" className="text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl mb-1">{guest.name}</CardTitle>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Envelope size={16} weight="duotone" />
                            {guest.email}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Phone size={16} weight="duotone" />
                            {guest.phone}
                          </div>
                          {((guest.sponsors?.length || 0) > 0 || (guest.dependents?.length || 0) > 0) && (
                            <div className="flex items-center gap-1.5">
                              <Users size={16} weight="duotone" />
                              {`${guest.sponsors?.length || 0} ${language === 'pt' ? 'sponsors' : 'sponsors'} • ${guest.dependents?.length || 0} ${language === 'pt' ? 'dependentes' : 'dependents'}`}
                            </div>
                          )}
                          {(guest.documents || []).length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <IdentificationCard size={16} weight="duotone" />
                              {(guest.documents || []).map((d) => d.type ? `${d.type}: ${d.number}` : d.number).join(' | ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(guest)}
                      >
                        <Pencil size={18} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(guest.id)}
                      >
                        <Trash size={18} className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  {(guest.sponsors?.length || 0) > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {language === 'pt' ? 'Sponsors' : 'Sponsors'}
                      </p>
                      <div className="grid gap-2">
                        {(guest.sponsors || []).map((sponsor) => (
                          <div key={sponsor.id} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                            <div className="font-medium">{sponsor.name || (language === 'pt' ? 'Sem nome' : 'Unnamed')}</div>
                            <div className="text-muted-foreground">
                              {[sponsor.email, sponsor.phone].filter(Boolean).join(' • ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(guest.dependents?.length || 0) > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {language === 'pt' ? 'Dependentes' : 'Dependents'}
                      </p>
                      <div className="grid gap-2">
                        {(guest.dependents || []).map((dependent) => (
                          <div key={dependent.id} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                            <div className="font-medium">{dependent.name || (language === 'pt' ? 'Sem nome' : 'Unnamed')}</div>
                            <div className="text-muted-foreground">
                              {[dependent.email, dependent.phone].filter(Boolean).join(' • ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
                
              </Card>
            )
          })}
        </div>
      )}

      <GuestDialogForm
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}
        editingGuest={editingGuest}
      />
    </div>
  )
}
