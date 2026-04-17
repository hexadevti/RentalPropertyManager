import { useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MagnifyingGlass, Plus, Pencil, Trash, User, Envelope, Phone, IdentificationCard, MapPin, Flag, Cake, ArrowsClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Guest, Contract } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import { format } from 'date-fns'

export default function GuestsView() {
  const { t } = useLanguage()
  const [guests, setGuests] = useKV<Guest[]>('guests', [])
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    document: '',
    documentType: '',
    address: '',
    nationality: '',
    maritalStatus: '',
    profession: '',
    dateOfBirth: '',
    notes: '',
  })

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      document: '',
      documentType: '',
      address: '',
      nationality: '',
      maritalStatus: '',
      profession: '',
      dateOfBirth: '',
      notes: '',
    })
    setEditingGuest(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingGuest) {
      setGuests((currentGuests) =>
        (currentGuests || []).map(g =>
          g.id === editingGuest.id
            ? { ...formData, id: g.id, createdAt: g.createdAt }
            : g
        )
      )
      toast.success(t.guests_view.form.updated_success)
    } else {
      const newGuest: Guest = {
        ...formData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      setGuests((currentGuests) => [...(currentGuests || []), newGuest])
      toast.success(t.guests_view.form.created_success)
    }
    
    setDialogOpen(false)
    resetForm()
  }

  const handleEdit = (guest: Guest) => {
    setEditingGuest(guest)
    setFormData({
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      document: guest.document,
      documentType: guest.documentType || '',
      address: guest.address || '',
      nationality: guest.nationality || '',
      maritalStatus: guest.maritalStatus || '',
      profession: guest.profession || '',
      dateOfBirth: guest.dateOfBirth || '',
      notes: guest.notes || '',
    })
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingGuest ? t.guests_view.form.title_edit : t.guests_view.form.title_new}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="guest-name">{t.guests_view.form.name}</Label>
                  <Input
                    id="guest-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.guests_view.form.name_placeholder}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="guest-email">{t.guests_view.form.email}</Label>
                  <Input
                    id="guest-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={t.guests_view.form.email_placeholder}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="guest-phone">{t.guests_view.form.phone}</Label>
                  <Input
                    id="guest-phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder={t.guests_view.form.phone_placeholder}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="guest-document">{t.guests_view.form.document}</Label>
                  <Input
                    id="guest-document"
                    value={formData.document}
                    onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                    placeholder={t.guests_view.form.document_placeholder}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="guest-document-type">{t.language === 'pt' ? 'Tipo de Documento' : 'Document Type'} {t.guests_view.form.optional}</Label>
                  <Input
                    id="guest-document-type"
                    value={formData.documentType}
                    onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                    placeholder={t.language === 'pt' ? 'Ex.: RG, CPF, Passaporte' : 'E.g. ID, Tax ID, Passport'}
                  />
                </div>

                <div>
                  <Label htmlFor="guest-nationality">{t.guests_view.form.nationality} {t.guests_view.form.optional}</Label>
                  <Input
                    id="guest-nationality"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    placeholder={t.guests_view.form.nationality_placeholder}
                  />
                </div>

                <div>
                  <Label htmlFor="guest-marital-status">{t.language === 'pt' ? 'Estado Civil' : 'Marital Status'} {t.guests_view.form.optional}</Label>
                  <Input
                    id="guest-marital-status"
                    value={formData.maritalStatus}
                    onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })}
                    placeholder={t.language === 'pt' ? 'Ex.: Solteiro(a)' : 'E.g. Single'}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="guest-profession">{t.language === 'pt' ? 'Profissão' : 'Profession'} {t.guests_view.form.optional}</Label>
                  <Input
                    id="guest-profession"
                    value={formData.profession}
                    onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                    placeholder={t.language === 'pt' ? 'Ex.: Arquiteto(a)' : 'E.g. Architect'}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="guest-address">{t.guests_view.form.address} {t.guests_view.form.optional}</Label>
                  <Input
                    id="guest-address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder={t.guests_view.form.address_placeholder}
                  />
                </div>

                <div>
                  <Label htmlFor="guest-dob">{t.guests_view.form.date_of_birth} {t.guests_view.form.optional}</Label>
                  <DateInput
                    id="guest-dob"
                    value={formData.dateOfBirth}
                    onChange={(value) => setFormData({ ...formData, dateOfBirth: value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="guest-notes">{t.guests_view.form.notes} {t.guests_view.form.optional}</Label>
                  <Textarea
                    id="guest-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t.guests_view.form.notes_placeholder}
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setDialogOpen(false)
                  resetForm()
                }}>
                  {t.guests_view.form.cancel}
                </Button>
                <Button type="submit">{t.guests_view.form.save}</Button>
              </div>
            </form>
          </DialogContent>
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
                          <div className="flex items-center gap-1.5">
                            <IdentificationCard size={16} weight="duotone" />
                            {guest.documentType ? `${guest.documentType}: ` : ''}{guest.document}
                          </div>
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
                
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
