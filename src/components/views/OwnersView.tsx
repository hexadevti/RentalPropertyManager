import { useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Owner, Property, GuestDocument } from '@/types'


import { HelpButton } from '@/components/HelpButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, User, Pencil, Trash, House, EnvelopeSimple, Phone, IdentificationCard, UploadSimple, DownloadSimple, ArrowsClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/LanguageContext'
import { usePhoneFormat } from '@/lib/PhoneFormatContext'

export default function OwnersView() {
  const { t } = useLanguage()
  const { formatPhone } = usePhoneFormat()
  const [owners, setOwners] = useKV<Owner[]>('owners', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [ownerToDelete, setOwnerToDelete] = useState<Owner | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [csvParsedRows, setCsvParsedRows] = useState<Partial<Owner>[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    documents: [] as GuestDocument[],
    nationality: '',
    maritalStatus: '',
    profession: '',
    address: '',
    notes: '',
  })
  const [newDocType, setNewDocType] = useState('')
  const [newDocNumber, setNewDocNumber] = useState('')

  const labels = t.owners_view

  const handleDownloadTemplate = () => {
    const rows = [
      ['name', 'email', 'phone', 'address', 'nationality', 'maritalStatus', 'profession', 'notes', 'documentType', 'documentNumber'],
      ['Maria Souza', 'maria@email.com', '(11) 98888-0000', 'Av. Paulista, 1000', 'Brasileira', 'Casada', 'Empresária', '', 'CPF', '000.000.000-00'],
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-proprietarios.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const parseCSVLine = (line: string, sep: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === sep && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError(null)
    setCsvParsedRows([])
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string).replace(/\r/g, '')
        const lines = text.split('\n').filter(l => l.trim())
        if (lines.length < 2) { setCsvError(labels.import_error_empty); return }
        const sep = lines[0].includes(';') ? ';' : ','
        const headers = parseCSVLine(lines[0], sep).map(h => h.toLowerCase().replace(/\s/g, ''))
        const rows: Partial<Owner>[] = []
        for (let i = 1; i < lines.length; i++) {
          const vals = parseCSVLine(lines[i], sep)
          const row: Record<string, string> = {}
          headers.forEach((h, idx) => { row[h] = vals[idx] ?? '' })
          if (!row.name) continue
          const documents = row.documenttype && row.documentnumber
            ? [{ type: row.documenttype, number: row.documentnumber }]
            : []
          rows.push({
            name: row.name,
            email: row.email ?? '',
            phone: row.phone ?? '',
            address: row.address ?? '',
            nationality: row.nationality ?? '',
            maritalStatus: row.maritalstatus ?? '',
            profession: row.profession ?? '',
            notes: row.notes ?? '',
            documents,
          })
        }
        if (rows.length === 0) { setCsvError(labels.import_error_empty); return }
        setCsvParsedRows(rows)
      } catch {
        setCsvError(labels.import_error_parse)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleRefresh = () => {
    setOwners((current) => [...(current || [])])
    toast.success(t.common.refreshed_success)
  }

  const handleImportConfirm = () => {
    const newOwners: Owner[] = csvParsedRows.map((row) => ({
      ...row,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      documents: row.documents ?? [],
      name: row.name ?? '',
      email: row.email ?? '',
      phone: row.phone ?? '',
    } as Owner))
    setOwners((current) => [...(current ?? []), ...newOwners])
    toast.success(`${newOwners.length} ${labels.import_success}`)
    setIsImportDialogOpen(false)
    setCsvParsedRows([])
    setCsvError(null)
  }

  const addDocument = () => {
    if (!newDocNumber.trim()) return

    setFormData((currentForm) => ({
      ...currentForm,
      documents: [...currentForm.documents, { type: newDocType.trim(), number: newDocNumber.trim() }],
    }))
    setNewDocType('')
    setNewDocNumber('')
  }

  const removeDocument = (index: number) => {
    setFormData((currentForm) => ({
      ...currentForm,
      documents: currentForm.documents.filter((_, docIndex) => docIndex !== index),
    }))
  }

  const getOwnerProperties = (ownerId: string) => {
    return (properties || []).filter((property) => property.ownerIds?.includes(ownerId))
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      documents: [],
      nationality: '',
      maritalStatus: '',
      profession: '',
      address: '',
      notes: '',
    })
    setNewDocType('')
    setNewDocNumber('')
    setEditingOwner(null)
    setIsDialogOpen(false)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (editingOwner) {
      setOwners((currentOwners) =>
        (currentOwners || []).map((owner) =>
          owner.id === editingOwner.id
            ? { ...formData, id: owner.id, createdAt: owner.createdAt }
            : owner
        )
      )
      toast.success(labels.updated_success)
    } else {
      const newOwner: Owner = {
        ...formData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      setOwners((currentOwners) => [...(currentOwners || []), newOwner])
      toast.success(labels.created_success)
    }

    resetForm()
  }

  const handleEdit = (owner: Owner) => {
    setEditingOwner(owner)
    setFormData({
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
      documents: owner.documents || [],
      nationality: owner.nationality || '',
      maritalStatus: owner.maritalStatus || '',
      profession: owner.profession || '',
      address: owner.address || '',
      notes: owner.notes || '',
    })
    setNewDocType('')
    setNewDocNumber('')
    setIsDialogOpen(true)
  }

  const handleDeleteClick = (owner: Owner) => {
    setOwnerToDelete(owner)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (!ownerToDelete) return

    setOwners((currentOwners) => (currentOwners || []).filter((owner) => owner.id !== ownerToDelete.id))
    toast.success(labels.deleted_success)
    setOwnerToDelete(null)
    setDeleteDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">{labels.title}</h2>
            <HelpButton docKey="owners" title={labels.title} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{labels.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {t.common.refresh}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => { setCsvParsedRows([]); setCsvError(null); setIsImportDialogOpen(true) }}>
            <UploadSimple weight="bold" size={16} />
            {labels.import_csv}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus weight="bold" size={16} />
              {labels.add_owner}
            </Button>
          </DialogTrigger>
          <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden max-h-[90vh] max-w-2xl">
            <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
              <DialogTitle className="flex items-center gap-1">
                {editingOwner ? labels.title_edit : labels.title_new}
                <HelpButton docKey="form-owner" title={labels.title_edit} />
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">{labels.full_name}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    placeholder={labels.full_name_placeholder}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{labels.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                    placeholder={labels.email_placeholder}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{labels.phone}</Label>
                  <PhoneInput
                    id="phone"
                    value={formData.phone}
                    onValueChange={(value) => setFormData({ ...formData, phone: value })}
                    placeholder={labels.phone_placeholder}
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>{labels.documents}</Label>
                  {formData.documents.map((document, index) => (
                    <div key={index} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <IdentificationCard size={16} className="text-muted-foreground shrink-0" />
                      <span className="flex-1">{document.type ? `${document.type}: ${document.number}` : document.number}</span>
                      <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeDocument(index)}>
                        <Trash size={14} className="text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newDocType}
                      onChange={(event) => setNewDocType(event.target.value)}
                      placeholder={labels.document_type_placeholder}
                      className="w-36 shrink-0"
                    />
                    <Input
                      value={newDocNumber}
                      onChange={(event) => setNewDocNumber(event.target.value)}
                      placeholder={labels.document_number_placeholder}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addDocument()
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addDocument} className="shrink-0">
                      <Plus weight="bold" size={16} />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">{labels.nationality}</Label>
                  <Input
                    id="nationality"
                    value={formData.nationality}
                    onChange={(event) => setFormData({ ...formData, nationality: event.target.value })}
                    placeholder={labels.nationality_placeholder}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maritalStatus">{labels.marital_status}</Label>
                  <Input
                    id="maritalStatus"
                    value={formData.maritalStatus}
                    onChange={(event) => setFormData({ ...formData, maritalStatus: event.target.value })}
                    placeholder={labels.marital_status_placeholder}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profession">{labels.profession}</Label>
                  <Input
                    id="profession"
                    value={formData.profession}
                    onChange={(event) => setFormData({ ...formData, profession: event.target.value })}
                    placeholder={labels.profession_placeholder}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="address">{labels.address}</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(event) => setFormData({ ...formData, address: event.target.value })}
                    placeholder={labels.address_placeholder}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="notes">{labels.notes}</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                    placeholder={labels.notes_placeholder}
                    rows={3}
                  />
                </div>
              </div>

              </div>
              <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t.common.update === 'Atualizar' ? 'Cancelar' : 'Cancel'}
                </Button>
                <Button type="submit">
                  {t.tasks_view.form.save}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Dialog open={isImportDialogOpen} onOpenChange={(open) => { setIsImportDialogOpen(open); if (!open) { setCsvParsedRows([]); setCsvError(null) } }}>
        <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden max-h-[90vh] max-w-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>{labels.import_dialog_title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <p className="text-sm text-muted-foreground">{labels.import_hint}</p>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadTemplate}>
              <DownloadSimple weight="bold" size={16} />
              {labels.import_download_template}
            </Button>
            <div className="space-y-2">
              <Label>{labels.import_select_file}</Label>
              <input
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:text-sm file:font-medium file:bg-background file:text-foreground hover:file:bg-accent cursor-pointer"
                onChange={handleCSVFile}
              />
            </div>
            {csvError && (
              <p className="text-sm text-destructive">{csvError}</p>
            )}
            {csvParsedRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{labels.import_preview} — {csvParsedRows.length} {labels.import_rows_found}</p>
                <div className="border rounded-lg overflow-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">{labels.import_col_name}</th>
                        <th className="text-left px-3 py-2 font-medium">{labels.import_col_email}</th>
                        <th className="text-left px-3 py-2 font-medium">{labels.import_col_phone}</th>
                        <th className="text-left px-3 py-2 font-medium">{labels.import_col_nationality}</th>
                        <th className="text-left px-3 py-2 font-medium">{labels.import_col_document}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvParsedRows.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2">{row.email}</td>
                          <td className="px-3 py-2">{row.phone}</td>
                          <td className="px-3 py-2">{row.nationality}</td>
                          <td className="px-3 py-2">{(row.documents ?? [])[0] ? `${(row.documents ?? [])[0].type}: ${(row.documents ?? [])[0].number}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              {labels.cancel}
            </Button>
            <Button onClick={handleImportConfirm} disabled={csvParsedRows.length === 0}>
              {labels.import_confirm_btn} {csvParsedRows.length > 0 && `(${csvParsedRows.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!owners || owners.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <User weight="duotone" size={64} className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{labels.empty}</p>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus weight="bold" size={16} />
              {labels.add_owner_empty}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {owners.map((owner) => {
            const ownerProperties = getOwnerProperties(owner.id)
            return (
              <Card key={owner.id} className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <User weight="duotone" size={24} className="text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{owner.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <House size={12} />
                          {ownerProperties.length} {labels.properties_count}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <EnvelopeSimple size={16} />
                      <span className="truncate">{owner.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone size={16} />
                      <span>{formatPhone(owner.phone)}</span>
                    </div>
                    {(owner.documents || []).length > 0 && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <IdentificationCard size={16} className="mt-0.5 shrink-0" />
                        <span>{(owner.documents || []).map((doc) => doc.type ? `${doc.type}: ${doc.number}` : doc.number).join(' | ')}</span>
                      </div>
                    )}
                  </div>
                  {ownerProperties.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">{labels.properties_label}</p>
                      <div className="flex flex-wrap gap-1">
                        {ownerProperties.slice(0, 3).map((property) => (
                          <Badge key={property.id} variant="outline" className="text-xs">
                            {property.name}
                          </Badge>
                        ))}
                        {ownerProperties.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{ownerProperties.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => handleEdit(owner)}
                    >
                      <Pencil size={14} />
                      {labels.edit}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteClick(owner)}
                    >
                      <Trash size={14} />
                      {labels.delete}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.delete_confirm_title}</AlertDialogTitle>
            <AlertDialogDescription>{labels.delete_confirm_description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.tasks_view.form.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {labels.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
