import { useState, useEffect } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash, IdentificationCard } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Guest, GuestDocument } from '@/types'
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
  const { t, language } = useLanguage()
  const [guests, setGuests] = useKV<Guest[]>('guests', [])

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    documents: [] as GuestDocument[],
    address: '',
    nationality: '',
    dateOfBirth: '',
    notes: '',
  })
  const [newDocType, setNewDocType] = useState('')
  const [newDocNumber, setNewDocNumber] = useState('')

  const addDocument = () => {
    if (!newDocNumber.trim()) return
    setFormData((prev) => ({
      ...prev,
      documents: [...prev.documents, { type: newDocType.trim(), number: newDocNumber.trim() }],
    }))
    setNewDocType('')
    setNewDocNumber('')
  }

  const removeDocument = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index),
    }))
  }

  useEffect(() => {
    if (editingGuest) {
      setFormData({
        name: editingGuest.name,
        email: editingGuest.email,
        phone: editingGuest.phone,
        documents: editingGuest.documents || [],
        address: editingGuest.address || '',
        nationality: editingGuest.nationality || '',
        dateOfBirth: editingGuest.dateOfBirth || '',
        notes: editingGuest.notes || '',
      })
      setNewDocType('')
      setNewDocNumber('')
    }
  }, [editingGuest])

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      documents: [],
      address: '',
      nationality: '',
      dateOfBirth: '',
      notes: '',
    })
    setNewDocType('')
    setNewDocNumber('')
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

            <div className="col-span-2 space-y-2">
              <Label>{language === 'pt' ? 'Documentos' : 'Documents'}</Label>
              {formData.documents.map((doc, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <IdentificationCard size={16} className="text-muted-foreground shrink-0" />
                  <span className="flex-1">{doc.type ? `${doc.type}: ${doc.number}` : doc.number}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeDocument(i)}>
                    <Trash size={14} className="text-destructive" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newDocType}
                  onChange={(e) => setNewDocType(e.target.value)}
                  placeholder={language === 'pt' ? 'Tipo (CPF, RG...)' : 'Type (ID, Passport...)'}
                  className="w-36 shrink-0"
                />
                <Input
                  value={newDocNumber}
                  onChange={(e) => setNewDocNumber(e.target.value)}
                  placeholder={language === 'pt' ? 'Número do documento' : 'Document number'}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDocument() } }}
                />
                <Button type="button" variant="outline" onClick={addDocument} className="shrink-0">
                  <Plus weight="bold" size={16} />
                </Button>
              </div>
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
