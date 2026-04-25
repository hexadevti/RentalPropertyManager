import { useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MagnifyingGlass, Plus, Pencil, Trash, Wrench, Envelope, Phone, Briefcase, ArrowsClockwise, UploadSimple, DownloadSimple } from '@phosphor-icons/react'


import { HelpButton } from '@/components/HelpButton'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/LanguageContext'
import { usePhoneFormat } from '@/lib/PhoneFormatContext'

export interface ServiceProvider {
  id: string
  name: string
  service: string
  phone: string
  email?: string
  document?: string
  address?: string
  notes?: string
  createdAt: string
}

export default function ServiceProvidersView() {
  const { t } = useLanguage()
  const { formatPhone } = usePhoneFormat()
  const [providers, setProviders] = useKV<ServiceProvider[]>('service-providers', [])
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ServiceProvider | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [csvParsedRows, setCsvParsedRows] = useState<Partial<ServiceProvider>[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    service: '',
    phone: '',
    email: '',
    document: '',
    address: '',
    notes: '',
  })

  const resetForm = () => {
    setFormData({
      name: '',
      service: '',
      phone: '',
      email: '',
      document: '',
      address: '',
      notes: '',
    })
    setEditingProvider(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingProvider) {
      setProviders((currentProviders) =>
        (currentProviders || []).map(p =>
          p.id === editingProvider.id
            ? { ...formData, id: p.id, createdAt: p.createdAt }
            : p
        )
      )
      toast.success(t.service_providers_view.updated_success)
    } else {
      const newProvider: ServiceProvider = {
        ...formData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      setProviders((currentProviders) => [...(currentProviders || []), newProvider])
      toast.success(t.service_providers_view.created_success)
    }
    
    setDialogOpen(false)
    resetForm()
  }

  const handleEdit = (provider: ServiceProvider) => {
    setEditingProvider(provider)
    setFormData({
      name: provider.name,
      service: provider.service,
      phone: provider.phone,
      email: provider.email || '',
      document: provider.document || '',
      address: provider.address || '',
      notes: provider.notes || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return
    setProviders((currentProviders) => (currentProviders || []).filter(p => p.id !== id))
    toast.success(t.service_providers_view.deleted_success)
  }

  const filteredProviders = (providers || []).filter(provider =>
    provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (provider.email && provider.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleDownloadTemplate = () => {
    const rows = [
      ['name', 'service', 'phone', 'email', 'document', 'address', 'notes'],
      ['Carlos Eletricista', 'Eletricista', '(11) 99999-0001', 'carlos@email.com', '000.000.000-00', 'Rua das Flores, 10', ''],
      ['Ana Limpeza', 'Limpeza', '(11) 99999-0002', '', '', '', 'Atende fins de semana'],
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-prestadores.csv'
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
        if (lines.length < 2) { setCsvError(t.service_providers_view.import_error_empty); return }
        const sep = lines[0].includes(';') ? ';' : ','
        const headers = parseCSVLine(lines[0], sep).map(h => h.toLowerCase().replace(/\s/g, ''))
        const rows: Partial<ServiceProvider>[] = []
        for (let i = 1; i < lines.length; i++) {
          const vals = parseCSVLine(lines[i], sep)
          const row: Record<string, string> = {}
          headers.forEach((h, idx) => { row[h] = vals[idx] ?? '' })
          if (!row.name) continue
          rows.push({
            name: row.name,
            service: row.service ?? '',
            phone: row.phone ?? '',
            email: row.email ?? '',
            document: row.document ?? '',
            address: row.address ?? '',
            notes: row.notes ?? '',
          })
        }
        if (rows.length === 0) { setCsvError(t.service_providers_view.import_error_empty); return }
        setCsvParsedRows(rows)
      } catch {
        setCsvError(t.service_providers_view.import_error_parse)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleImportConfirm = () => {
    const newProviders: ServiceProvider[] = csvParsedRows.map((row) => ({
      ...row,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      name: row.name ?? '',
      service: row.service ?? '',
      phone: row.phone ?? '',
    } as ServiceProvider))
    setProviders((current) => [...(current ?? []), ...newProviders])
    toast.success(`${newProviders.length} ${t.service_providers_view.import_success}`)
    setIsImportDialogOpen(false)
    setCsvParsedRows([])
    setCsvError(null)
  }

  const handleRefresh = () => {
    setProviders((current) => [...(current || [])])
    toast.success(t.common.refreshed_success)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">{t.service_providers_view.title}</h2>
            <HelpButton docKey="service-providers" title={t.service_providers_view.help_title} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {t.common.refresh}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => { setCsvParsedRows([]); setCsvError(null); setIsImportDialogOpen(true) }}>
            <UploadSimple weight="bold" size={16} />
            {t.service_providers_view.import_csv}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus weight="bold" />
                {t.service_providers_view.add_provider}
              </Button>
            </DialogTrigger>
          <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden max-h-[90vh] max-w-2xl">
            <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
              <DialogTitle className="flex items-center gap-1">
                {editingProvider ? t.service_providers_view.form.title_edit : t.service_providers_view.form.title_new}
                <HelpButton docKey="form-service-provider" title={t.service_providers_view.form.help_title} />
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="provider-name">{t.service_providers_view.form.name_required}</Label>
                  <Input
                    id="provider-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.service_providers_view.form.name_placeholder}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="provider-service">{t.service_providers_view.form.service_required}</Label>
                  <Input
                    id="provider-service"
                    value={formData.service}
                    onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                    placeholder={t.service_providers_view.form.service_placeholder}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="provider-phone">{t.service_providers_view.form.phone_required}</Label>
                  <PhoneInput
                    id="provider-phone"
                    value={formData.phone}
                    onValueChange={(value) => setFormData({ ...formData, phone: value })}
                    placeholder={t.service_providers_view.form.phone_placeholder}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="provider-email">{t.service_providers_view.form.email_optional}</Label>
                  <Input
                    id="provider-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={t.service_providers_view.form.email_placeholder}
                  />
                </div>

                <div>
                  <Label htmlFor="provider-document">{t.service_providers_view.form.document_optional}</Label>
                  <Input
                    id="provider-document"
                    value={formData.document}
                    onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                    placeholder={t.service_providers_view.form.document_placeholder}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="provider-address">{t.service_providers_view.form.address_optional}</Label>
                  <Input
                    id="provider-address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder={t.service_providers_view.form.address_placeholder}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="provider-notes">{t.service_providers_view.form.notes_optional}</Label>
                  <Textarea
                    id="provider-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t.service_providers_view.form.notes_placeholder}
                    rows={3}
                  />
                </div>
              </div>

              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t shrink-0 bg-background">
                <Button type="button" variant="outline" onClick={() => {
                  setDialogOpen(false)
                  resetForm()
                }}>
                  {t.service_providers_view.form.cancel}
                </Button>
                <Button type="submit">{t.service_providers_view.form.save}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Dialog open={isImportDialogOpen} onOpenChange={(open) => { setIsImportDialogOpen(open); if (!open) { setCsvParsedRows([]); setCsvError(null) } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.service_providers_view.import_dialog_title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t.service_providers_view.import_hint}</p>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadTemplate}>
              <DownloadSimple weight="bold" size={16} />
              {t.service_providers_view.import_download_template}
            </Button>
            <div className="space-y-2">
              <Label>{t.service_providers_view.import_select_file}</Label>
              <input
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:text-sm file:font-medium file:bg-background file:text-foreground hover:file:bg-accent cursor-pointer"
                onChange={handleCSVFile}
              />
            </div>
            {csvError && <p className="text-sm text-destructive">{csvError}</p>}
            {csvParsedRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t.service_providers_view.import_preview} — {csvParsedRows.length} {t.service_providers_view.import_rows_found}</p>
                <div className="border rounded-lg overflow-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">{t.service_providers_view.import_col_name}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.service_providers_view.import_col_service}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.service_providers_view.import_col_phone}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.service_providers_view.import_col_email}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.service_providers_view.import_col_document}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvParsedRows.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 font-medium">{row.name}</td>
                          <td className="px-3 py-2">{row.service}</td>
                          <td className="px-3 py-2">{row.phone}</td>
                          <td className="px-3 py-2">{row.email}</td>
                          <td className="px-3 py-2">{row.document}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              {t.service_providers_view.cancel}
            </Button>
            <Button onClick={handleImportConfirm} disabled={csvParsedRows.length === 0}>
              {t.service_providers_view.import_confirm_btn} {csvParsedRows.length > 0 && `(${csvParsedRows.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <Input
          placeholder={t.service_providers_view.search_placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredProviders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Wrench size={64} weight="duotone" className="text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {searchQuery ? t.service_providers_view.no_results : t.service_providers_view.no_providers}
            </h3>
            {!searchQuery && (
              <p className="text-muted-foreground text-center max-w-md">
                {t.service_providers_view.add_first}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredProviders.map((provider) => (
            <Card key={provider.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center">
                      <Wrench size={24} weight="duotone" className="text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-xl mb-1">{provider.name}</CardTitle>
                      <div className="flex items-center gap-2 text-sm mb-2">
                        <Briefcase size={16} weight="duotone" className="text-accent" />
                        <span className="font-medium text-accent">{provider.service}</span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Phone size={16} weight="duotone" />
                          {formatPhone(provider.phone)}
                        </div>
                        {provider.email && (
                          <div className="flex items-center gap-1.5">
                            <Envelope size={16} weight="duotone" />
                            {provider.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(provider)}
                    >
                      <Pencil size={18} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(provider.id)}
                    >
                      <Trash size={18} className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {(provider.document || provider.address || provider.notes) && (
                <CardContent>
                  <div className="space-y-2">
                    {provider.document && (
                      <div className="text-sm">
                        <span className="font-medium text-foreground">{t.service_providers_view.document_label}:</span>{' '}
                        <span className="text-muted-foreground">{provider.document}</span>
                      </div>
                    )}
                    {provider.address && (
                      <div className="text-sm">
                        <span className="font-medium text-foreground">{t.service_providers_view.address_label}:</span>{' '}
                        <span className="text-muted-foreground">{provider.address}</span>
                      </div>
                    )}
                    {provider.notes && (
                      <div className="text-sm">
                        <span className="font-medium text-foreground">{t.service_providers_view.notes_label}:</span>{' '}
                        <span className="text-muted-foreground italic">{provider.notes}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
