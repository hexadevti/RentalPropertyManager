import { useState, useEffect } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { DateInput } from '@/components/ui/date-input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Contract, Guest, Property, RentalType, ContractTemplate } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import { Plus, ArrowsClockwise } from '@phosphor-icons/react'
import GuestDialogForm from './GuestDialogForm'

interface ContractDialogFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preSelectedPropertyId?: string
  editingContract?: Contract | null
}

export default function ContractDialogForm({ 
  open, 
  onOpenChange, 
  preSelectedPropertyId,
  editingContract 
}: ContractDialogFormProps) {
  const { t } = useLanguage()
  const [contracts, setContracts] = useKV<Contract[]>('contracts', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [templates] = useKV<ContractTemplate[]>('contract-templates', [])
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [guestSelectKey, setGuestSelectKey] = useState(0)
  const [pendingGuestId, setPendingGuestId] = useState<string | null>(null)
  
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

  useEffect(() => {
    if (editingContract) {
      setFormData({
        guestId: editingContract.guestId,
        propertyIds: editingContract.propertyIds,
        rentalType: editingContract.rentalType,
        startDate: editingContract.startDate,
        endDate: editingContract.endDate,
        closeDate: editingContract.closeDate || '',
        paymentDueDay: editingContract.paymentDueDay,
        monthlyAmount: editingContract.monthlyAmount,
        specialPaymentCondition: editingContract.specialPaymentCondition || '',
        notes: editingContract.notes || '',
        templateId: editingContract.templateId || '',
      })
    } else if (preSelectedPropertyId) {
      setFormData(prev => ({
        ...prev,
        propertyIds: [preSelectedPropertyId],
        monthlyAmount: properties?.find(p => p.id === preSelectedPropertyId)?.pricePerMonth || 0
      }))
    }
  }, [editingContract, preSelectedPropertyId, properties])

  useEffect(() => {
    if (pendingGuestId && guests) {
      const guestExists = guests.find(g => g.id === pendingGuestId)
      if (guestExists) {
        setFormData(prev => ({
          ...prev,
          guestId: pendingGuestId
        }))
        setGuestSelectKey(prev => prev + 1)
        setPendingGuestId(null)
      }
    }
  }, [guests, pendingGuestId])

  const resetForm = () => {
    setFormData({
      guestId: '',
      propertyIds: preSelectedPropertyId ? [preSelectedPropertyId] : [],
      rentalType: 'monthly',
      startDate: '',
      endDate: '',
      closeDate: '',
      paymentDueDay: 5,
      monthlyAmount: preSelectedPropertyId 
        ? properties?.find(p => p.id === preSelectedPropertyId)?.pricePerMonth || 0
        : 0,
      specialPaymentCondition: '',
      notes: '',
      templateId: '',
    })
  }

  const calculateStatus = (startDate: string, endDate: string) => {
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
    
    onOpenChange(false)
    resetForm()
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
    setPendingGuestId(guestId)
  }

  const refreshGuestList = () => {
    setGuestSelectKey(prev => prev + 1)
    toast.success(t.contracts_view.form.guests_refreshed || 'Lista de hóspedes atualizada')
  }

  const getMatchingTemplates = (rentalType: RentalType) => {
    const typeMap: Record<RentalType, string> = {
      'monthly': 'monthly',
      'short-term': 'short-term',
    }
    return (templates || []).filter(t => t.type === typeMap[rentalType])
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen)
      if (!isOpen) resetForm()
    }}>
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
                key={guestSelectKey}
                value={formData.guestId || undefined}
                onValueChange={(value) => setFormData({ ...formData, guestId: value })}
                required
              >
                <SelectTrigger id="contract-guest">
                  <SelectValue placeholder={t.contracts_view.form.select_guest} />
                </SelectTrigger>
                <SelectContent>
                  {(guests || []).map((guest) => (
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
              <Label htmlFor="contract-close-date">{t.language === 'pt' ? 'Data de fechamento do contrato' : 'Contract close date'} {t.contracts_view.form.optional}</Label>
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
                {t.language === 'pt' ? 'Condição especial de pagamento' : 'Special payment condition'} {t.contracts_view.form.optional}
              </Label>
              <Textarea
                id="contract-special-payment"
                value={formData.specialPaymentCondition}
                onChange={(e) => setFormData({ ...formData, specialPaymentCondition: e.target.value })}
                placeholder={t.language === 'pt' ? 'Ex.: 50% na assinatura e 50% em 15 dias' : 'E.g.: 50% on signing and 50% in 15 days'}
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
              <Label htmlFor="contract-template">{t.language === 'pt' ? 'Template de Contrato' : 'Contract Template'} {t.contracts_view.form.optional}</Label>
              <Select
                value={formData.templateId}
                onValueChange={(value) => setFormData({ ...formData, templateId: value })}
              >
                <SelectTrigger id="contract-template">
                  <SelectValue placeholder={t.language === 'pt' ? 'Selecione um template' : 'Select a template'} />
                </SelectTrigger>
                <SelectContent>
                  {getMatchingTemplates(formData.rentalType).length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      {t.language === 'pt' ? 'Nenhum template disponível' : 'No templates available'}
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
              onOpenChange(false)
              resetForm()
            }}>
              {t.contracts_view.form.cancel}
            </Button>
            <Button type="submit">{t.contracts_view.form.save}</Button>
          </div>
        </form>
      </DialogContent>
      
      <GuestDialogForm
        open={guestDialogOpen}
        onOpenChange={setGuestDialogOpen}
        onGuestCreated={handleGuestCreated}
      />
    </Dialog>
  )
}
