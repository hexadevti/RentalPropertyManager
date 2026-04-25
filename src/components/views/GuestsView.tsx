import { useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { MagnifyingGlass, Plus, Pencil, Trash, User, Envelope, Phone, IdentificationCard, MapPin, Flag, Cake, ArrowsClockwise, Users, UploadSimple, DownloadSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Guest, Contract } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import { usePhoneFormat } from '@/lib/PhoneFormatContext'
import { format } from 'date-fns'
import GuestDialogForm from '@/components/GuestDialogForm'

import { HelpButton } from '@/components/HelpButton'

export default function GuestsView() {
  const { t } = useLanguage()
  const { formatPhone } = usePhoneFormat()
  const [guests, setGuests] = useKV<Guest[]>('guests', [])
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [csvParsedRows, setCsvParsedRows] = useState<Partial<Guest>[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)

  const resetForm = () => {
    setEditingGuest(null)
  }

  const handleDownloadTemplate = () => {
    const rows = [
      ['name', 'email', 'phone', 'address', 'nationality', 'maritalStatus', 'profession', 'dateOfBirth', 'notes', 'documentType', 'documentNumber'],
      ['João Silva', 'joao@email.com', '(11) 99999-0000', 'Rua das Flores, 123', 'Brasileiro', 'Solteiro', 'Engenheiro', '1990-05-20', '', 'CPF', '000.000.000-00'],
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-hospedes.csv'
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
        if (lines.length < 2) { setCsvError(t.guests_view.import_error_empty); return }
        const sep = lines[0].includes(';') ? ';' : ','
        const headers = parseCSVLine(lines[0], sep).map(h => h.toLowerCase().replace(/\s/g, ''))
        const rows: Partial<Guest>[] = []
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
            dateOfBirth: row.dateofbirth ?? '',
            notes: row.notes ?? '',
            documents,
          })
        }
        if (rows.length === 0) { setCsvError(t.guests_view.import_error_empty); return }
        setCsvParsedRows(rows)
      } catch {
        setCsvError(t.guests_view.import_error_parse)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleImportConfirm = () => {
    const newGuests: Guest[] = csvParsedRows.map((row) => ({
      ...row,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      documents: row.documents ?? [],
      name: row.name ?? '',
      email: row.email ?? '',
      phone: row.phone ?? '',
    } as Guest))
    setGuests((current) => [...(current ?? []), ...newGuests])
    toast.success(`${newGuests.length} ${t.guests_view.import_success}`)
    setIsImportDialogOpen(false)
    setCsvParsedRows([])
    setCsvError(null)
  }

  const handleEdit = (guest: Guest) => {
    setEditingGuest(guest)
    setDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return
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
          <div className="flex items-center gap-1">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">{t.guests_view.title}</h2>
            <HelpButton docKey="guests" title="Ajuda — Hóspedes" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {t.common.refresh}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => { setCsvParsedRows([]); setCsvError(null); setIsImportDialogOpen(true) }}>
            <UploadSimple weight="bold" size={16} />
            {t.guests_view.import_csv}
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
                            {formatPhone(guest.phone)}
                          </div>
                          {((guest.sponsors?.length || 0) > 0 || (guest.dependents?.length || 0) > 0) && (
                            <div className="flex items-center gap-1.5">
                              <Users size={16} weight="duotone" />
                              {`${guest.sponsors?.length || 0} ${t.guests_view.sponsors} • ${guest.dependents?.length || 0} ${t.guests_view.dependents}`}
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
                        {t.guests_view.sponsors}
                      </p>
                      <div className="grid gap-2">
                        {(guest.sponsors || []).map((sponsor) => (
                          <div key={sponsor.id} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                            <div className="font-medium">{sponsor.name || t.guests_view.unnamed}</div>
                            <div className="text-muted-foreground">
                              {[sponsor.email, sponsor.phone ? formatPhone(sponsor.phone) : ''].filter(Boolean).join(' • ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(guest.dependents?.length || 0) > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {t.guests_view.dependents}
                      </p>
                      <div className="grid gap-2">
                        {(guest.dependents || []).map((dependent) => (
                          <div key={dependent.id} className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
                            <div className="font-medium">{dependent.name || t.guests_view.unnamed}</div>
                            <div className="text-muted-foreground">
                              {[dependent.email, dependent.phone ? formatPhone(dependent.phone) : ''].filter(Boolean).join(' • ')}
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

      <Dialog open={isImportDialogOpen} onOpenChange={(open) => { setIsImportDialogOpen(open); if (!open) { setCsvParsedRows([]); setCsvError(null) } }}>
        <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden max-h-[90vh] max-w-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>{t.guests_view.import_dialog_title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <p className="text-sm text-muted-foreground">{t.guests_view.import_hint}</p>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadTemplate}>
              <DownloadSimple weight="bold" size={16} />
              {t.guests_view.import_download_template}
            </Button>
            <div className="space-y-2">
              <Label>{t.guests_view.import_select_file}</Label>
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
                <p className="text-sm font-medium">{t.guests_view.import_preview} — {csvParsedRows.length} {t.guests_view.import_rows_found}</p>
                <div className="border rounded-lg overflow-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">{t.guests_view.import_col_name}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.guests_view.import_col_email}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.guests_view.import_col_phone}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.guests_view.import_col_nationality}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.guests_view.import_col_document}</th>
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
              {t.guests_view.form.cancel}
            </Button>
            <Button onClick={handleImportConfirm} disabled={csvParsedRows.length === 0}>
              {t.guests_view.import_confirm_btn} {csvParsedRows.length > 0 && `(${csvParsedRows.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
