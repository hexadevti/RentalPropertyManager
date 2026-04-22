import { useKV } from '@/lib/useSupabaseKV'
import { Transaction, Property, Task, ServiceProvider, Guest, Contract, Appointment, Owner } from '@/types'
import helpContent from '@/docs/reports.md?raw'
import { HelpButton } from '@/components/HelpButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { TrendUp, TrendDown, House, Calendar, ArrowsClockwise, User, Files, Wrench, CalendarCheck, CalendarBlank, Users } from '@phosphor-icons/react'
import { startOfMonth, endOfMonth, isWithinInterval, differenceInDays, isAfter, parseISO, subMonths, format, subDays, startOfYear, subYears, eachMonthOfInterval, eachDayOfInterval } from 'date-fns'
import { useCurrency } from '@/lib/CurrencyContext'
import { useLanguage } from '@/lib/LanguageContext'
import { toast } from 'sonner'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useState } from 'react'
import type { DateRange } from 'react-day-picker'

type DateRangePreset = '7d' | '30d' | '3m' | '6m' | '1y' | 'ytd' | 'custom'

export default function ReportsView() {
  const { formatCurrency } = useCurrency()
  const { t, language } = useLanguage()
  const rv = t.reports_view
  const [transactions] = useKV<Transaction[]>('transactions', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [tasks] = useKV<Task[]>('tasks', [])
  const [serviceProviders] = useKV<ServiceProvider[]>('service-providers', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [appointments] = useKV<Appointment[]>('appointments', [])
  const [owners] = useKV<Owner[]>('owners', [])

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
      case '7d':  start = subDays(now, 7); break
      case '30d': start = subDays(now, 30); break
      case '3m':  start = subMonths(now, 3); break
      case '6m':  start = subMonths(now, 6); break
      case '1y':  start = subYears(now, 1); break
      case 'ytd': start = startOfYear(now); break
      case 'custom':
        if (customStartDate && customEndDate) return { start: customStartDate, end: customEndDate }
        start = subMonths(now, 6)
        break
      default:
        start = subMonths(now, 6)
    }

    return { start, end }
  }

  const dateRange = getDateRange()
  const filteredTransactions = (transactions || []).filter(tx =>
    isWithinInterval(new Date(tx.date), { start: dateRange.start, end: dateRange.end })
  )

  const currentMonthTransactions = (transactions || []).filter(tx =>
    isWithinInterval(new Date(tx.date), { start: monthStart, end: monthEnd })
  )

  const monthlyIncome = currentMonthTransactions.filter(tx => tx.type === 'income').reduce((acc, tx) => acc + tx.amount, 0)
  const monthlyExpenses = currentMonthTransactions.filter(tx => tx.type === 'expense').reduce((acc, tx) => acc + tx.amount, 0)
  const totalIncome = filteredTransactions.filter(tx => tx.type === 'income').reduce((acc, tx) => acc + tx.amount, 0)
  const totalExpenses = filteredTransactions.filter(tx => tx.type === 'expense').reduce((acc, tx) => acc + tx.amount, 0)

  const activeContracts = (contracts || []).filter(c => c.status === 'active')
  const occupiedPropertiesFromContracts = new Set(activeContracts.flatMap(c => c.propertyIds))
  const occupancyRate = properties && properties.length > 0
    ? (occupiedPropertiesFromContracts.size / properties.length) * 100
    : 0

  const propertyStats = (properties || []).map(property => {
    const propertyContracts = (contracts || []).filter(c => c.propertyIds.includes(property.id))
    const propertyOwners = (owners || []).filter(o => property.ownerIds?.includes(o.id))
    const propertyRevenue = filteredTransactions
      .filter(tx => {
        if (tx.type !== 'income' || !tx.contractId) return false
        const contract = (contracts || []).find(c => c.id === tx.contractId)
        return contract && contract.propertyIds.includes(property.id)
      })
      .reduce((acc, tx) => {
        const contract = (contracts || []).find(c => c.id === tx.contractId)
        if (!contract) return acc
        return acc + tx.amount / contract.propertyIds.length
      }, 0)
    const totalBookedDays = propertyContracts.reduce((acc, c) => {
      return acc + Math.max(0, differenceInDays(parseISO(c.endDate), parseISO(c.startDate)))
    }, 0)
    return { property, bookings: propertyContracts.length, revenue: propertyRevenue, bookedDays: totalBookedDays, owners: propertyOwners }
  }).sort((a, b) => b.revenue - a.revenue)

  const expensesByCategory = filteredTransactions
    .filter(tx => tx.type === 'expense')
    .reduce((acc, tx) => { acc[tx.category] = (acc[tx.category] || 0) + tx.amount; return acc }, {} as Record<string, number>)

  const topExpenseCategories = Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a).slice(0, 5)

  const expiringContracts = activeContracts.filter(c => {
    const days = differenceInDays(parseISO(c.endDate), now)
    return days <= 30 && days >= 0
  })

  const scheduledAppointments = (appointments || []).filter(a => a.status === 'scheduled')
  const completedAppointments = (appointments || []).filter(a => a.status === 'completed')
  const upcomingAppointments = scheduledAppointments.filter(a => isAfter(parseISO(a.date), now))
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())

  const providerUtilization = (serviceProviders || []).map(provider => {
    const providerTransactions = filteredTransactions.filter(tx => tx.serviceProviderId === provider.id)
    const providerAppointments = (appointments || []).filter(a => a.serviceProviderId === provider.id)
    return {
      provider,
      transactions: providerTransactions.length,
      appointments: providerAppointments.length,
      totalSpent: providerTransactions.reduce((acc, tx) => acc + tx.amount, 0)
    }
  }).sort((a, b) => b.totalSpent - a.totalSpent)

  const guestActivity = (guests || []).map(guest => {
    const guestContracts = (contracts || []).filter(c => c.guestId === guest.id)
    const guestAppointments = (appointments || []).filter(a => a.guestId === guest.id)
    const activeGuestContracts = guestContracts.filter(c => c.status === 'active')
    const totalPaid = guestContracts.reduce((acc, c) => {
      const months = Math.ceil(differenceInDays(parseISO(c.endDate), parseISO(c.startDate)) / 30)
      return acc + c.monthlyAmount * months
    }, 0)
    return { guest, contracts: guestContracts.length, activeContracts: activeGuestContracts.length, appointments: guestAppointments.length, totalPaid }
  }).filter(g => g.contracts > 0).sort((a, b) => b.totalPaid - a.totalPaid)

  const dateFmt = language === 'en' ? 'MMM yy' : 'MMM/yy'
  const dateRangeFmt = language === 'en' ? 'MM/dd/yy' : 'dd/MM/yy'

  const generateMonthlyData = () => {
    const { start, end } = dateRange
    const diffInMonths = differenceInDays(end, start) / 30

    if (diffInMonths <= 2) {
      const grouped: Record<string, { date: Date; income: number; expenses: number }> = {}
      eachDayOfInterval({ start, end }).forEach(day => {
        grouped[format(day, 'dd/MM')] = { date: day, income: 0, expenses: 0 }
      })
      filteredTransactions.forEach(tx => {
        const key = format(new Date(tx.date), 'dd/MM')
        if (grouped[key]) {
          if (tx.type === 'income') grouped[key].income += tx.amount
          else grouped[key].expenses += tx.amount
        }
      })
      return Object.entries(grouped)
        .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
        .map(([key, v]) => ({ month: key, receitas: v.income, despesas: v.expenses, lucro: v.income - v.expenses }))
        .filter((_, i, arr) => arr.length > 30 ? i % Math.ceil(arr.length / 30) === 0 : true)
    }

    return eachMonthOfInterval({ start, end }).map(monthDate => {
      const ms = startOfMonth(monthDate)
      const me = endOfMonth(monthDate)
      const monthTx = filteredTransactions.filter(tx => isWithinInterval(new Date(tx.date), { start: ms, end: me }))
      const income = monthTx.filter(tx => tx.type === 'income').reduce((acc, tx) => acc + tx.amount, 0)
      const expenses = monthTx.filter(tx => tx.type === 'expense').reduce((acc, tx) => acc + tx.amount, 0)
      return { month: format(monthDate, dateFmt), receitas: income, despesas: expenses, lucro: income - expenses }
    })
  }

  const generateCategoryPieData = () =>
    Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a).slice(0, 6)
      .map(([category, amount]) => ({ name: category.charAt(0).toUpperCase() + category.slice(1), value: amount }))

  const generatePropertyBarData = () =>
    propertyStats.slice(0, 8).map(stat => ({
      name: stat.property.name.length > 15 ? stat.property.name.substring(0, 15) + '...' : stat.property.name,
      receita: stat.revenue,
      contratos: stat.bookings
    }))

  const generateTaskCompletionData = () => {
    const { start, end } = dateRange
    return eachMonthOfInterval({ start, end }).map(monthDate => {
      const ms = startOfMonth(monthDate)
      const me = endOfMonth(monthDate)
      const monthTasks = (tasks || []).filter(tk => isWithinInterval(new Date(tk.createdAt), { start: ms, end: me }))
      return {
        month: format(monthDate, dateFmt),
        concluídas: monthTasks.filter(tk => tk.status === 'completed').length,
        pendentes: monthTasks.filter(tk => tk.status !== 'completed').length
      }
    })
  }

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444']

  const monthlyData = generateMonthlyData()
  const categoryPieData = generateCategoryPieData()
  const propertyBarData = generatePropertyBarData()
  const taskCompletionData = generateTaskCompletionData()

  const handleRefresh = () => { toast.success(t.common.refreshed_success) }

  const rangeLabel = `${format(dateRange.start, dateRangeFmt)} ${rv.to} ${format(dateRange.end, dateRangeFmt)}`
  const customDateRangeValue: DateRange | undefined = customStartDate || customEndDate
    ? { from: customStartDate, to: customEndDate }
    : undefined

  const handleCustomDateRangeChange = (range: DateRange | undefined) => {
    setCustomStartDate(range?.from)
    setCustomEndDate(range?.to)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">{rv.title}</h2>
            <HelpButton content={helpContent} title="Ajuda — Relatórios" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{rv.subtitle}</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap xl:w-auto xl:justify-end">
          <Select value={dateRangePreset} onValueChange={(value) => setDateRangePreset(value as DateRangePreset)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{rv.preset_7d}</SelectItem>
              <SelectItem value="30d">{rv.preset_30d}</SelectItem>
              <SelectItem value="3m">{rv.preset_3m}</SelectItem>
              <SelectItem value="6m">{rv.preset_6m}</SelectItem>
              <SelectItem value="1y">{rv.preset_1y}</SelectItem>
              <SelectItem value="ytd">{rv.preset_ytd}</SelectItem>
              <SelectItem value="custom">{rv.preset_custom}</SelectItem>
            </SelectContent>
          </Select>

          {dateRangePreset === 'custom' && (
            <DateRangePicker
              value={customDateRangeValue}
              onChange={handleCustomDateRangeChange}
              placeholder={rv.select_period}
              className="w-full justify-start sm:w-auto"
              disabled={(date) => date > new Date()}
            />
          )}

          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {t.common.refresh}
          </Button>
        </div>
      </div>

      {/* KPI Cards row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <House weight="duotone" size={16} />
              {t.tabs.properties}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{(properties || []).length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(properties || []).filter(p => p.status === 'available').length} {rv.available}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users weight="duotone" size={16} />
              {t.tabs.owners}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{(owners || []).length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(properties || []).filter(p => p.ownerIds?.length > 0).length} {rv.properties_with_owner}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar weight="duotone" size={16} />
              {rv.occupancy_rate}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{occupancyRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {occupiedPropertiesFromContracts.size} {rv.with_active_contracts}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendUp weight="duotone" size={16} />
                {rv.revenue}
              </CardTitle>
              <Badge variant="outline" className="text-xs">{rv.period}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">{formatCurrency(totalIncome)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(monthlyIncome)} {rv.this_month}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User weight="duotone" size={16} />
              {t.tabs.guests}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{(guests || []).length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {guestActivity.filter(g => g.activeContracts > 0).length} {rv.with_active_contracts}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Files weight="duotone" size={16} />
              {t.tabs.contracts}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeContracts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {expiringContracts.length} {rv.expiring_in_30_days}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wrench weight="duotone" size={16} />
              {t.tabs.providers}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{(serviceProviders || []).length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(providerUtilization.reduce((acc, p) => acc + p.totalSpent, 0))} {rv.spent}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarCheck weight="duotone" size={16} />
              {t.tabs.appointments}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{scheduledAppointments.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {completedAppointments.length} {rv.completed}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Financial evolution chart */}
      <Card>
        <CardHeader>
          <CardTitle>{rv.financial_evolution} — {rangeLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyData.every(m => m.receitas === 0 && m.despesas === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-12">{rv.add_transactions_hint}</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
                <Line type="monotone" dataKey="receitas" stroke="#10b981" strokeWidth={2} name={rv.income} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} name={rv.expenses} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="lucro" stroke="#6366f1" strokeWidth={2} name={rv.profit} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense distribution pie */}
        <Card>
          <CardHeader>
            <CardTitle>{rv.expense_distribution}</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryPieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">{rv.no_expense_data}</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={categoryPieData} cx="50%" cy="50%" labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80} fill="#8884d8" dataKey="value">
                    {categoryPieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Monthly financial summary */}
        <Card>
          <CardHeader>
            <CardTitle>{rv.monthly_summary}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-3 rounded-lg border border-success/20 bg-success/5 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <TrendUp weight="duotone" size={20} className="text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{rv.income}</p>
                  <p className="text-xl font-bold text-success">{formatCurrency(monthlyIncome)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <TrendDown weight="duotone" size={20} className="text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{rv.expenses}</p>
                  <p className="text-xl font-bold text-destructive">{formatCurrency(monthlyExpenses)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">{rv.net_profit}</p>
                <p className={`text-2xl font-bold ${(monthlyIncome - monthlyExpenses) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(monthlyIncome - monthlyExpenses)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top expense categories */}
        <Card>
          <CardHeader>
            <CardTitle>{rv.top_expense_categories}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topExpenseCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{rv.no_expense_data}</p>
            ) : (
              topExpenseCategories.map(([category, amount]) => {
                const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{category}</span>
                      <span className="text-muted-foreground">{formatCurrency(amount)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-primary rounded-full h-2 transition-all duration-300" style={{ width: `${percentage}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% {rv.of_total_expenses}</p>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by property bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>{rv.revenue_by_property}</CardTitle>
        </CardHeader>
        <CardContent>
          {propertyBarData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">{rv.add_properties_hint}</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={propertyBarData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'receita' ? formatCurrency(value) : value,
                    name === 'receita' ? rv.revenue : rv.contracts
                  ]}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar dataKey="receita" fill="#10b981" name={rv.revenue} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task completion chart */}
        <Card>
          <CardHeader>
            <CardTitle>{rv.task_completion} — {rangeLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            {taskCompletionData.every(m => m.concluídas === 0 && m.pendentes === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-12">{rv.add_tasks_hint}</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={taskCompletionData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Bar dataKey="concluídas" fill="#10b981" name={rv.completed_tasks} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pendentes" fill="#f59e0b" name={rv.pending_tasks} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Property performance table */}
      <Card>
        <CardHeader>
          <CardTitle>{rv.property_performance}</CardTitle>
        </CardHeader>
        <CardContent>
          {propertyStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{rv.add_properties_performance_hint}</p>
          ) : (
            <div className="space-y-4">
              {propertyStats.map(stat => (
                <div key={stat.property.id} className="flex flex-col gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold">{stat.property.name}</h4>
                      <Badge variant="outline" className="capitalize">{stat.property.type}</Badge>
                    </div>
                    {stat.owners.length > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <Users size={12} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{stat.owners.map(o => o.name).join(', ')}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{stat.bookings} {rv.contracts}</span>
                      <span>•</span>
                      <span>{stat.bookedDays} {rv.contract_days}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-success">{formatCurrency(stat.revenue)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{rv.total_revenue}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most used providers */}
        <Card>
          <CardHeader>
            <CardTitle>{rv.most_used_providers}</CardTitle>
          </CardHeader>
          <CardContent>
            {providerUtilization.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{rv.no_providers}</p>
            ) : (
              <div className="space-y-3">
                {providerUtilization.slice(0, 5).map(item => (
                  <div key={item.provider.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <p className="font-semibold">{item.provider.name}</p>
                      <p className="text-sm text-muted-foreground">{item.provider.service}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{item.transactions} {rv.transactions}</span>
                        <span>•</span>
                        <span>{item.appointments} {rv.appointments}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{formatCurrency(item.totalSpent)}</p>
                      <p className="text-xs text-muted-foreground">{rv.total_spent}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring contracts */}
        <Card>
          <CardHeader>
            <CardTitle>{rv.expiring_contracts}</CardTitle>
          </CardHeader>
          <CardContent>
            {expiringContracts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{rv.no_expiring_contracts}</p>
            ) : (
              <div className="space-y-3">
                {expiringContracts.slice(0, 5).map(contract => {
                  const guest = (guests || []).find(g => g.id === contract.guestId)
                  const daysUntilExpiry = differenceInDays(parseISO(contract.endDate), now)
                  return (
                    <div key={contract.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <p className="font-semibold">{guest?.name || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">{contract.propertyIds.length} {t.contracts_view.properties_count}</p>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {rv.expires_in} {daysUntilExpiry} {rv.days}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{formatCurrency(contract.monthlyAmount)}</p>
                        <p className="text-xs text-muted-foreground">{rv.monthly}</p>
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
        {/* Upcoming appointments */}
        <Card>
          <CardHeader>
            <CardTitle>{rv.upcoming_appointments}</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{rv.no_upcoming_appointments}</p>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.slice(0, 5).map(appointment => {
                  const provider = (serviceProviders || []).find(p => p.id === appointment.serviceProviderId)
                  const guest = (guests || []).find(g => g.id === appointment.guestId)
                  const daysUntil = differenceInDays(parseISO(appointment.date), now)
                  return (
                    <div key={appointment.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <p className="font-semibold">{appointment.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {provider?.name || guest?.name || t.appointments_view.no_link}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {daysUntil === 0 ? rv.today : daysUntil === 1 ? rv.tomorrow : `${daysUntil} ${rv.days}`}
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

        {/* Most active guests */}
        <Card>
          <CardHeader>
            <CardTitle>{rv.most_active_guests}</CardTitle>
          </CardHeader>
          <CardContent>
            {guestActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{rv.no_guests_with_contracts}</p>
            ) : (
              <div className="space-y-3">
                {guestActivity.slice(0, 5).map(item => (
                    <div key={item.guest.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <p className="font-semibold">{item.guest.name}</p>
                      <p className="text-sm text-muted-foreground">{item.guest.email}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{item.contracts} {rv.contracts}</span>
                        <span>•</span>
                        <span>{item.activeContracts} {rv.active_label}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-success">{formatCurrency(item.totalPaid)}</p>
                      <p className="text-xs text-muted-foreground">{rv.total_paid}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
