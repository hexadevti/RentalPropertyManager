import { useState, useEffect } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Guest } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'

interface GuestDialogFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGuestCreated?: (guestId: string) => void
  editingGuest?: Guest | null
}

export default function GuestDialogForm({ 
  open, 
  onOpenChange,
  onGuestCreated,
  editingGuest 
}: GuestDialogFormProps) {
  const { t } = useLanguage()
  const [guests, setGuests] = useKV<Guest[]>('guests', [])
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    document: '',
    address: '',
    nationality: '',
    dateOfBirth: '',
    notes: '',
  })

  useEffect(() => {
    if (editingGuest) {
      setFormData({
        name: editingGuest.name,
        email: editingGuest.email,
        phone: editingGuest.phone,
        document: editingGuest.document,
        address: editingGuest.address || '',
        nationality: editingGuest.nationality || '',
        dateOfBirth: editingGuest.dateOfBirth || '',
        notes: editingGuest.notes || '',
      })
    }
  }, [editingGuest])

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      document: '',
      address: '',
      nationality: '',
      dateOfBirth: '',
      notes: '',
    })
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
      onOpenChange(false)
      resetForm()
    } else {
      const newGuest: Guest = {
        ...formData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      setGuests((currentGuests) => [...(currentGuests || []), newGuest])
      toast.success(t.guests_view.form.created_success)
      
      if (onGuestCreated) {
        onGuestCreated(newGuest.id)
      }
      
      onOpenChange(false)
      resetForm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen)
      if (!isOpen) resetForm()
    }}>
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
              <Label htmlFor="guest-nationality">{t.guests_view.form.nationality} {t.guests_view.form.optional}</Label>
              <Input
                id="guest-nationality"
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                placeholder={t.guests_view.form.nationality_placeholder}
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
              onOpenChange(false)
              resetForm()
            }}>
              {t.guests_view.form.cancel}
            </Button>
            <Button type="submit">{t.guests_view.form.save}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
