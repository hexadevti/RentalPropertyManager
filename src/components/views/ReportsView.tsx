import { useKV } from '@github/spark/hooks'
import { Transaction, Booking, Property, Task } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendUp, TrendDown, House, Calendar, CheckSquare, Percent } from '@phosphor-icons/react'
import { startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from 'date-fns'
import { useCurrency } from '@/lib/CurrencyContext'

export default function ReportsView() {
  const { formatCurrency } = useCurrency()
  const [transactions] = useKV<Transaction[]>('transactions', [])
  const [bookings] = useKV<Booking[]>('bookings', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [tasks] = useKV<Task[]>('tasks', [])

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const currentMonthTransactions = (transactions || []).filter(t =>
    isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd })
  )

  const monthlyIncome = currentMonthTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0)

  const monthlyExpenses = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0)

  const totalIncome = (transactions || [])
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0)

  const totalExpenses = (transactions || [])
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

  const occupancyRate = properties && properties.length > 0
    ? (currentBookings.length / properties.length) * 100
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

  const expensesByCategory = (transactions || [])
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {} as Record<string, number>)

  const topExpenseCategories = Object.entries(expensesByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Reports & Analytics</h2>
        <p className="text-sm text-muted-foreground mt-1">Overview of your rental business performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <House weight="duotone" size={16} />
              Total Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{(properties || []).length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(properties || []).filter(p => p.status === 'available').length} available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar weight="duotone" size={16} />
              Occupancy Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{occupancyRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {currentBookings.length} currently occupied
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendUp weight="duotone" size={16} />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">
              {formatCurrency(totalIncome)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(monthlyIncome)} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckSquare weight="duotone" size={16} />
              Task Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {tasks && tasks.length > 0 ? ((completedTasks / tasks.length) * 100).toFixed(0) : 0}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {completedTasks} of {(tasks || []).length} completed
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Financial Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-success/5 rounded-lg border border-success/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <TrendUp weight="duotone" size={20} className="text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Income</p>
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
                  <p className="text-sm text-muted-foreground">Expenses</p>
                  <p className="text-xl font-bold text-destructive">
                    {formatCurrency(monthlyExpenses)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Net Profit</p>
                <p className={`text-2xl font-bold ${(monthlyIncome - monthlyExpenses) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(monthlyIncome - monthlyExpenses)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Expense Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topExpenseCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No expense data available</p>
            ) : (
              topExpenseCategories.map(([category, amount]) => {
                const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
                return (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{category}</span>
                      <span className="text-muted-foreground">
                        ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% of total expenses</p>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Property Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {propertyStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Add properties to see performance data</p>
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
                      <span>{stat.bookings} bookings</span>
                      <span>•</span>
                      <span>{stat.bookedDays} days booked</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-success">
                      ${stat.revenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Total revenue</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No upcoming bookings</p>
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
                      <p className="text-xs text-muted-foreground mt-1">Check-in in {daysUntil} days</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">${booking.totalAmount}</p>
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
