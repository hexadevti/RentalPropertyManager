import { useState, useEffect } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { DateInput } from '@/components/ui/date-input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { MagnifyingGlass, Plus, Pencil, Trash, FileText, CalendarBlank, CurrencyDollar, House, User, ArrowsClockwise, FilePdf, Eye, ClipboardText, UploadSimple, DownloadSimple, Warning } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Contract, Guest, Inspection, Property, ContractStatus, RentalType, ContractTemplate, Owner, TEMPLATE_LANGUAGES, TemplateLanguage } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import { useCurrency } from '@/lib/CurrencyContext'
import { useDateFormat } from '@/lib/DateFormatContext'
import { format } from 'date-fns'
import GuestDialogForm from '../GuestDialogForm'
import { generateContractPDF, downloadPDF, openPDFInNewTab } from '@/lib/contractPDF'
import helpContent from '@/docs/contracts.md?raw'
import { HelpButton } from '@/components/HelpButton'

interface ContractsViewProps {
  onNavigate?: (tab: string) => void
}

export default function ContractsView({ onNavigate }: ContractsViewProps) {
  const { t, language } = useLanguage()
  const { formatCurrency } = useCurrency()
  const { formatDate } = useDateFormat()
  const [contracts, setContracts] = useKV<Contract[]>('contracts', [])
  const [guests, setGuests] = useKV<Guest[]>('guests', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [owners] = useKV<Owner[]>('owners', [])
  const [templates] = useKV<ContractTemplate[]>('contract-templates', [])
  const [inspections] = useKV<Inspection[]>('inspections', [])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)

  interface ParsedContractRow {
    guestName: string
    guestId: string
    propertyNames: string[]
    propertyIds: string[]
    rentalType: RentalType
    startDate: string
    endDate: string
    monthlyAmount: number
    paymentDueDay: number
    notes: string
    guestWarning: boolean
    propertyWarning: boolean
  }

  const [csvParsedRows, setCsvParsedRows] = useState<ParsedContractRow[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [localGuests, setLocalGuests] = useState<Guest[]>([])
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [selectedContractForPDF, setSelectedContractForPDF] = useState<Contract | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [pdfLanguageFilter, setPdfLanguageFilter] = useState<TemplateLanguage | 'all'>('all')

  useEffect(() => {
    setLocalGuests(guests || [])
  }, [guests])
  
  const [formData, setFormData] = useState({
    guestId: '',
    propertyIds: [] as string[],
    rentalType: 'monthly' as RentalType,
    startDate: '',
    endDate: '',
    closeDate: '',
    paymentDueDay: 5,
    monthlyAmount: 0,
    specialPaymentCondition: '',
    notes: '',
    templateId: '',
  })

  const handleDownloadTemplate = () => {
    const rows = [
      ['guestName', 'propertyNames', 'rentalType', 'startDate', 'endDate', 'monthlyAmount', 'paymentDueDay', 'notes'],
      ['João Silva', 'Apartamento Vista Mar', 'monthly', '2026-01-01', '2026-12-31', '2500.00', '5', ''],
      ['Maria Souza', 'Casa da Praia|Quarto 01', 'short-term', '2026-02-10', '2026-02-20', '800.00', '1', 'Temporada de verão'],
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-contratos.csv'
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

  const parseDate = (raw: string): string => {
    const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    return new Date().toISOString().split('T')[0]
  }

  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError(null)
    setCsvParsedRows([])
    const file = e.target.files?.[0]
    if (!file) return
    const allGuests = guests || []
    const allProperties = properties || []
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string).replace(/\r/g, '')
        const lines = text.split('\n').filter(l => l.trim())
        if (lines.length < 2) { setCsvError(t.contracts_view.import_error_empty); return }
        const sep = lines[0].includes(';') ? ';' : ','
        const headers = parseCSVLine(lines[0], sep).map(h => h.toLowerCase().replace(/\s/g, ''))
        const typeMap: Record<string, RentalType> = {
          monthly: 'monthly', mensal: 'monthly',
          'short-term': 'short-term', temporada: 'short-term', shortterm: 'short-term',
        }
        const rows: ParsedContractRow[] = []
        for (let i = 1; i < lines.length; i++) {
          const vals = parseCSVLine(lines[i], sep)
          const row: Record<string, string> = {}
          headers.forEach((h, idx) => { row[h] = vals[idx] ?? '' })
          if (!row.guestname && !row.startdate) continue
          const guestMatch = allGuests.find(g =>
            g.name.toLowerCase() === (row.guestname ?? '').toLowerCase() ||
            g.email.toLowerCase() === (row.guestname ?? '').toLowerCase()
          )
          const propNames = (row.propertynames ?? '').split('|').map(s => s.trim()).filter(Boolean)
          const matchedProps = propNames.map(name =>
            allProperties.find(p => p.name.toLowerCase() === name.toLowerCase())
          )
          rows.push({
            guestName: row.guestname ?? '',
            guestId: guestMatch?.id ?? '',
            propertyNames: propNames,
            propertyIds: matchedProps.filter(Boolean).map(p => p!.id),
            rentalType: typeMap[row.rentaltype?.toLowerCase()] ?? 'monthly',
            startDate: parseDate(row.startdate ?? ''),
            endDate: parseDate(row.enddate ?? ''),
            monthlyAmount: parseFloat((row.monthlyamount ?? '').replace(',', '.')) || 0,
            paymentDueDay: parseInt(row.paymentdueday ?? '') || 5,
            notes: row.notes ?? '',
            guestWarning: !guestMatch,
            propertyWarning: matchedProps.some(p => !p),
          })
        }
        if (rows.length === 0) { setCsvError(t.contracts_view.import_error_empty); return }
        setCsvParsedRows(rows)
      } catch {
        setCsvError(t.contracts_view.import_error_parse)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleImportConfirm = () => {
    const newContracts: Contract[] = csvParsedRows.map((row) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      guestId: row.guestId,
      propertyIds: row.propertyIds,
      rentalType: row.rentalType,
      startDate: row.startDate,
      endDate: row.endDate,
      paymentDueDay: row.paymentDueDay,
      monthlyAmount: row.monthlyAmount,
      notes: row.notes,
      status: calculateStatus(row.startDate, row.endDate),
    } as Contract))
    setContracts((current) => [...(current ?? []), ...newContracts])
    toast.success(`${newContracts.length} ${t.contracts_view.import_success}`)
    setIsImportDialogOpen(false)
    setCsvParsedRows([])
    setCsvError(null)
  }

  const resetForm = () => {
    setFormData({
      guestId: '',
      propertyIds: [],
      rentalType: 'monthly',
      startDate: '',
      endDate: '',
      closeDate: '',
      paymentDueDay: 5,
      monthlyAmount: 0,
      specialPaymentCondition: '',
      notes: '',
      templateId: '',
    })
    setEditingContract(null)
  }

  const calculateStatus = (startDate: string, endDate: string): ContractStatus => {
    const now = new Date()
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (now < start || now > end) {
      return 'expired'
    }
    return 'active'
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingContract) {
      setContracts((currentContracts) =>
        (currentContracts || []).map(c =>
          c.id === editingContract.id
            ? { 
                ...formData, 
                id: c.id, 
                status: calculateStatus(formData.startDate, formData.endDate),
                createdAt: c.createdAt,
                templateId: formData.templateId || undefined
              }
            : c
        )
      )
      toast.success(t.contracts_view.form.updated_success)
    } else {
      const newContract: Contract = {
        ...formData,
        id: Date.now().toString(),
        status: calculateStatus(formData.startDate, formData.endDate),
        createdAt: new Date().toISOString(),
        templateId: formData.templateId || undefined,
      }
      setContracts((currentContracts) => [...(currentContracts || []), newContract])
      toast.success(t.contracts_view.form.created_success)
    }
    
    setDialogOpen(false)
    resetForm()
  }

  const handleEdit = (contract: Contract) => {
    setEditingContract(contract)
    setFormData({
      guestId: contract.guestId,
      propertyIds: contract.propertyIds,
      rentalType: contract.rentalType,
      startDate: contract.startDate,
      endDate: contract.endDate,
      closeDate: contract.closeDate || '',
      paymentDueDay: contract.paymentDueDay,
      monthlyAmount: contract.monthlyAmount,
      specialPaymentCondition: contract.specialPaymentCondition || '',
      notes: contract.notes || '',
      templateId: contract.templateId || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return
    setContracts((currentContracts) => (currentContracts || []).filter(c => c.id !== id))
    toast.success(t.contracts_view.deleted_success)
  }

  const togglePropertySelection = (propertyId: string) => {
    setFormData(prev => ({
      ...prev,
      propertyIds: prev.propertyIds.includes(propertyId)
        ? prev.propertyIds.filter(id => id !== propertyId)
        : [...prev.propertyIds, propertyId]
    }))
  }

  const handleGuestCreated = (guestId: string) => {
    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        guestId: guestId
      }))
    }, 100)
  }

  const refreshGuestList = async () => {
    const currentGuests = guests || []
    setLocalGuests([...currentGuests])
    toast.success(t.contracts_view.form.guests_refreshed)
  }

  const getGuestName = (guestId: string) => {
    const guest = (guests || []).find(g => g.id === guestId)
    return guest ? guest.name : t.contracts_view.unknown_guest
  }

  const getPropertyNames = (propertyIds: string[]) => {
    return propertyIds
      .map(id => (properties || []).find(p => p.id === id)?.name)
      .filter(Boolean)
      .join(', ')
  }

  const getStatusColor = (status: ContractStatus) => {
    switch (status) {
      case 'active':
        return 'bg-success/10 text-success-foreground border-success/20'
      case 'expired':
        return 'bg-muted text-muted-foreground border-border'
      case 'cancelled':
        return 'bg-destructive/10 text-destructive border-destructive/20'
    }
  }

  const filteredContracts = (contracts || [])
    .filter(contract => {
      const matchesSearch = getGuestName(contract.guestId).toLowerCase().includes(searchQuery.toLowerCase()) ||
                           getPropertyNames(contract.propertyIds).toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || contract.status === statusFilter
      return matchesSearch && matchesStatus
    })

  const handleRefresh = () => {
    setContracts((current) => [...(current || [])])
    toast.success(t.common.refreshed_success)
  }

  const handleGeneratePDF = (contract: Contract) => {
    setSelectedContractForPDF(contract)
    setSelectedTemplateId(contract.templateId || '')
    setPdfLanguageFilter(language === 'en' ? 'en' : 'pt')
    setPdfDialogOpen(true)
  }

  const handlePDFGeneration = async (action: 'download' | 'view') => {
    if (!selectedContractForPDF || !selectedTemplateId) {
      toast.error(t.contracts_view.pdf_template_required)
      return
    }

    const template = (templates || []).find(t => t.id === selectedTemplateId)
    if (!template) {
      toast.error(t.contracts_view.pdf_template_not_found)
      return
    }

    const guest = (guests || []).find(g => g.id === selectedContractForPDF.guestId)
    if (!guest) {
      toast.error(t.contracts_view.pdf_guest_not_found)
      return
    }

    const contractProperties = (properties || []).filter(p => 
      selectedContractForPDF.propertyIds.includes(p.id)
    )

    const propertyOwnerIds = new Set<string>()
    contractProperties.forEach(property => {
      property.ownerIds?.forEach(ownerId => propertyOwnerIds.add(ownerId))
    })

    const contractOwners = (owners || []).filter(o => propertyOwnerIds.has(o.id))

    try {
      const pdf = await generateContractPDF(
        {
          contract: selectedContractForPDF,
          guest,
          properties: contractProperties,
          template,
          owners: contractOwners,
        },
        formatCurrency,
        formatDate
      )

      if (action === 'download') {
        const filename = `contrato-${guest.name.replace(/\s+/g, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`
        downloadPDF(pdf, filename)
        toast.success(t.contracts_view.pdf_download_success)
      } else {
        openPDFInNewTab(pdf)
        toast.success(t.contracts_view.pdf_open_success)
      }

      setPdfDialogOpen(false)
      setSelectedContractForPDF(null)
      setSelectedTemplateId('')
    } catch (error) {
      console.error('Failed to generate contract PDF:', error)
      toast.error(t.contracts_view.pdf_error)
    }
  }

  const getMatchingTemplates = (rentalType: RentalType, langFilter: TemplateLanguage | 'all' = 'all') => {
    return (templates || []).filter((t) =>
      t.type === rentalType &&
      (langFilter === 'all' || t.language === langFilter)
    )
  }

  const getLanguageLabel = (code: TemplateLanguage) =>
    TEMPLATE_LANGUAGES.find((l) => l.code === code)?.nativeName ?? code.toUpperCase()

  const getContractInspections = (contractId: string) =>
    (inspections || []).filter((i) => i.contractId === contractId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">{t.contracts_view.title}</h2>
            <HelpButton content={helpContent} title="Ajuda — Contratos" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {t.common.refresh}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => { setCsvParsedRows([]); setCsvError(null); setIsImportDialogOpen(true) }}>
            <UploadSimple weight="bold" size={16} />
            {t.contracts_view.import_csv}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus weight="bold" />
                {t.contracts_view.add_contract}
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingContract ? t.contracts_view.form.title_edit : t.contracts_view.form.title_new}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="contract-guest">{t.contracts_view.form.guest}</Label>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="gap-1.5 h-7 text-xs"
                        onClick={refreshGuestList}
                      >
                        <ArrowsClockwise size={14} weight="bold" />
                        {t.contracts_view.form.refresh_guests}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        className="gap-1.5 h-7 text-xs"
                        onClick={() => setGuestDialogOpen(true)}
                      >
                        <Plus size={14} weight="bold" />
                        {t.contracts_view.form.new_guest}
                      </Button>
                    </div>
                  </div>
                  <Select
                    value={formData.guestId}
                    onValueChange={(value) => setFormData({ ...formData, guestId: value })}
                    required
                  >
                    <SelectTrigger id="contract-guest">
                      <SelectValue placeholder={t.contracts_view.form.select_guest} />
                    </SelectTrigger>
                    <SelectContent>
                      {localGuests.map((guest) => (
                        <SelectItem key={guest.id} value={guest.id}>
                          {guest.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label>{t.contracts_view.form.properties}</Label>
                  <div className="border border-input rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                    {(properties || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t.contracts_view.form.select_properties}</p>
                    ) : (
                      (properties || []).map((property) => (
                        <label key={property.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={formData.propertyIds.includes(property.id)}
                            onChange={() => togglePropertySelection(property.id)}
                            className="rounded border-input"
                          />
                          <span className="text-sm">{property.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="contract-rental-type">{t.contracts_view.form.rental_type}</Label>
                  <Select
                    value={formData.rentalType}
                    onValueChange={(value: RentalType) => setFormData({ ...formData, rentalType: value })}
                    required
                  >
                    <SelectTrigger id="contract-rental-type">
                      <SelectValue placeholder={t.contracts_view.form.select_rental_type} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short-term">{t.contracts_view.rental_type['short-term']}</SelectItem>
                      <SelectItem value="monthly">{t.contracts_view.rental_type.monthly}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="contract-payment-due">{t.contracts_view.form.payment_due_day}</Label>
                  <Input
                    id="contract-payment-due"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.paymentDueDay}
                    onChange={(e) => setFormData({ ...formData, paymentDueDay: parseInt(e.target.value) || 1 })}
                    placeholder={t.contracts_view.form.payment_due_placeholder}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="contract-start-date">{t.contracts_view.form.start_date}</Label>
                  <DateInput
                    id="contract-start-date"
                    value={formData.startDate}
                    onChange={(value) => setFormData({ ...formData, startDate: value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="contract-end-date">{t.contracts_view.form.end_date}</Label>
                  <DateInput
                    id="contract-end-date"
                    value={formData.endDate}
                    onChange={(value) => setFormData({ ...formData, endDate: value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="contract-close-date">{t.contracts_view.form.close_date} {t.contracts_view.form.optional}</Label>
                  <DateInput
                    id="contract-close-date"
                    value={formData.closeDate}
                    onChange={(value) => setFormData({ ...formData, closeDate: value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="contract-amount">{t.contracts_view.form.monthly_amount}</Label>
                  <DecimalInput
                    id="contract-amount"
                    min="0"
                    value={formData.monthlyAmount || undefined}
                    onValueChange={(value) => setFormData({ ...formData, monthlyAmount: value || 0 })}
                    placeholder={t.contracts_view.form.monthly_amount_placeholder}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="contract-special-payment">
                    {t.contracts_view.form.special_payment_condition} {t.contracts_view.form.optional}
                  </Label>
                  <Textarea
                    id="contract-special-payment"
                    value={formData.specialPaymentCondition}
                    onChange={(e) => setFormData({ ...formData, specialPaymentCondition: e.target.value })}
                    placeholder={t.contracts_view.form.special_payment_placeholder}
                    rows={2}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="contract-notes">{t.contracts_view.form.notes} {t.contracts_view.form.optional}</Label>
                  <Textarea
                    id="contract-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t.contracts_view.form.notes_placeholder}
                    rows={3}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="contract-template">{t.contracts_view.form.template} {t.contracts_view.form.optional}</Label>
                  <Select
                    value={formData.templateId}
                    onValueChange={(value) => setFormData({ ...formData, templateId: value })}
                  >
                    <SelectTrigger id="contract-template">
                      <SelectValue placeholder={t.contracts_view.form.select_template} />
                    </SelectTrigger>
                    <SelectContent>
                      {getMatchingTemplates(formData.rentalType).length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          {t.contracts_view.form.no_templates_available}
                        </div>
                      ) : (
                        getMatchingTemplates(formData.rentalType).map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setDialogOpen(false)
                  resetForm()
                }}>
                  {t.contracts_view.form.cancel}
                </Button>
                <Button type="submit">{t.contracts_view.form.save}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <Input
            placeholder={t.contracts_view.search_placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value: ContractStatus | 'all') => setStatusFilter(value)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.contracts_view.filter_all}</SelectItem>
            <SelectItem value="active">{t.contracts_view.filter_active}</SelectItem>
            <SelectItem value="expired">{t.contracts_view.filter_expired}</SelectItem>
            <SelectItem value="cancelled">{t.contracts_view.filter_cancelled}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredContracts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText size={64} weight="duotone" className="text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {searchQuery || statusFilter !== 'all' ? t.contracts_view.no_contracts : t.contracts_view.no_contracts}
            </h3>
            {!searchQuery && statusFilter === 'all' && (
              <p className="text-muted-foreground text-center max-w-md">
                {t.contracts_view.add_first}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredContracts.map((contract) => (
            <Card key={contract.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-xl">{getGuestName(contract.guestId)}</CardTitle>
                      <Badge className={getStatusColor(contract.status)}>
                        {t.contracts_view.status[contract.status]}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <FileText size={14} weight="duotone" />
                        {t.contracts_view.rental_type[contract.rentalType]}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                      <div className="flex items-start gap-2">
                        <House size={18} weight="duotone" className="text-primary mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t.contracts_view.form.properties}</p>
                          <p className="text-sm font-medium">
                            {contract.propertyIds.length} {t.contracts_view.properties_count}
                          </p>
                          <p className="text-xs text-muted-foreground">{getPropertyNames(contract.propertyIds)}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CalendarBlank size={18} weight="duotone" className="text-primary mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t.contracts_view.period}</p>
                          <p className="text-sm font-medium">
                            {format(new Date(contract.startDate), 'dd/MM/yyyy')} - {format(new Date(contract.endDate), 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CurrencyDollar size={18} weight="duotone" className="text-primary mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t.contracts_view.monthly_amount}</p>
                          <p className="text-sm font-medium">{formatCurrency(contract.monthlyAmount)}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CalendarBlank size={18} weight="duotone" className="text-primary mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t.contracts_view.payment_due}</p>
                          <p className="text-sm font-medium">{t.contracts_view.day} {contract.paymentDueDay}</p>
                        </div>
                      </div>
                    </div>
                    {contract.notes && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-sm text-muted-foreground italic">{contract.notes}</p>
                      </div>
                    )}
                    {contract.specialPaymentCondition && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">
                          {t.contracts_view.special_payment_condition}
                        </p>
                        <p className="text-sm text-muted-foreground">{contract.specialPaymentCondition}</p>
                      </div>
                    )}
                    {contract.closeDate && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">
                          {t.contracts_view.close_date}
                        </p>
                        <p className="text-sm text-muted-foreground">{format(new Date(contract.closeDate), 'dd/MM/yyyy')}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    {(() => {
                      const contractInspections = getContractInspections(contract.id)
                      return contractInspections.length > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-8 text-xs"
                          onClick={() => onNavigate?.('inspections')}
                          title={t.contracts_view.view_inspections_title}
                        >
                          <ClipboardText size={14} weight="duotone" className="text-primary" />
                          {contractInspections.length === 1
                            ? t.contracts_view.one_inspection
                            : `${contractInspections.length} ${t.contracts_view.many_inspections}`}
                        </Button>
                      ) : null
                    })()}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleGeneratePDF(contract)}
                      title="Gerar PDF"
                    >
                      <FilePdf size={18} className="text-primary" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(contract)}
                    >
                      <Pencil size={18} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(contract.id)}
                    >
                      <Trash size={18} className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
      
      <GuestDialogForm
        open={guestDialogOpen}
        onOpenChange={setGuestDialogOpen}
        onGuestCreated={handleGuestCreated}
      />

      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar PDF do Contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="pdf-language">Idioma do template</Label>
              <Select
                value={pdfLanguageFilter}
                onValueChange={(value) => {
                  setPdfLanguageFilter(value as TemplateLanguage | 'all')
                  setSelectedTemplateId('')
                }}
              >
                <SelectTrigger id="pdf-language">
                  <SelectValue placeholder="Todos os idiomas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os idiomas</SelectItem>
                  {TEMPLATE_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.nativeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="pdf-template">Selecione o Template</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger id="pdf-template">
                  <SelectValue placeholder="Escolha um template..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedContractForPDF && getMatchingTemplates(selectedContractForPDF.rentalType, pdfLanguageFilter).length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      Nenhum template disponível para este idioma e tipo de contrato
                    </div>
                  ) : (
                    selectedContractForPDF && getMatchingTemplates(selectedContractForPDF.rentalType, pdfLanguageFilter).map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        <span>{template.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({getLanguageLabel(template.language)})</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => handlePDFGeneration('view')}
                disabled={!selectedTemplateId}
              >
                <Eye size={18} weight="duotone" />
                Visualizar
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => handlePDFGeneration('download')}
                disabled={!selectedTemplateId}
              >
                <FilePdf size={18} weight="duotone" />
                Baixar PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportDialogOpen} onOpenChange={(open) => { setIsImportDialogOpen(open); if (!open) { setCsvParsedRows([]); setCsvError(null) } }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.contracts_view.import_dialog_title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t.contracts_view.import_hint}</p>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadTemplate}>
              <DownloadSimple weight="bold" size={16} />
              {t.contracts_view.import_download_template}
            </Button>
            <div className="space-y-2">
              <Label>{t.contracts_view.import_select_file}</Label>
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
                <p className="text-sm font-medium">{t.contracts_view.import_preview} — {csvParsedRows.length} {t.contracts_view.import_rows_found}</p>
                <div className="border rounded-lg overflow-auto max-h-72">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">{t.contracts_view.import_col_guest}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.contracts_view.import_col_properties}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.contracts_view.import_col_type}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.contracts_view.import_col_period}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.contracts_view.import_col_amount}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvParsedRows.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              {row.guestWarning && <Warning size={14} className="text-amber-500 shrink-0" />}
                              <span className={row.guestWarning ? 'text-amber-600' : ''}>{row.guestName || '—'}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              {row.propertyWarning && <Warning size={14} className="text-amber-500 shrink-0" />}
                              <span className={row.propertyWarning ? 'text-amber-600' : ''}>{row.propertyNames.join(', ') || '—'}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline">{t.contracts_view.rental_type[row.rentalType]}</Badge>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{row.startDate} → {row.endDate}</td>
                          <td className="px-3 py-2 font-medium">{formatCurrency(row.monthlyAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {csvParsedRows.some(r => r.guestWarning || r.propertyWarning) && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <Warning size={12} />
                    Linhas em amarelo indicam hóspede ou propriedade não encontrados — serão importados sem vínculo.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              {t.contracts_view.cancel}
            </Button>
            <Button onClick={handleImportConfirm} disabled={csvParsedRows.length === 0}>
              {t.contracts_view.import_confirm_btn} {csvParsedRows.length > 0 && `(${csvParsedRows.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
