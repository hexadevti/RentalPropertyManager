import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Contract, Property, Guest, Appointment, ServiceProvider, Task } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Calendar as CalendarIcon, ArrowsClockwise, CalendarCheck, CheckSquare, CurrencyCircleDollar, FileText, X, Wrench, User } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isWithinInterval, addMonths, subMonths, parseISO, startOfWeek, endOfWeek, isBefore, isAfter } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useCurrency } from '@/lib/CurrencyContext'
import { useLanguage } from '@/lib/LanguageContext'
import ContractDialogForm from '../ContractDialogForm'
import AppointmentDialogForm from '../AppointmentDialogForm'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface CalendarEvent {
  id: string
  date: Date
  title: string
  type: 'appointment' | 'task' | 'contract-end' | 'payment-due'
  color: string
  description?: string
  property?: string
}

export default function CalendarView() {
  const { t } = useLanguage()
  const { formatCurrency } = useCurrency()
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [appointments] = useKV<Appointment[]>('appointments', [])
  const [serviceProviders] = useKV<ServiceProvider[]>('service-providers', [])
  const [tasks] = useKV<Task[]>('tasks', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [appointmentDetailOpen, setAppointmentDetailOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskDetailOpen, setTaskDetailOpen] = useState(false)

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

  const getAllEventsForDay = (day: Date): CalendarEvent[] => {
    const events: CalendarEvent[] = []

    const appointmentsList = appointments || []
    appointmentsList.forEach(appointment => {
      const appointmentDate = parseISO(appointment.date)
      if (isSameDay(appointmentDate, day)) {
        const property = (properties || []).find(p => p.id === appointment.propertyId)
        const isCompleted = appointment.status === 'completed'
        events.push({
          id: `apt-${appointment.id}`,
          date: appointmentDate,
          title: appointment.title,
          type: 'appointment',
          color: isCompleted ? 'bg-success/40' : 'bg-primary',
          description: appointment.description,
          property: property?.name
        })
      }
    })

    const tasksList = tasks || []
    tasksList.forEach(task => {
      const taskDate = parseISO(task.dueDate)
      if (isSameDay(taskDate, day)) {
        const property = (properties || []).find(p => p.id === task.propertyId)
        const isCompleted = task.status === 'completed'
        let color = task.priority === 'high' ? 'bg-destructive' : task.priority === 'medium' ? 'bg-accent' : 'bg-muted-foreground'
        if (isCompleted) {
          color = 'bg-success/40'
        }
        events.push({
          id: `task-${task.id}`,
          date: taskDate,
          title: task.title,
          type: 'task',
          color: color,
          description: task.description,
          property: property?.name
        })
      }
    })

    const contractsList = contracts || []
    contractsList.forEach(contract => {
      if (contract.status === 'active') {
        const endDate = parseISO(contract.endDate)
        if (isSameDay(endDate, day)) {
          const guest = (guests || []).find(g => g.id === contract.guestId)
          const propertyNames = contract.propertyIds
            .map(id => (properties || []).find(p => p.id === id)?.name)
            .filter(Boolean)
            .join(', ')
          events.push({
            id: `contract-end-${contract.id}`,
            date: endDate,
            title: `Fim de contrato: ${guest?.name || 'Desconhecido'}`,
            type: 'contract-end',
            color: 'bg-accent',
            property: propertyNames
          })
        }

        if (contract.rentalType === 'monthly') {
          const currentMonth = day.getMonth()
          const currentYear = day.getFullYear()
          const paymentDate = new Date(currentYear, currentMonth, contract.paymentDueDay)
          
          if (isSameDay(paymentDate, day) && !isBefore(day, parseISO(contract.startDate)) && !isAfter(day, endDate)) {
            const guest = (guests || []).find(g => g.id === contract.guestId)
            const propertyNames = contract.propertyIds
              .map(id => (properties || []).find(p => p.id === id)?.name)
              .filter(Boolean)
              .join(', ')
            events.push({
              id: `payment-${contract.id}-${format(day, 'yyyy-MM')}`,
              date: paymentDate,
              title: `Vencimento: ${guest?.name || 'Desconhecido'} - ${formatCurrency(contract.monthlyAmount)}`,
              type: 'payment-due',
              color: 'bg-success',
              property: propertyNames
            })
          }
        }
      }
    })

    return events.sort((a, b) => a.date.getTime() - b.date.getTime())
  }

  const getMonthCalendarDays = (monthDate: Date) => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }

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

  const getEventIcon = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'appointment':
        return <CalendarCheck weight="duotone" size={16} />
      case 'task':
        return <CheckSquare weight="duotone" size={16} />
      case 'payment-due':
        return <CurrencyCircleDollar weight="duotone" size={16} />
      case 'contract-end':
        return <FileText weight="duotone" size={16} />
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

  const generalCalendarDays = getMonthCalendarDays(currentDate)
  const selectedDayEvents = selectedDate ? getAllEventsForDay(selectedDate) : []

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
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success/40" />
              <span className="text-xs text-muted-foreground">Compromisso/Tarefa concluída</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-xs text-muted-foreground">Tarefa urgente</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-xs text-muted-foreground">Pagamento</span>
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
            <span className="text-sm font-medium min-w-[120px] text-center capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
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

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon weight="duotone" size={24} />
            Calendário Geral de Eventos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {generalCalendarDays.map((day) => {
              const dayEvents = getAllEventsForDay(day)
              const isToday = isSameDay(day, new Date())
              const isCurrentMonth = day.getMonth() === currentDate.getMonth()
              const isSelected = selectedDate && isSameDay(day, selectedDate)
              
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    min-h-[100px] p-2 rounded-lg border text-left transition-all hover:shadow-md
                    ${isToday ? 'border-primary border-2 bg-primary/5' : 'border-border'}
                    ${isSelected ? 'ring-2 ring-primary shadow-lg' : ''}
                    ${!isCurrentMonth ? 'opacity-40' : ''}
                    ${dayEvents.length > 0 ? 'bg-card' : 'bg-background'}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 && (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {dayEvents.length}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event) => {
                      if (event.type === 'appointment') {
                        const appointment = (appointments || []).find(a => `apt-${a.id}` === event.id)
                        if (!appointment) return null
                        
                        const statusLabel = appointment.status === 'completed' ? 'Concluído' : 
                                          appointment.status === 'cancelled' ? 'Cancelado' : 'Agendado'
                        
                        return (
                          <TooltipProvider key={event.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedAppointment(appointment)
                                    setAppointmentDetailOpen(true)
                                  }}
                                  className={`w-full text-[10px] px-1.5 py-0.5 rounded ${event.color} text-white truncate text-left hover:opacity-80 transition-opacity`}
                                >
                                  {event.title}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <div className="space-y-1">
                                  <p className="font-semibold">{event.title}</p>
                                  <p className="text-xs text-muted-foreground">Status: {statusLabel}</p>
                                  {event.description && (
                                    <p className="text-xs">{event.description}</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )
                      }
                      
                      if (event.type === 'task') {
                        const task = (tasks || []).find(t => `task-${t.id}` === event.id)
                        if (!task) return null
                        
                        const statusLabel = task.status === 'completed' ? 'Concluída' : 
                                          task.status === 'in-progress' ? 'Em Progresso' : 'Pendente'
                        
                        return (
                          <TooltipProvider key={event.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedTask(task)
                                    setTaskDetailOpen(true)
                                  }}
                                  className={`w-full text-[10px] px-1.5 py-0.5 rounded ${event.color} text-white truncate text-left hover:opacity-80 transition-opacity`}
                                >
                                  {event.title}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <div className="space-y-1">
                                  <p className="font-semibold">{event.title}</p>
                                  <p className="text-xs text-muted-foreground">Status: {statusLabel}</p>
                                  {event.description && (
                                    <p className="text-xs">{event.description}</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )
                      }
                      
                      return (
                        <div
                          key={event.id}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${event.color} text-white truncate`}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1.5">
                        +{dayEvents.length - 3} mais
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDate && selectedDayEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Eventos de {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                Fechar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedDayEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-3 p-4 border rounded-lg hover:shadow-sm transition-shadow">
                <div className={`p-2 rounded ${event.color} text-white`}>
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{event.title}</p>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                  )}
                  {event.property && (
                    <p className="text-xs text-muted-foreground mt-1">📍 {event.property}</p>
                  )}
                </div>
                <Badge variant="outline">
                  {event.type === 'appointment' ? 'Compromisso' : 
                   event.type === 'task' ? 'Tarefa' :
                   event.type === 'payment-due' ? 'Pagamento' : 'Fim de Contrato'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
          <h3 className="text-xl font-semibold">Calendários por Propriedade</h3>
          {(properties || []).map((property) => (
            <Card key={property.id}>
              <CardHeader>
                <CardTitle className="text-lg">{property.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {months.map((month, monthIndex) => (
                    <div key={month.date.toISOString()}>
                      <h3 className={`text-sm font-semibold mb-3 text-center capitalize ${monthIndex === 1 ? 'text-primary' : 'text-muted-foreground'}`}>
                        {format(month.date, 'MMMM yyyy', { locale: ptBR })}
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
                              <div className="text-[10px] text-muted-foreground leading-tight">{format(day, 'EEE', { locale: ptBR })}</div>
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

      <Dialog open={appointmentDetailOpen} onOpenChange={setAppointmentDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck weight="duotone" size={24} />
              Detalhes do Compromisso
            </DialogTitle>
          </DialogHeader>
          
          {selectedAppointment && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">{selectedAppointment.title}</h3>
                {selectedAppointment.description && (
                  <p className="text-muted-foreground mt-1">{selectedAppointment.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Data</p>
                  <div className="flex items-center gap-2">
                    <CalendarIcon weight="duotone" size={16} />
                    <p>{format(parseISO(selectedAppointment.date), "dd/MM/yyyy")}</p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Horário</p>
                  <p className="text-lg font-semibold">{selectedAppointment.time}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge className={
                  selectedAppointment.status === 'completed' ? 'bg-success/20 text-success-foreground border-success/30' :
                  selectedAppointment.status === 'cancelled' ? 'bg-destructive/20 text-destructive border-destructive/30' :
                  'bg-primary/20 text-primary border-primary/30'
                }>
                  {selectedAppointment.status === 'completed' ? 'Concluído' :
                   selectedAppointment.status === 'cancelled' ? 'Cancelado' : 'Agendado'}
                </Badge>
              </div>

              {selectedAppointment.propertyId && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Propriedade</p>
                  <p>{properties?.find(p => p.id === selectedAppointment.propertyId)?.name || 'N/A'}</p>
                </div>
              )}

              {selectedAppointment.serviceProviderId && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Prestador de Serviço</p>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded bg-accent/20">
                      <Wrench weight="duotone" size={16} />
                    </div>
                    <p>{serviceProviders?.find(p => p.id === selectedAppointment.serviceProviderId)?.name || 'N/A'}</p>
                  </div>
                </div>
              )}

              {selectedAppointment.contractId && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Contrato</p>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded bg-primary/20">
                      <FileText weight="duotone" size={16} />
                    </div>
                    <p>
                      {(() => {
                        const contract = contracts?.find(c => c.id === selectedAppointment.contractId)
                        const guest = guests?.find(g => g.id === contract?.guestId)
                        return guest?.name || 'N/A'
                      })()}
                    </p>
                  </div>
                </div>
              )}

              {selectedAppointment.guestId && !selectedAppointment.contractId && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Hóspede</p>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded bg-secondary/20">
                      <User weight="duotone" size={16} />
                    </div>
                    <p>{guests?.find(g => g.id === selectedAppointment.guestId)?.name || 'N/A'}</p>
                  </div>
                </div>
              )}

              {selectedAppointment.notes && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Observações</p>
                  <p className="text-sm bg-muted p-3 rounded">{selectedAppointment.notes}</p>
                </div>
              )}

              {selectedAppointment.status === 'completed' && selectedAppointment.completionNotes && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Observações de Conclusão</p>
                  <p className="text-sm bg-success/10 p-3 rounded border border-success/20">{selectedAppointment.completionNotes}</p>
                </div>
              )}

              {selectedAppointment.completedAt && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Concluído em</p>
                  <p className="text-sm">{format(parseISO(selectedAppointment.completedAt), "dd/MM/yyyy 'às' HH:mm")}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setAppointmentDetailOpen(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={taskDetailOpen} onOpenChange={setTaskDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare weight="duotone" size={24} />
              Detalhes da Tarefa
            </DialogTitle>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">{selectedTask.title}</h3>
                {selectedTask.description && (
                  <p className="text-muted-foreground mt-1">{selectedTask.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Data de Vencimento</p>
                  <div className="flex items-center gap-2">
                    <CalendarIcon weight="duotone" size={16} />
                    <p>{format(parseISO(selectedTask.dueDate), "dd/MM/yyyy")}</p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Prioridade</p>
                  <Badge variant="outline" className={
                    selectedTask.priority === 'high' ? 'bg-destructive/10 text-destructive-foreground border-destructive/20' :
                    selectedTask.priority === 'medium' ? 'bg-accent/10 text-accent-foreground border-accent/20' :
                    'bg-muted text-muted-foreground border-border'
                  }>
                    {selectedTask.priority === 'high' ? 'Alta' :
                     selectedTask.priority === 'medium' ? 'Média' : 'Baixa'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge className={
                  selectedTask.status === 'completed' ? 'bg-success/20 text-success-foreground border-success/30' :
                  selectedTask.status === 'in-progress' ? 'bg-primary/20 text-primary border-primary/30' :
                  'bg-muted text-muted-foreground border-border'
                }>
                  {selectedTask.status === 'completed' ? 'Concluída' :
                   selectedTask.status === 'in-progress' ? 'Em Progresso' : 'Pendente'}
                </Badge>
              </div>

              {selectedTask.propertyId && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Propriedade</p>
                  <p>{properties?.find(p => p.id === selectedTask.propertyId)?.name || 'N/A'}</p>
                </div>
              )}

              {selectedTask.assignee && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Responsável</p>
                  <p>{selectedTask.assignee}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setTaskDetailOpen(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
