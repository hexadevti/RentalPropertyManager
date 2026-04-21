import { useEffect, useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import helpContent from '@/docs/form-appointment.md?raw'
import { HelpButton } from '@/components/HelpButton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Appointment, ServiceProvider, Contract, Guest, Property } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import { getContractSelectionLabel } from '@/lib/contractLabels'

interface AppointmentDialogFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (appointment: Omit<Appointment, 'id' | 'createdAt'>) => void
  appointment?: Appointment
}

export default function AppointmentDialogForm({ open, onOpenChange, onSubmit, appointment }: AppointmentDialogFormProps) {
  const { t } = useLanguage()
  const [serviceProviders] = useKV<ServiceProvider[]>('service-providers', [])
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [properties] = useKV<Property[]>('properties', [])

  const [formData, setFormData] = useState<Omit<Appointment, 'id' | 'createdAt'>>({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    status: 'scheduled',
    serviceProviderId: undefined,
    contractId: undefined,
    guestId: undefined,
    propertyId: undefined,
    notes: '',
  })

  useEffect(() => {
    if (appointment) {
      setFormData({
        title: appointment.title,
        description: appointment.description,
        date: appointment.date,
        time: appointment.time,
        status: appointment.status,
        serviceProviderId: appointment.serviceProviderId,
        contractId: appointment.contractId,
        guestId: appointment.guestId,
        propertyId: appointment.propertyId,
        notes: appointment.notes,
      })
    } else {
      setFormData({
        title: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        status: 'scheduled',
        serviceProviderId: undefined,
        contractId: undefined,
        guestId: undefined,
        propertyId: undefined,
        notes: '',
      })
    }
  }, [appointment, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1">
            {appointment ? t.appointments_view.form.title_edit : t.appointments_view.form.title_new}
            <HelpButton content={helpContent} title="Ajuda — Formulário de Compromisso" />
          </DialogTitle>
          <DialogDescription>
            {appointment ? 'Edite as informações do compromisso' : 'Preencha os dados do novo compromisso'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t.appointments_view.form.appointment_title}</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={t.appointments_view.form.title_placeholder}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              {t.appointments_view.form.description} {t.appointments_view.form.optional}
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t.appointments_view.form.description_placeholder}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">{t.appointments_view.form.date}</Label>
              <DateInput
                id="date"
                value={formData.date}
                onChange={(value) => setFormData({ ...formData, date: value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">{t.appointments_view.form.time}</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                placeholder={t.appointments_view.form.time_placeholder}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">{t.appointments_view.form.status}</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as Appointment['status'] })}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder={t.appointments_view.form.select_status} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">{t.appointments_view.status.scheduled}</SelectItem>
                <SelectItem value="completed">{t.appointments_view.status.completed}</SelectItem>
                <SelectItem value="cancelled">{t.appointments_view.status.cancelled}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">{t.appointments_view.form.link_section}</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serviceProviderId">
                  {t.appointments_view.form.provider} {t.appointments_view.form.optional}
                </Label>
                <Select
                  value={formData.serviceProviderId ?? 'none'}
                  onValueChange={(value) => setFormData({ 
                    ...formData, 
                    serviceProviderId: value === 'none' ? undefined : value,
                    contractId: value !== 'none' ? undefined : formData.contractId,
                    guestId: value !== 'none' ? undefined : formData.guestId,
                  })}
                >
                  <SelectTrigger id="serviceProviderId">
                    <SelectValue placeholder={t.appointments_view.form.select_provider} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {(serviceProviders || []).map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name} - {provider.service}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contractId">
                  {t.appointments_view.form.contract} {t.appointments_view.form.optional}
                </Label>
                <Select
                  value={formData.contractId ?? 'none'}
                  onValueChange={(value) => setFormData({ 
                    ...formData, 
                    contractId: value === 'none' ? undefined : value,
                    serviceProviderId: value !== 'none' ? undefined : formData.serviceProviderId,
                    guestId: value !== 'none' ? undefined : formData.guestId,
                  })}
                >
                  <SelectTrigger id="contractId">
                    <SelectValue placeholder={t.appointments_view.form.select_contract} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {(contracts || []).map((contract) => (
                      <SelectItem key={contract.id} value={contract.id}>
                        {getContractSelectionLabel(contract, properties || [])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="guestId">
                  {t.appointments_view.form.guest} {t.appointments_view.form.optional}
                </Label>
                <Select
                  value={formData.guestId ?? 'none'}
                  onValueChange={(value) => setFormData({ 
                    ...formData, 
                    guestId: value === 'none' ? undefined : value,
                    serviceProviderId: value !== 'none' ? undefined : formData.serviceProviderId,
                    contractId: value !== 'none' ? undefined : formData.contractId,
                  })}
                >
                  <SelectTrigger id="guestId">
                    <SelectValue placeholder={t.appointments_view.form.select_guest} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {(guests || []).map((guest) => (
                      <SelectItem key={guest.id} value={guest.id}>
                        {guest.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="propertyId">
                  {t.appointments_view.form.property} {t.appointments_view.form.optional}
                </Label>
                <Select
                  value={formData.propertyId ?? 'none'}
                  onValueChange={(value) => setFormData({ ...formData, propertyId: value === 'none' ? undefined : value })}
                >
                  <SelectTrigger id="propertyId">
                    <SelectValue placeholder={t.appointments_view.form.select_property} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {(properties || []).map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">
              {t.appointments_view.form.notes} {t.appointments_view.form.optional}
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder={t.appointments_view.form.notes_placeholder}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.appointments_view.form.cancel}
            </Button>
            <Button type="submit">
              {t.appointments_view.form.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
