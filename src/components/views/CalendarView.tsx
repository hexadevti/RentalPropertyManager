import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Contract, Property, Guest } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Calendar as CalendarIcon, ArrowsClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isWithinInterval } from 'date-fns'
import { useCurrency } from '@/lib/CurrencyContext'
import { useLanguage } from '@/lib/LanguageContext'
import ContractDialogForm from '../ContractDialogForm'

export default function CalendarView() {
  const { t } = useLanguage()
  const { formatCurrency } = useCurrency()
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const getContractsForDay = (day: Date, propertyId: string) => {
    return (contracts || []).filter(contract => 
      contract.propertyIds.includes(propertyId) &&
      isWithinInterval(day, {
        start: new Date(contract.startDate),
        end: new Date(contract.endDate)
      })
    )
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t.tabs.calendar}</h2>
          <p className="text-sm text-muted-foreground mt-1">Visualizar contratos no calendário</p>
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
        <div className="space-y-4">
          {(properties || []).map((property) => (
            <Card key={property.id}>
              <CardHeader>
                <CardTitle className="text-lg">{property.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {days.map((day) => {
                    const dayContracts = getContractsForDay(day, property.id)
                    const hasContract = dayContracts.length > 0
                    const isToday = isSameDay(day, new Date())
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={`
                          p-3 rounded-lg border text-center transition-colors
                          ${isToday ? 'border-primary border-2' : 'border-border'}
                          ${hasContract ? 'bg-accent/20' : 'bg-card'}
                        `}
                      >
                        <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                        <div className="text-sm font-semibold mt-1">{format(day, 'd')}</div>
                        {hasContract && (
                          <div className="mt-2">
                            <Badge className="text-xs px-1 py-0">Ocupado</Badge>
                          </div>
                        )}
                      </div>
                    )
                  })}
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

      <ContractDialogForm 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
      />
    </div>
  )
}
