import { useKV } from '@github/spark/hooks'
import { Transaction, Booking, Property, Task, ServiceProvider, Guest, Contract, Appointment } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { TrendUp, TrendDown, House, Calendar, CheckSquare, ArrowsClockwise, User, Files, Wrench, CalendarCheck, CalendarBlank } from '@phosphor-icons/react'
import { startOfMonth, endOfMonth, isWithinInterval, differenceInDays, isBefore, isAfter, parseISO, subMonths, format, startOfDay, subDays, startOfYear, endOfYear, subYears, eachMonthOfInterval, eachDayOfInterval } from 'date-fns'
import { useCurrency } from '@/lib/CurrencyContext'
import { useLanguage } from '@/lib/LanguageContext'
import { toast } from 'sonner'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useState } from 'react'

type DateRangePreset = '7d' | '30d' | '3m' | '6m' | '1y' | 'ytd' | 'custom'

export default function ReportsView() {
  const { formatCurrency } = useCurrency()
  const { t } = useLanguage()
  const [transactions] = useKV<Transaction[]>('transactions', [])
  const [bookings] = useKV<Booking[]>('bookings', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [tasks] = useKV<Task[]>('tasks', [])
  const [serviceProviders] = useKV<ServiceProvider[]>('service-providers', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [appointments] = useKV<Appointment[]>('appointments', [])
  
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('6m')
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined)
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined)

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const getDateRange = (): { start: Date; end: Date } => {
    const end = now
    let start: Date

    switch (dateRangePreset) {
      case '7d':
        start = subDays(now, 7)
        break
      case '30d':
        start = subDays(now, 30)
        break
      case '3m':
        start = subMonths(now, 3)
        break
      case '6m':
        start = subMonths(now, 6)
        break
      case '1y':
        start = subYears(now, 1)
        break
      case 'ytd':
        start = startOfYear(now)
        break
      case 'custom':
        if (customStartDate && customEndDate) {
          return { start: customStartDate, end: customEndDate }
        }
        start = subMonths(now, 6)
        break
      default:
        start = subMonths(now, 6)
    }

    return { start, end }
  }

  const dateRange = getDateRange()
  const filteredTransactions = (transactions || []).filter(t =>
    isWithinInterval(new Date(t.date), { start: dateRange.start, end: dateRange.end })
  )

  const currentMonthTransactions = (transactions || []).filter(t =>
    isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd })
  )

  const monthlyIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0)

  const monthlyExpenses = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0)

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0)

  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0)

  const balance = totalIncome - totalExpenses

  const currentBookings = (bookings || []).filter(b =>
    isWithinInterval(now, {
      start: new Date(b.checkIn),
      end: new Date(b.checkOut)
    })
  )

  const upcomingBookings = (bookings || []).filter(b => new Date(b.checkIn) > now)

  const activeContracts = (contracts || []).filter(c => c.status === 'active')

  const occupiedPropertiesFromContracts = new Set(
    activeContracts.flatMap(contract => contract.propertyIds)
  )

  const occupancyRate = properties && properties.length > 0
    ? (occupiedPropertiesFromContracts.size / properties.length) * 100
    : 0

  const completedTasks = (tasks || []).filter(t => t.status === 'completed').length
  const pendingTasks = (tasks || []).filter(t => t.status !== 'completed').length

  const propertyStats = (properties || []).map(property => {
    const propertyBookings = (bookings || []).filter(b => b.propertyId === property.id)
    const propertyRevenue = propertyBookings.reduce((acc, b) => acc + b.totalAmount, 0)
    
    const totalBookedDays = propertyBookings.reduce((acc, booking) => {
      const days = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn))
      return acc + days
    }, 0)

    return {
      property,
      bookings: propertyBookings.length,
      revenue: propertyRevenue,
      bookedDays: totalBookedDays
    }
  }).sort((a, b) => b.revenue - a.revenue)

  const expensesByCategory = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {} as Record<string, number>)

  const topExpenseCategories = Object.entries(expensesByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
  const expiredContracts = (contracts || []).filter(c => c.status === 'expired')
  
  const expiringContracts = activeContracts.filter(c => {
    const endDate = parseISO(c.endDate)
    const daysUntilExpiry = differenceInDays(endDate, now)
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0
  })

  const scheduledAppointments = (appointments || []).filter(a => a.status === 'scheduled')
  const completedAppointments = (appointments || []).filter(a => a.status === 'completed')
  
  const upcomingAppointments = scheduledAppointments.filter(a => {
    const appointmentDate = parseISO(a.date)
    return isAfter(appointmentDate, now)
  }).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())

  const providerUtilization = (serviceProviders || []).map(provider => {
    const providerTransactions = filteredTransactions.filter(t => t.serviceProviderId === provider.id)
    const providerAppointments = (appointments || []).filter(a => a.serviceProviderId === provider.id)
    const totalSpent = providerTransactions.reduce((acc, t) => acc + t.amount, 0)
    
    return {
      provider,
      transactions: providerTransactions.length,
      appointments: providerAppointments.length,
      totalSpent
    }
  }).sort((a, b) => b.totalSpent - a.totalSpent)

  const guestActivity = (guests || []).map(guest => {
    const guestContracts = (contracts || []).filter(c => c.guestId === guest.id)
    const guestAppointments = (appointments || []).filter(a => a.guestId === guest.id)
    const activeGuestContracts = guestContracts.filter(c => c.status === 'active')
    const totalPaid = guestContracts.reduce((acc, c) => {
      const monthsDiff = Math.ceil(differenceInDays(parseISO(c.endDate), parseISO(c.startDate)) / 30)
      return acc + (c.monthlyAmount * monthsDiff)
    }, 0)
    
    return {
      guest,
      contracts: guestContracts.length,
      activeContracts: activeGuestContracts.length,
      appointments: guestAppointments.length,
      totalPaid
    }
  }).filter(g => g.contracts > 0).sort((a, b) => b.totalPaid - a.totalPaid)

  const generateMonthlyData = () => {
    const { start, end } = dateRange
    const diffInMonths = differenceInDays(end, start) / 30
    
    if (diffInMonths <= 2) {
      const days = eachDayOfInterval({ start, end })
      const grouped: Record<string, { date: Date; income: number; expenses: number }> = {}
      
      days.forEach(day => {
        const dayKey = format(day, 'dd/MM')
        grouped[dayKey] = { date: day, income: 0, expenses: 0 }
      })
      
      filteredTransactions.forEach(t => {
        const dayKey = format(new Date(t.date), 'dd/MM')
        if (grouped[dayKey]) {
          if (t.type === 'income') {
            grouped[dayKey].income += t.amount
          } else {
            grouped[dayKey].expenses += t.amount
          }
        }
      })
      
      return Object.entries(grouped)
        .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
        .map(([key, value]) => ({
          month: key,
          receitas: value.income,
          despesas: value.expenses,
          lucro: value.income - value.expenses
        }))
        .filter((_, index, arr) => {
          if (arr.length > 30) {
            return index % Math.ceil(arr.length / 30) === 0
          }
          return true
        })
    }
    
    const months = eachMonthOfInterval({ start, end })
    
    return months.map(monthDate => {
      const monthStart = startOfMonth(monthDate)
      const monthEnd = endOfMonth(monthDate)
      
      const monthTransactions = filteredTransactions.filter(t =>
        isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd })
      )
      
      const income = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((acc, t) => acc + t.amount, 0)
      
      const expenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + t.amount, 0)
      
      return {
        month: format(monthDate, t.language === 'pt' ? 'MMM/yy' : 'MMM yy'),
        receitas: income,
        despesas: expenses,
        lucro: income - expenses
      }
    })
  }

  const generateCategoryPieData = () => {
    return Object.entries(expensesByCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([category, amount]) => ({
        name: category.charAt(0).toUpperCase() + category.slice(1),
        value: amount
      }))
  }

  const generatePropertyBarData = () => {
    return propertyStats.slice(0, 8).map(stat => ({
      name: stat.property.name.length > 15 
        ? stat.property.name.substring(0, 15) + '...'
        : stat.property.name,
      receita: stat.revenue,
      reservas: stat.bookings
    }))
  }

  const generateTaskCompletionData = () => {
    const { start, end } = dateRange
    const months = eachMonthOfInterval({ start, end })
    
    return months.map(monthDate => {
      const monthStart = startOfMonth(monthDate)
      const monthEnd = endOfMonth(monthDate)
      
      const monthTasks = (tasks || []).filter(t =>
        isWithinInterval(new Date(t.createdAt), { start: monthStart, end: monthEnd })
      )
      
      const completed = monthTasks.filter(t => t.status === 'completed').length
      const pending = monthTasks.filter(t => t.status !== 'completed').length
      
      return {
        month: format(monthDate, t.language === 'pt' ? 'MMM/yy' : 'MMM yy'),
        concluídas: completed,
        pendentes: pending
      }
    })
  }

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444']

  const monthlyData = generateMonthlyData()
  const categoryPieData = generateCategoryPieData()
  const propertyBarData = generatePropertyBarData()
  const taskCompletionData = generateTaskCompletionData()

  const handleRefresh = () => {
    toast.success(t.language === 'pt' ? 'Dados atualizados' : 'Data refreshed')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {t.language === 'pt' ? 'Relatórios e Análises' : 'Reports & Analytics'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t.language === 'pt' ? 'Visão completa do desempenho do seu negócio' : 'Complete overview of your business performance'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRangePreset} onValueChange={(value) => setDateRangePreset(value as DateRangePreset)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t.language === 'pt' ? 'Últimos 7 dias' : 'Last 7 days'}</SelectItem>
              <SelectItem value="30d">{t.language === 'pt' ? 'Últimos 30 dias' : 'Last 30 days'}</SelectItem>
              <SelectItem value="3m">{t.language === 'pt' ? 'Últimos 3 meses' : 'Last 3 months'}</SelectItem>
              <SelectItem value="6m">{t.language === 'pt' ? 'Últimos 6 meses' : 'Last 6 months'}</SelectItem>
              <SelectItem value="1y">{t.language === 'pt' ? 'Último ano' : 'Last year'}</SelectItem>
              <SelectItem value="ytd">{t.language === 'pt' ? 'Ano até hoje' : 'Year to date'}</SelectItem>
              <SelectItem value="custom">{t.language === 'pt' ? 'Personalizado' : 'Custom'}</SelectItem>
            </SelectContent>
          </Select>
          
          {dateRangePreset === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarBlank weight="bold" size={16} />
                  {customStartDate && customEndDate
                    ? `${format(customStartDate, 'dd/MM/yy')} - ${format(customEndDate, 'dd/MM/yy')}`
                    : (t.language === 'pt' ? 'Selecionar período' : 'Select period')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      {t.language === 'pt' ? 'Data Inicial' : 'Start Date'}
                    </label>
                    <CalendarComponent
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      disabled={(date) => date > new Date()}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      {t.language === 'pt' ? 'Data Final' : 'End Date'}
                    </label>
                    <CalendarComponent
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      disabled={(date) => 
                        date > new Date() || (customStartDate ? date < customStartDate : false)
                      }
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {t.language === 'pt' ? 'Atualizar' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <House weight="duotone" size={16} />
              {t.language === 'pt' ? 'Propriedades' : 'Properties'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{(properties || []).length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(properties || []).filter(p => p.status === 'available').length} {t.language === 'pt' ? 'disponíveis' : 'available'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar weight="duotone" size={16} />
              {t.language === 'pt' ? 'Taxa de Ocupação' : 'Occupancy Rate'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{occupancyRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {occupiedPropertiesFromContracts.size} {t.language === 'pt' ? 'com contratos ativos' : 'with active contracts'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendUp weight="duotone" size={16} />
                {t.language === 'pt' ? 'Receita' : 'Revenue'}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {t.language === 'pt' ? 'Período' : 'Period'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">
              {formatCurrency(totalIncome)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(monthlyIncome)} {t.language === 'pt' ? 'este mês' : 'this month'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckSquare weight="duotone" size={16} />
              {t.language === 'pt' ? 'Conclusão de Tarefas' : 'Task Completion'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {tasks && tasks.length > 0 ? ((completedTasks / tasks.length) * 100).toFixed(0) : 0}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {completedTasks} {t.language === 'pt' ? 'de' : 'of'} {(tasks || []).length} {t.language === 'pt' ? 'concluídas' : 'completed'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User weight="duotone" size={16} />
              {t.language === 'pt' ? 'Hóspedes' : 'Guests'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{(guests || []).length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {guestActivity.filter(g => g.activeContracts > 0).length} {t.language === 'pt' ? 'com contratos ativos' : 'with active contracts'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Files weight="duotone" size={16} />
              {t.language === 'pt' ? 'Contratos' : 'Contracts'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeContracts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {expiringContracts.length} {t.language === 'pt' ? 'expirando em 30 dias' : 'expiring in 30 days'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wrench weight="duotone" size={16} />
              {t.language === 'pt' ? 'Prestadores' : 'Providers'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{(serviceProviders || []).length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(providerUtilization.reduce((acc, p) => acc + p.totalSpent, 0))} {t.language === 'pt' ? 'gastos' : 'spent'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarCheck weight="duotone" size={16} />
              {t.language === 'pt' ? 'Compromissos' : 'Appointments'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{scheduledAppointments.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {completedAppointments.length} {t.language === 'pt' ? 'concluídos' : 'completed'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {t.language === 'pt' 
                ? `Evolução Financeira - ${format(dateRange.start, 'dd/MM/yy')} até ${format(dateRange.end, 'dd/MM/yy')}`
                : `Financial Evolution - ${format(dateRange.start, 'MM/dd/yy')} to ${format(dateRange.end, 'MM/dd/yy')}`}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {monthlyData.every(m => m.receitas === 0 && m.despesas === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {t.language === 'pt' ? 'Adicione transações para visualizar o gráfico' : 'Add transactions to view the chart'}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="receitas" 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  name={t.language === 'pt' ? 'Receitas' : 'Income'}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="despesas" 
                  stroke="#ef4444" 
                  strokeWidth={2} 
                  name={t.language === 'pt' ? 'Despesas' : 'Expenses'}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="lucro" 
                  stroke="#6366f1" 
                  strokeWidth={2} 
                  name={t.language === 'pt' ? 'Lucro' : 'Profit'}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t.language === 'pt' ? 'Distribuição de Despesas' : 'Expense Distribution'}</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryPieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                {t.language === 'pt' ? 'Nenhuma despesa cadastrada' : 'No expense data available'}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.language === 'pt' ? 'Resumo Financeiro Mensal' : 'Monthly Financial Summary'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-success/5 rounded-lg border border-success/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <TrendUp weight="duotone" size={20} className="text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.language === 'pt' ? 'Receitas' : 'Income'}</p>
                  <p className="text-xl font-bold text-success">
                    {formatCurrency(monthlyIncome)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-destructive/5 rounded-lg border border-destructive/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <TrendDown weight="duotone" size={20} className="text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t.language === 'pt' ? 'Despesas' : 'Expenses'}</p>
                  <p className="text-xl font-bold text-destructive">
                    {formatCurrency(monthlyExpenses)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">{t.language === 'pt' ? 'Lucro Líquido' : 'Net Profit'}</p>
                <p className={`text-2xl font-bold ${(monthlyIncome - monthlyExpenses) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(monthlyIncome - monthlyExpenses)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.language === 'pt' ? 'Principais Categorias de Despesas' : 'Top Expense Categories'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topExpenseCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t.language === 'pt' ? 'Nenhuma despesa cadastrada' : 'No expense data available'}
              </p>
            ) : (
              topExpenseCategories.map(([category, amount]) => {
                const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{category}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {percentage.toFixed(1)}% {t.language === 'pt' ? 'do total de despesas' : 'of total expenses'}
                    </p>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.language === 'pt' ? 'Receita por Propriedade' : 'Revenue by Property'}</CardTitle>
        </CardHeader>
        <CardContent>
          {propertyBarData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {t.language === 'pt' ? 'Adicione propriedades e reservas para visualizar o gráfico' : 'Add properties and bookings to view the chart'}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={propertyBarData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={12} />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    name === 'receita' ? formatCurrency(value) : value,
                    name === 'receita' 
                      ? (t.language === 'pt' ? 'Receita' : 'Revenue')
                      : (t.language === 'pt' ? 'Reservas' : 'Bookings')
                  ]}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar 
                  dataKey="receita" 
                  fill="#10b981" 
                  name={t.language === 'pt' ? 'Receita' : 'Revenue'}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {t.language === 'pt' 
                ? `Conclusão de Tarefas - ${format(dateRange.start, 'dd/MM/yy')} até ${format(dateRange.end, 'dd/MM/yy')}`
                : `Task Completion - ${format(dateRange.start, 'MM/dd/yy')} to ${format(dateRange.end, 'MM/dd/yy')}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {taskCompletionData.every(m => m.concluídas === 0 && m.pendentes === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                {t.language === 'pt' ? 'Adicione tarefas para visualizar o gráfico' : 'Add tasks to view the chart'}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={taskCompletionData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="concluídas" 
                    fill="#10b981" 
                    name={t.language === 'pt' ? 'Concluídas' : 'Completed'}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="pendentes" 
                    fill="#f59e0b" 
                    name={t.language === 'pt' ? 'Pendentes' : 'Pending'}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.language === 'pt' ? 'Desempenho por Propriedade' : 'Property Performance'}</CardTitle>
        </CardHeader>
        <CardContent>
          {propertyStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t.language === 'pt' ? 'Adicione propriedades para ver os dados de desempenho' : 'Add properties to see performance data'}
            </p>
          ) : (
            <div className="space-y-4">
              {propertyStats.map(stat => (
                <div key={stat.property.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold">{stat.property.name}</h4>
                      <Badge variant="outline" className="capitalize">{stat.property.type}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{stat.bookings} {t.language === 'pt' ? 'reservas' : 'bookings'}</span>
                      <span>•</span>
                      <span>{stat.bookedDays} {t.language === 'pt' ? 'dias ocupados' : 'days booked'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-success">
                      {formatCurrency(stat.revenue)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.language === 'pt' ? 'Receita total' : 'Total revenue'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t.language === 'pt' ? 'Prestadores Mais Utilizados' : 'Most Used Providers'}</CardTitle>
          </CardHeader>
          <CardContent>
            {providerUtilization.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t.language === 'pt' ? 'Nenhum prestador cadastrado' : 'No providers registered'}
              </p>
            ) : (
              <div className="space-y-3">
                {providerUtilization.slice(0, 5).map(item => (
                  <div key={item.provider.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold">{item.provider.name}</p>
                      <p className="text-sm text-muted-foreground">{item.provider.service}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{item.transactions} {t.language === 'pt' ? 'transações' : 'transactions'}</span>
                        <span>•</span>
                        <span>{item.appointments} {t.language === 'pt' ? 'compromissos' : 'appointments'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{formatCurrency(item.totalSpent)}</p>
                      <p className="text-xs text-muted-foreground">{t.language === 'pt' ? 'total gasto' : 'total spent'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.language === 'pt' ? 'Contratos Expirando' : 'Expiring Contracts'}</CardTitle>
          </CardHeader>
          <CardContent>
            {expiringContracts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t.language === 'pt' ? 'Nenhum contrato expirando nos próximos 30 dias' : 'No contracts expiring in the next 30 days'}
              </p>
            ) : (
              <div className="space-y-3">
                {expiringContracts.slice(0, 5).map(contract => {
                  const guest = (guests || []).find(g => g.id === contract.guestId)
                  const daysUntilExpiry = differenceInDays(parseISO(contract.endDate), now)
                  return (
                    <div key={contract.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold">{guest?.name || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">
                          {contract.propertyIds.length} {t.language === 'pt' ? 'propriedade(s)' : 'propertie(s)'}
                        </p>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {t.language === 'pt' ? `Expira em ${daysUntilExpiry} dias` : `Expires in ${daysUntilExpiry} days`}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{formatCurrency(contract.monthlyAmount)}</p>
                        <p className="text-xs text-muted-foreground">{t.language === 'pt' ? 'mensal' : 'monthly'}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t.language === 'pt' ? 'Próximos Compromissos' : 'Upcoming Appointments'}</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t.language === 'pt' ? 'Nenhum compromisso agendado' : 'No upcoming appointments'}
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.slice(0, 5).map(appointment => {
                  const provider = (serviceProviders || []).find(p => p.id === appointment.serviceProviderId)
                  const guest = (guests || []).find(g => g.id === appointment.guestId)
                  const daysUntil = differenceInDays(parseISO(appointment.date), now)
                  return (
                    <div key={appointment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold">{appointment.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {provider?.name || guest?.name || (t.language === 'pt' ? 'Sem vínculo' : 'No link')}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {daysUntil === 0 
                              ? (t.language === 'pt' ? 'Hoje' : 'Today')
                              : daysUntil === 1 
                              ? (t.language === 'pt' ? 'Amanhã' : 'Tomorrow')
                              : `${daysUntil} ${t.language === 'pt' ? 'dias' : 'days'}`}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{appointment.time}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.language === 'pt' ? 'Hóspedes com Maior Atividade' : 'Most Active Guests'}</CardTitle>
          </CardHeader>
          <CardContent>
            {guestActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t.language === 'pt' ? 'Nenhum hóspede com contratos' : 'No guests with contracts'}
              </p>
            ) : (
              <div className="space-y-3">
                {guestActivity.slice(0, 5).map(item => (
                  <div key={item.guest.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold">{item.guest.name}</p>
                      <p className="text-sm text-muted-foreground">{item.guest.email}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{item.contracts} {t.language === 'pt' ? 'contratos' : 'contracts'}</span>
                        <span>•</span>
                        <span>{item.activeContracts} {t.language === 'pt' ? 'ativos' : 'active'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-success">{formatCurrency(item.totalPaid)}</p>
                      <p className="text-xs text-muted-foreground">{t.language === 'pt' ? 'total pago' : 'total paid'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.language === 'pt' ? 'Próximas Reservas' : 'Upcoming Bookings'}</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t.language === 'pt' ? 'Nenhuma reserva futura' : 'No upcoming bookings'}
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.slice(0, 5).map(booking => {
                const property = (properties || []).find(p => p.id === booking.propertyId)
                const daysUntil = differenceInDays(new Date(booking.checkIn), now)
                return (
                  <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-semibold">{booking.guestName}</p>
                      <p className="text-sm text-muted-foreground">{property?.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.language === 'pt' ? `Check-in em ${daysUntil} dias` : `Check-in in ${daysUntil} days`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{formatCurrency(booking.totalAmount)}</p>
                      {booking.platform && (
                        <Badge variant="outline" className="mt-1 text-xs">{booking.platform}</Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
