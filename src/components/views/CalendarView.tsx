import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Contract, Property, Guest, Appointment, ServiceProvider } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Calendar as CalendarIcon, ArrowsClockwise, CalendarCheck } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isWithinInterval, addMonths, subMonths, parseISO } from 'date-fns'
import { useCurrency } from '@/lib/CurrencyContext'
import { useLanguage } from '@/lib/LanguageContext'
import ContractDialogForm from '../ContractDialogForm'
import AppointmentDialogForm from '../AppointmentDialogForm'

export default function CalendarView() {
  const { t } = useLanguage()
  const { formatCurrency } = useCurrency()
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [appointments] = useKV<Appointment[]>('appointments', [])
  const [serviceProviders] = useKV<ServiceProvider[]>('service-providers', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())

  const previousMonth = subMonths(currentDate, 1)
  const nextMonth = addMonths(currentDate, 1)

  const months = [
    {
      date: previousMonth,
      days: eachDayOfInterval({ 
        start: startOfMonth(previousMonth), 
        end: endOfMonth(previousMonth) 
      })
    },
    {
      date: currentDate,
      days: eachDayOfInterval({ 
        start: startOfMonth(currentDate), 
        end: endOfMonth(currentDate) 
      })
    },
    {
      date: nextMonth,
      days: eachDayOfInterval({ 
        start: startOfMonth(nextMonth), 
        end: endOfMonth(nextMonth) 
      })
    }
  ]

  const getContractsForDay = (day: Date, propertyId: string) => {
    return (contracts || []).filter(contract => 
      contract.propertyIds.includes(propertyId) &&
      isWithinInterval(day, {
        start: new Date(contract.startDate),
        end: new Date(contract.endDate)
      })
    )
  }

  const getAppointmentsForDay = (day: Date, propertyId?: string) => {
    return (appointments || []).filter(appointment => {
      const appointmentDate = parseISO(appointment.date)
      const sameDay = isSameDay(appointmentDate, day)
      
      if (!propertyId) return sameDay
      return sameDay && appointment.propertyId === propertyId
    })
  }

  const getGuestName = (guestId: string) => {
    const guest = (guests || []).find(g => g.id === guestId)
    return guest ? guest.name : 'Desconhecido'
  }

  const handleRefresh = () => {
    toast.success('Dados atualizados')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success/10 text-success-foreground border-success/20'
      case 'expired':
        return 'bg-muted text-muted-foreground border-border'
      case 'cancelled':
        return 'bg-destructive/10 text-destructive border-destructive/20'
      default:
        return 'bg-primary/10 text-primary border-primary/20'
    }
  }

  const activeContracts = (contracts || []).filter(contract => 
    contract.status === 'active' &&
    new Date(contract.endDate) >= new Date()
  )

  const upcomingAppointments = (appointments || [])
    .filter(apt => {
      const appointmentDateTime = new Date(`${apt.date}T${apt.time}`)
      return appointmentDateTime >= new Date() && apt.status === 'scheduled'
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`)
      const dateB = new Date(`${b.date}T${b.time}`)
      return dateA.getTime() - dateB.getTime()
    })
    .slice(0, 5)

  const getAppointmentLinkedEntity = (appointment: Appointment) => {
    if (appointment.serviceProviderId) {
      const provider = serviceProviders?.find(p => p.id === appointment.serviceProviderId)
      return provider ? `Prestador: ${provider.name}` : ''
    }
    
    if (appointment.contractId) {
      const contract = contracts?.find(c => c.id === appointment.contractId)
      const guest = guests?.find(g => g.id === contract?.guestId)
      return contract && guest ? `Contrato: ${guest.name}` : ''
    }
    
    if (appointment.guestId) {
      const guest = guests?.find(g => g.id === appointment.guestId)
      return guest ? `Hóspede: ${guest.name}` : ''
    }

    return ''
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t.tabs.calendar}</h2>
          <p className="text-sm text-muted-foreground mt-1">Visualizar contratos e compromissos no calendário</p>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-xs text-muted-foreground">Contrato</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">Compromisso</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            Atualizar
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const newDate = new Date(currentDate)
              newDate.setMonth(newDate.getMonth() - 1)
              setCurrentDate(newDate)
            }}>
              Anterior
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <Button variant="outline" size="sm" onClick={() => {
              const newDate = new Date(currentDate)
              newDate.setMonth(newDate.getMonth() + 1)
              setCurrentDate(newDate)
            }}>
              Próximo
            </Button>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => setIsAppointmentDialogOpen(true)}>
            <CalendarCheck weight="bold" size={16} />
            Adicionar Compromisso
          </Button>
          <Button className="gap-2" onClick={() => setIsDialogOpen(true)}>
            <Plus weight="bold" size={16} />
            Adicionar Contrato
          </Button>
        </div>
      </div>

      {!properties || properties.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarIcon weight="duotone" size={64} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma propriedade disponível</h3>
            <p className="text-sm text-muted-foreground">Adicione propriedades primeiro para gerenciar contratos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(properties || []).map((property) => (
            <Card key={property.id}>
              <CardHeader>
                <CardTitle className="text-lg">{property.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {months.map((month, monthIndex) => (
                    <div key={month.date.toISOString()}>
                      <h3 className={`text-sm font-semibold mb-3 text-center ${monthIndex === 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                        {format(month.date, 'MMMM yyyy')}
                      </h3>
                      <div className="grid grid-cols-7 gap-1">
                        {month.days.map((day) => {
                          const dayContracts = getContractsForDay(day, property.id)
                          const dayAppointments = getAppointmentsForDay(day, property.id)
                          const hasContract = dayContracts.length > 0
                          const hasAppointment = dayAppointments.length > 0
                          const isToday = isSameDay(day, new Date())
                          
                          return (
                            <div
                              key={day.toISOString()}
                              className={`
                                p-1.5 rounded border text-center transition-colors
                                ${isToday ? 'border-primary border-2' : 'border-border'}
                                ${hasContract ? 'bg-accent/20' : 'bg-card'}
                              `}
                            >
                              <div className="text-[10px] text-muted-foreground leading-tight">{format(day, 'EEE')}</div>
                              <div className="text-xs font-semibold">{format(day, 'd')}</div>
                              {(hasContract || hasAppointment) && (
                                <div className="mt-0.5 flex gap-0.5 justify-center">
                                  {hasContract && (
                                    <div className="w-1 h-1 rounded-full bg-accent" />
                                  )}
                                  {hasAppointment && (
                                    <div className="w-1 h-1 rounded-full bg-primary" />
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeContracts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Contratos Vigentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeContracts.map((contract) => {
              const guest = (guests || []).find(g => g.id === contract.guestId)
              const propertyNames = contract.propertyIds
                .map(id => (properties || []).find(p => p.id === id)?.name)
                .filter(Boolean)
                .join(', ')
              
              return (
                <div key={contract.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-semibold">{guest?.name || 'Desconhecido'}</p>
                    <p className="text-sm text-muted-foreground">
                      {propertyNames} • {format(new Date(contract.startDate), 'dd/MM/yyyy')} - {format(new Date(contract.endDate), 'dd/MM/yyyy')}
                    </p>
                    <Badge variant="outline" className="mt-1 text-xs">{contract.rentalType === 'monthly' ? 'Mensal' : 'Curto prazo'}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{formatCurrency(contract.monthlyAmount)}</p>
                    <Badge className={getStatusColor(contract.status)}>
                      {contract.status === 'active' ? 'Ativo' : contract.status === 'expired' ? 'Expirado' : 'Cancelado'}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {upcomingAppointments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck weight="duotone" size={24} />
              Próximos Compromissos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingAppointments.map((appointment) => {
              const property = properties?.find(p => p.id === appointment.propertyId)
              const linkedEntity = getAppointmentLinkedEntity(appointment)
              
              return (
                <div key={appointment.id} className="flex items-start justify-between p-4 border rounded-lg hover:shadow-sm transition-shadow">
                  <div className="space-y-1">
                    <p className="font-semibold">{appointment.title}</p>
                    {appointment.description && (
                      <p className="text-sm text-muted-foreground">{appointment.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{format(parseISO(appointment.date), 'dd/MM/yyyy')} às {appointment.time}</span>
                      {property && <span>• {property.name}</span>}
                      {linkedEntity && <span>• {linkedEntity}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    Agendado
                  </Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <ContractDialogForm 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
      />

      <AppointmentDialogForm
        open={isAppointmentDialogOpen}
        onOpenChange={setIsAppointmentDialogOpen}
        onSubmit={() => {
          setIsAppointmentDialogOpen(false)
          toast.success('Compromisso criado com sucesso!')
        }}
      />
    </div>
  )
}
