import { useState, useEffect } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Contract, Guest, Property, RentalType } from '@/types'
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
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [guestSelectKey, setGuestSelectKey] = useState(0)
  const [pendingGuestId, setPendingGuestId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    guestId: '',
    propertyIds: [] as string[],
    rentalType: 'monthly' as RentalType,
    startDate: '',
    endDate: '',
    paymentDueDay: 5,
    monthlyAmount: 0,
    notes: '',
  })

  useEffect(() => {
    if (editingContract) {
      setFormData({
        guestId: editingContract.guestId,
        propertyIds: editingContract.propertyIds,
        rentalType: editingContract.rentalType,
        startDate: editingContract.startDate,
        endDate: editingContract.endDate,
        paymentDueDay: editingContract.paymentDueDay,
        monthlyAmount: editingContract.monthlyAmount,
        notes: editingContract.notes || '',
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
      paymentDueDay: 5,
      monthlyAmount: preSelectedPropertyId 
        ? properties?.find(p => p.id === preSelectedPropertyId)?.pricePerMonth || 0
        : 0,
      notes: '',
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
                createdAt: c.createdAt 
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
              <Input
                id="contract-start-date"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="contract-end-date">{t.contracts_view.form.end_date}</Label>
              <Input
                id="contract-end-date"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                required
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
              <Label htmlFor="contract-notes">{t.contracts_view.form.notes} {t.contracts_view.form.optional}</Label>
              <Textarea
                id="contract-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t.contracts_view.form.notes_placeholder}
                rows={3}
              />
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
