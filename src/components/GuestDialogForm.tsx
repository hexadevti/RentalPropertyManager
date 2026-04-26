import { useEffect, useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'

import { HelpButton } from '@/components/HelpButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { DateInput } from '@/components/ui/date-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash, IdentificationCard, Users } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Dependent, Document, Guest, GuestDocument, GuestRelatedPerson, Sponsor } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'

const DOCUMENTS_BUCKET = 'documents'

interface GuestDialogFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGuestCreated?: (guestId: string) => void
  editingGuest?: Guest | null
  importedDraft?: Partial<Guest> | null
  importedFiles?: File[]
}

type RelatedPeopleKey = 'sponsors' | 'dependents'

type GuestFormState = {
  name: string
  email: string
  phone: string
  documents: GuestDocument[]
  sponsors: Sponsor[]
  dependents: Dependent[]
  address: string
  nationality: string
  maritalStatus: string
  profession: string
  dateOfBirth: string
  notes: string
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createEmptyRelatedPerson(prefix: 'sponsor' | 'dependent'): GuestRelatedPerson {
  return {
    id: createId(prefix),
    name: '',
    email: '',
    phone: '',
    documents: [],
    address: '',
    nationality: '',
    maritalStatus: '',
    profession: '',
    dateOfBirth: '',
    notes: '',
  }
}

function normalizeRelatedPerson(person: Partial<GuestRelatedPerson> | undefined, prefix: 'sponsor' | 'dependent'): GuestRelatedPerson {
  return {
    ...createEmptyRelatedPerson(prefix),
    ...person,
    id: person?.id || createId(prefix),
    documents: person?.documents || [],
  }
}

function createEmptyGuestForm(): GuestFormState {
  return {
    name: '',
    email: '',
    phone: '',
    documents: [],
    sponsors: [],
    dependents: [],
    address: '',
    nationality: '',
    maritalStatus: '',
    profession: '',
    dateOfBirth: '',
    notes: '',
  }
}

export default function GuestDialogForm({
  open,
  onOpenChange,
  onGuestCreated,
  editingGuest,
  importedDraft,
  importedFiles,
}: GuestDialogFormProps) {
  const { t } = useLanguage()
  const { currentTenantId } = useAuth()
  const [guests, setGuests] = useKV<Guest[]>('guests', [])
  const [, setDocuments] = useKV<Document[]>('documents', [])
  const [formData, setFormData] = useState<GuestFormState>(createEmptyGuestForm())
  const [newDocType, setNewDocType] = useState('')
  const [newDocNumber, setNewDocNumber] = useState('')
  const [aiImportFiles, setAiImportFiles] = useState<File[]>([])
  const [portalPassword, setPortalPassword] = useState('')
  const [portalPasswordConfirm, setPortalPasswordConfirm] = useState('')
  const [isResettingPortalPassword, setIsResettingPortalPassword] = useState(false)

  const validatePortalPassword = (password: string): string | null => {
    if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return 'A senha deve conter pelo menos uma letra e um numero.'
    }
    return null
  }

  const mergeDocuments = (current: GuestDocument[], incoming: GuestDocument[]) => {
    const next = [...current]
    const seen = new Set(current.map((doc) => `${doc.type.toLowerCase()}::${doc.number.toLowerCase()}`))

    for (const doc of incoming) {
      const type = doc.type.trim()
      const number = doc.number.trim()
      if (!number) continue
      const key = `${type.toLowerCase()}::${number.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      next.push({ type, number })
    }

    return next
  }

  const sanitizeFileName = (fileName: string) => {
    return fileName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .replace(/-+/g, '-')
  }

  const createDocumentId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const saveImportedFilesAsDocuments = async (guestId: string, guestName: string) => {
    if (aiImportFiles.length === 0) return
    if (!currentTenantId) {
      toast.error(t.documents_view.tenant_required)
      return
    }

    const savedDocuments: Document[] = []

    for (const file of aiImportFiles.slice(0, 6)) {
      const id = createDocumentId()
      const safeFileName = sanitizeFileName(file.name || `guest-document-${id}.jpg`)
      const filePath = `${currentTenantId}/${id}/${safeFileName}`

      const { error } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        })

      if (error) {
        toast.error(error.message || t.documents_view.upload_error)
        continue
      }

      savedDocuments.push({
        id,
        name: `${guestName || t.guests_view.form.name} - ${safeFileName}`,
        category: 'other',
        notes: 'Document image used in AI extraction flow.',
        relationType: 'guest',
        relationId: guestId,
        fileName: file.name,
        filePath,
        fileSize: file.size,
        mimeType: file.type || undefined,
        uploadDate: new Date().toISOString(),
      })
    }

    if (savedDocuments.length > 0) {
      setDocuments((current) => [...(current || []), ...savedDocuments])
      toast.success(`${savedDocuments.length} ${t.documents_view.upload_success}`)
    }
  }

  const resetForm = () => {
    setFormData(createEmptyGuestForm())
    setNewDocType('')
    setNewDocNumber('')
    setAiImportFiles([])
    setPortalPassword('')
    setPortalPasswordConfirm('')
    setIsResettingPortalPassword(false)
  }

  useEffect(() => {
    if (!editingGuest) return

    setFormData({
      name: editingGuest.name,
      email: editingGuest.email,
      phone: editingGuest.phone,
      documents: editingGuest.documents || [],
      sponsors: (editingGuest.sponsors || []).map((person) => normalizeRelatedPerson(person, 'sponsor')),
      dependents: (editingGuest.dependents || []).map((person) => normalizeRelatedPerson(person, 'dependent')),
      address: editingGuest.address || '',
      nationality: editingGuest.nationality || '',
      maritalStatus: editingGuest.maritalStatus || '',
      profession: editingGuest.profession || '',
      dateOfBirth: editingGuest.dateOfBirth || '',
      notes: editingGuest.notes || '',
    })
    setNewDocType('')
    setNewDocNumber('')
  }, [editingGuest])

  useEffect(() => {
    if (!importedDraft || editingGuest) return

    setFormData({
      name: importedDraft.name || '',
      email: importedDraft.email || '',
      phone: importedDraft.phone || '',
      documents: importedDraft.documents || [],
      sponsors: [],
      dependents: [],
      address: importedDraft.address || '',
      nationality: importedDraft.nationality || '',
      maritalStatus: importedDraft.maritalStatus || '',
      profession: importedDraft.profession || '',
      dateOfBirth: importedDraft.dateOfBirth || '',
      notes: importedDraft.notes || '',
    })
    setAiImportFiles(importedFiles || [])
    setNewDocType('')
    setNewDocNumber('')
  }, [editingGuest, importedDraft, importedFiles])

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

  const updateRelatedPeople = (
    key: RelatedPeopleKey,
    updater: (current: GuestRelatedPerson[]) => GuestRelatedPerson[]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [key]: updater(prev[key]),
    }))
  }

  const addRelatedPerson = (key: RelatedPeopleKey) => {
    updateRelatedPeople(key, (current) => [
      ...current,
      createEmptyRelatedPerson(key === 'sponsors' ? 'sponsor' : 'dependent'),
    ])
  }

  const updateRelatedPerson = (
    key: RelatedPeopleKey,
    index: number,
    patch: Partial<GuestRelatedPerson>
  ) => {
    updateRelatedPeople(key, (current) => current.map((person, currentIndex) => (
      currentIndex === index ? { ...person, ...patch } : person
    )))
  }

  const removeRelatedPerson = (key: RelatedPeopleKey, index: number) => {
    updateRelatedPeople(key, (current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const addRelatedDocument = (key: RelatedPeopleKey, index: number) => {
    updateRelatedPeople(key, (current) => current.map((person, currentIndex) => {
      if (currentIndex !== index) return person
      return {
        ...person,
        documents: [...person.documents, { type: '', number: '' }],
      }
    }))
  }

  const updateRelatedDocument = (
    key: RelatedPeopleKey,
    personIndex: number,
    documentIndex: number,
    patch: Partial<GuestDocument>
  ) => {
    updateRelatedPeople(key, (current) => current.map((person, currentIndex) => {
      if (currentIndex !== personIndex) return person
      return {
        ...person,
        documents: person.documents.map((document, currentDocumentIndex) => (
          currentDocumentIndex === documentIndex ? { ...document, ...patch } : document
        )),
      }
    }))
  }

  const removeRelatedDocument = (key: RelatedPeopleKey, personIndex: number, documentIndex: number) => {
    updateRelatedPeople(key, (current) => current.map((person, currentIndex) => {
      if (currentIndex !== personIndex) return person
      return {
        ...person,
        documents: person.documents.filter((_, currentDocumentIndex) => currentDocumentIndex !== documentIndex),
      }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editingGuest) {
      setGuests((currentGuests) =>
        (currentGuests || []).map((guest) =>
          guest.id === editingGuest.id
            ? { ...formData, id: guest.id, createdAt: guest.createdAt }
            : guest
        )
      )
      toast.success(t.guests_view.form.updated_success)

      if (portalPassword.trim()) {
        if (!currentTenantId) {
          toast.error(t.documents_view.tenant_required)
          return
        }

        const passwordValidation = validatePortalPassword(portalPassword.trim())
        if (passwordValidation) {
          toast.error(passwordValidation)
          return
        }
        if (portalPassword.trim() !== portalPasswordConfirm.trim()) {
          toast.error('A confirmacao da senha do portal nao confere.')
          return
        }

        setIsResettingPortalPassword(true)
        const { data, error } = await supabase.rpc('portal_admin_reset_guest_password', {
          p_tenant_id: currentTenantId,
          p_guest_id: editingGuest.id,
          p_new_password: portalPassword.trim(),
        })
        setIsResettingPortalPassword(false)

        if (error || data !== true) {
          toast.error(error?.message || 'Nao foi possivel redefinir a senha do portal para este hospede.')
          return
        }

        toast.success('Senha do portal redefinida com sucesso para este hospede.')
      }

      await saveImportedFilesAsDocuments(editingGuest.id, formData.name)
      onOpenChange(false)
      resetForm()
      return
    }

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

    await saveImportedFilesAsDocuments(newGuest.id, newGuest.name)

    onOpenChange(false)
    resetForm()
  }

  const renderRelatedPeopleSection = (key: RelatedPeopleKey, title: string, emptyLabel: string) => {
    const people = formData[key]

    return (
      <div className="col-span-2 space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label className="text-base font-semibold">{title}</Label>
            <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => addRelatedPerson(key)}>
            <Plus weight="bold" size={16} className="mr-2" />
            {t.guests_view.form.add}
          </Button>
        </div>

        {people.length === 0 && (
          <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
            {t.guests_view.form.no_items}
          </div>
        )}

        {people.map((person, index) => (
          <div key={person.id} className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-muted-foreground" />
                <span className="font-medium">
                  {person.name || `${title.slice(0, -1)} ${index + 1}`}
                </span>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => removeRelatedPerson(key, index)}>
                <Trash size={16} className="text-destructive" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>{t.guests_view.form.name}</Label>
                <Input
                  value={person.name}
                  onChange={(e) => updateRelatedPerson(key, index, { name: e.target.value })}
                  placeholder={t.guests_view.form.name_placeholder}
                />
              </div>

              <div>
                <Label>{t.guests_view.form.email}</Label>
                <Input
                  type="email"
                  value={person.email}
                  onChange={(e) => updateRelatedPerson(key, index, { email: e.target.value })}
                  placeholder={t.guests_view.form.email_placeholder}
                />
              </div>

              <div>
                <Label>{t.guests_view.form.phone}</Label>
                <PhoneInput
                  value={person.phone}
                  onValueChange={(value) => updateRelatedPerson(key, index, { phone: value })}
                  placeholder={t.guests_view.form.phone_placeholder}
                />
              </div>

              <div className="col-span-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>{t.guests_view.form.documents}</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => addRelatedDocument(key, index)}>
                    <Plus weight="bold" size={14} className="mr-2" />
                    {t.guests_view.form.document_item}
                  </Button>
                </div>

                {person.documents.map((document, documentIndex) => (
                  <div key={`${person.id}-${documentIndex}`} className="flex gap-2">
                    <Input
                      value={document.type}
                      onChange={(e) => updateRelatedDocument(key, index, documentIndex, { type: e.target.value })}
                      placeholder={t.guests_view.form.document_type_placeholder}
                      className="w-40 shrink-0"
                    />
                    <Input
                      value={document.number}
                      onChange={(e) => updateRelatedDocument(key, index, documentIndex, { number: e.target.value })}
                      placeholder={t.guests_view.form.document_number_placeholder}
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeRelatedDocument(key, index, documentIndex)}>
                      <Trash size={14} className="text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <div>
                <Label>{t.guests_view.form.nationality} {t.guests_view.form.optional}</Label>
                <Input
                  value={person.nationality || ''}
                  onChange={(e) => updateRelatedPerson(key, index, { nationality: e.target.value })}
                  placeholder={t.guests_view.form.nationality_placeholder}
                />
              </div>

              <div>
                <Label>{t.guests_view.form.marital_status} {t.guests_view.form.optional}</Label>
                <Input
                  value={person.maritalStatus || ''}
                  onChange={(e) => updateRelatedPerson(key, index, { maritalStatus: e.target.value })}
                  placeholder={t.guests_view.form.marital_status_placeholder}
                />
              </div>

              <div className="col-span-2">
                <Label>{t.guests_view.form.profession} {t.guests_view.form.optional}</Label>
                <Input
                  value={person.profession || ''}
                  onChange={(e) => updateRelatedPerson(key, index, { profession: e.target.value })}
                  placeholder={t.guests_view.form.profession_placeholder}
                />
              </div>

              <div className="col-span-2">
                <Label>{t.guests_view.form.address} {t.guests_view.form.optional}</Label>
                <Input
                  value={person.address || ''}
                  onChange={(e) => updateRelatedPerson(key, index, { address: e.target.value })}
                  placeholder={t.guests_view.form.address_placeholder}
                />
              </div>

              <div>
                <Label>{t.guests_view.form.date_of_birth} {t.guests_view.form.optional}</Label>
                <DateInput
                  value={person.dateOfBirth || ''}
                  onChange={(value) => updateRelatedPerson(key, index, { dateOfBirth: value })}
                />
              </div>

              <div className="col-span-2">
                <Label>{t.guests_view.form.notes} {t.guests_view.form.optional}</Label>
                <Textarea
                  value={person.notes || ''}
                  onChange={(e) => updateRelatedPerson(key, index, { notes: e.target.value })}
                  placeholder={t.guests_view.form.notes_placeholder}
                  rows={2}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen)
      if (!isOpen) resetForm()
    }}>
      <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden max-h-[90vh] max-w-4xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-1">
            {editingGuest ? t.guests_view.form.title_edit : t.guests_view.form.title_new}
            <HelpButton docKey="form-guest" title="Ajuda — Formulário de Hóspede" />
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
              <PhoneInput
                id="guest-phone"
                value={formData.phone}
                onValueChange={(value) => setFormData({ ...formData, phone: value })}
                placeholder={t.guests_view.form.phone_placeholder}
                required
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label>{t.guests_view.form.documents}</Label>
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
                  placeholder={t.guests_view.form.document_type_placeholder}
                  className="w-36 shrink-0"
                />
                <Input
                  value={newDocNumber}
                  onChange={(e) => setNewDocNumber(e.target.value)}
                  placeholder={t.guests_view.form.document_number_placeholder}
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

            <div>
              <Label htmlFor="guest-marital-status">{t.guests_view.form.marital_status} {t.guests_view.form.optional}</Label>
              <Input
                id="guest-marital-status"
                value={formData.maritalStatus}
                onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })}
                placeholder={t.guests_view.form.marital_status_placeholder}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="guest-profession">{t.guests_view.form.profession} {t.guests_view.form.optional}</Label>
              <Input
                id="guest-profession"
                value={formData.profession}
                onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                placeholder={t.guests_view.form.profession_placeholder}
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

            {editingGuest && (
              <div className="col-span-2 rounded-lg border border-blue-100 bg-blue-50/40 p-4 space-y-3">
                <div>
                  <Label className="text-sm font-semibold text-blue-900">Acesso do portal de reservas</Label>
                  <p className="text-xs text-blue-800 mt-1">
                    Redefina a senha do portal para este hospede. Use 8+ caracteres com letra e numero.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="guest-portal-password">Nova senha do portal</Label>
                    <Input
                      id="guest-portal-password"
                      type="password"
                      value={portalPassword}
                      onChange={(e) => setPortalPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <Label htmlFor="guest-portal-password-confirm">Confirmar nova senha</Label>
                    <Input
                      id="guest-portal-password-confirm"
                      type="password"
                      value={portalPasswordConfirm}
                      onChange={(e) => setPortalPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>
            )}

            {renderRelatedPeopleSection(
              'sponsors',
              t.guests_view.form.sponsors_title,
              t.guests_view.form.sponsors_description
            )}

            {renderRelatedPeopleSection(
              'dependents',
              t.guests_view.form.dependents_title,
              t.guests_view.form.dependents_description
            )}
          </div>

          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t shrink-0 bg-background">
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
