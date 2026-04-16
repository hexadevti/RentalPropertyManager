import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { MagnifyingGlass, Plus, CalendarBlank, Clock, Trash, Pencil, User, Wrench, Files } from '@phosphor-icons/react'
import { Appointment, ServiceProvider, Contract, Guest, Property } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import { toast } from 'sonner'
import { format } from 'date-fns'
import AppointmentDialogForm from '@/components/AppointmentDialogForm'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

export default function AppointmentsView() {
  const { t } = useLanguage()
  const [appointments, setAppointments] = useKV<Appointment[]>('appointments', [])
  const [serviceProviders] = useKV<ServiceProvider[]>('service-providers', [])
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'completed' | 'cancelled'>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null)

  const filteredAppointments = (appointments || [])
    .filter(apt => {
      const matchesSearch = apt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.description?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || apt.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime())

  const handleCreateAppointment = (appointment: Omit<Appointment, 'id' | 'createdAt'>) => {
    const newAppointment: Appointment = {
      ...appointment,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    }
    setAppointments((current) => [...(current || []), newAppointment])
    setIsDialogOpen(false)
    toast.success(t.appointments_view.form.created_success)
  }

  const handleUpdateAppointment = (appointment: Omit<Appointment, 'id' | 'createdAt'>) => {
    if (!editingAppointment) return
    
    setAppointments((current) =>
      (current || []).map(apt =>
        apt.id === editingAppointment.id
          ? { ...appointment, id: apt.id, createdAt: apt.createdAt }
          : apt
      )
    )
    setIsDialogOpen(false)
    setEditingAppointment(null)
    toast.success(t.appointments_view.form.updated_success)
  }

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment)
    setIsDialogOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    setAppointmentToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (appointmentToDelete) {
      setAppointments((current) => (current || []).filter(apt => apt.id !== appointmentToDelete))
      toast.success(t.appointments_view.deleted_success)
      setDeleteDialogOpen(false)
      setAppointmentToDelete(null)
    }
  }

  const getStatusBadge = (status: Appointment['status']) => {
    const variants = {
      scheduled: 'default',
      completed: 'secondary',
      cancelled: 'destructive',
    } as const

    return (
      <Badge variant={variants[status]}>
        {t.appointments_view.status[status]}
      </Badge>
    )
  }

  const getLinkedEntity = (appointment: Appointment) => {
    if (appointment.serviceProviderId) {
      const provider = serviceProviders?.find(p => p.id === appointment.serviceProviderId)
      return provider ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wrench size={16} weight="duotone" />
          <span>{t.appointments_view.provider}: {provider.name}</span>
        </div>
      ) : null
    }
    
    if (appointment.contractId) {
      const contract = contracts?.find(c => c.id === appointment.contractId)
      const guest = guests?.find(g => g.id === contract?.guestId)
      return contract && guest ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Files size={16} weight="duotone" />
          <span>{t.appointments_view.contract}: {guest.name}</span>
        </div>
      ) : null
    }
    
    if (appointment.guestId) {
      const guest = guests?.find(g => g.id === appointment.guestId)
      return guest ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User size={16} weight="duotone" />
          <span>{t.appointments_view.guest}: {guest.name}</span>
        </div>
      ) : null
    }

    return (
      <div className="text-sm text-muted-foreground">
        {t.appointments_view.no_link}
      </div>
    )
  }

  const getProperty = (appointment: Appointment) => {
    if (!appointment.propertyId) return null
    const property = properties?.find(p => p.id === appointment.propertyId)
    return property ? (
      <div className="text-sm text-muted-foreground">
        {t.appointments_view.property}: {property.name}
      </div>
    ) : null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t.appointments_view.title}</h2>
        </div>
        <Button onClick={() => {
          setEditingAppointment(null)
          setIsDialogOpen(true)
        }}>
          <Plus weight="bold" />
          {t.appointments_view.add_appointment}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <Input
            placeholder={t.appointments_view.search_placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('all')}
          >
            {t.appointments_view.filter_all}
          </Button>
          <Button
            variant={statusFilter === 'scheduled' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('scheduled')}
          >
            {t.appointments_view.filter_scheduled}
          </Button>
          <Button
            variant={statusFilter === 'completed' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('completed')}
          >
            {t.appointments_view.filter_completed}
          </Button>
          <Button
            variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('cancelled')}
          >
            {t.appointments_view.filter_cancelled}
          </Button>
        </div>
      </div>

      {filteredAppointments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarBlank size={64} weight="duotone" className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t.appointments_view.no_appointments}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t.appointments_view.add_first}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAppointments.map((appointment) => (
            <Card key={appointment.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl">{appointment.title}</CardTitle>
                      {getStatusBadge(appointment.status)}
                    </div>
                    {appointment.description && (
                      <CardDescription>{appointment.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(appointment)}
                    >
                      <Pencil weight="duotone" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(appointment.id)}
                    >
                      <Trash weight="duotone" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarBlank size={16} weight="duotone" className="text-muted-foreground" />
                      <span>{format(new Date(appointment.date), 'dd/MM/yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock size={16} weight="duotone" className="text-muted-foreground" />
                      <span>{appointment.time}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {getLinkedEntity(appointment)}
                    {getProperty(appointment)}
                  </div>
                  
                  {appointment.notes && (
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AppointmentDialogForm
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) setEditingAppointment(null)
        }}
        onSubmit={editingAppointment ? handleUpdateAppointment : handleCreateAppointment}
        appointment={editingAppointment || undefined}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.appointments_view.delete}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este compromisso? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
