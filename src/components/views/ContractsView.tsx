import { useState, useEffect } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { MagnifyingGlass, Plus, Pencil, Trash, FileText, CalendarBlank, CurrencyDollar, House, User, ArrowsClockwise, FilePdf, Eye } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Contract, Guest, Property, ContractStatus, RentalType, ContractTemplate, Owner } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import { useCurrency } from '@/lib/CurrencyContext'
import { useDateFormat } from '@/lib/DateFormatContext'
import { format } from 'date-fns'
import GuestDialogForm from '../GuestDialogForm'
import { generateContractPDF, downloadPDF, openPDFInNewTab } from '@/lib/contractPDF'

export default function ContractsView() {
  const { t, language } = useLanguage()
  const { formatCurrency } = useCurrency()
  const { formatDate } = useDateFormat()
  const [contracts, setContracts] = useKV<Contract[]>('contracts', [])
  const [guests, setGuests] = useKV<Guest[]>('guests', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [owners] = useKV<Owner[]>('owners', [])
  const [templates] = useKV<ContractTemplate[]>('contract-templates', [])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [localGuests, setLocalGuests] = useState<Guest[]>([])
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false)
  const [selectedContractForPDF, setSelectedContractForPDF] = useState<Contract | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

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
    return guest ? guest.name : 'Unknown'
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
    // Pre-select the saved template if it exists
    setSelectedTemplateId(contract.templateId || '')
    setPdfDialogOpen(true)
  }

  const handlePDFGeneration = async (action: 'download' | 'view') => {
    if (!selectedContractForPDF || !selectedTemplateId) {
      toast.error('Selecione um template')
      return
    }

    const template = (templates || []).find(t => t.id === selectedTemplateId)
    if (!template) {
      toast.error('Template não encontrado')
      return
    }

    const guest = (guests || []).find(g => g.id === selectedContractForPDF.guestId)
    if (!guest) {
      toast.error('Hóspede não encontrado')
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
        toast.success('PDF baixado com sucesso')
      } else {
        openPDFInNewTab(pdf)
        toast.success('PDF aberto em nova aba')
      }

      setPdfDialogOpen(false)
      setSelectedContractForPDF(null)
      setSelectedTemplateId('')
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      toast.error('Erro ao gerar PDF')
    }
  }

  const getMatchingTemplates = (rentalType: RentalType) => {
    const typeMap: Record<RentalType, string> = {
      'monthly': 'monthly',
      'short-term': 'short-term',
    }
    return (templates || []).filter(t => t.type === typeMap[rentalType])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{t.contracts_view.title}</h2>
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
                  <Label htmlFor="contract-close-date">{language === 'pt' ? 'Data de fechamento do contrato' : 'Contract close date'} {t.contracts_view.form.optional}</Label>
                  <DateInput
                    id="contract-close-date"
                    value={formData.closeDate}
                    onChange={(value) => setFormData({ ...formData, closeDate: value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="contract-amount">{t.contracts_view.form.monthly_amount}</Label>
                  <Input
                    id="contract-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.monthlyAmount || ''}
                    onChange={(e) => setFormData({ ...formData, monthlyAmount: parseFloat(e.target.value) || 0 })}
                    placeholder={t.contracts_view.form.monthly_amount_placeholder}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="contract-special-payment">
                    {language === 'pt' ? 'Condição especial de pagamento' : 'Special payment condition'} {t.contracts_view.form.optional}
                  </Label>
                  <Textarea
                    id="contract-special-payment"
                    value={formData.specialPaymentCondition}
                    onChange={(e) => setFormData({ ...formData, specialPaymentCondition: e.target.value })}
                    placeholder={language === 'pt' ? 'Ex.: 50% na assinatura e 50% em 15 dias' : 'E.g.: 50% on signing and 50% in 15 days'}
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
                  <Label htmlFor="contract-template">{language === 'pt' ? 'Template de Contrato' : 'Contract Template'} {t.contracts_view.form.optional}</Label>
                  <Select
                    value={formData.templateId}
                    onValueChange={(value) => setFormData({ ...formData, templateId: value })}
                  >
                    <SelectTrigger id="contract-template">
                      <SelectValue placeholder={language === 'pt' ? 'Selecione um template' : 'Select a template'} />
                    </SelectTrigger>
                    <SelectContent>
                      {getMatchingTemplates(formData.rentalType).length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          {language === 'pt' ? 'Nenhum template disponível' : 'No templates available'}
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
                          {language === 'pt' ? 'Condição especial de pagamento' : 'Special payment condition'}
                        </p>
                        <p className="text-sm text-muted-foreground">{contract.specialPaymentCondition}</p>
                      </div>
                    )}
                    {contract.closeDate && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-1">
                          {language === 'pt' ? 'Data de fechamento do contrato' : 'Contract close date'}
                        </p>
                        <p className="text-sm text-muted-foreground">{format(new Date(contract.closeDate), 'dd/MM/yyyy')}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
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
              <Label htmlFor="pdf-template">Selecione o Template</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger id="pdf-template">
                  <SelectValue placeholder="Escolha um template..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedContractForPDF && getMatchingTemplates(selectedContractForPDF.rentalType).length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      Nenhum template disponível para este tipo de contrato
                    </div>
                  ) : (
                    selectedContractForPDF && getMatchingTemplates(selectedContractForPDF.rentalType).map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
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
    </div>
  )
}
