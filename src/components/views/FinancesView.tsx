import { useState, useMemo } from 'react'
import { useKV } from '@github/spark/hooks'
import { Transaction, TransactionType, Property } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Plus, TrendUp, TrendDown, Trash, CalendarBlank } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import { useLanguage } from '@/lib/LanguageContext'
import { useCurrency } from '@/lib/CurrencyContext'

interface MonthlyData {
  month: string
  year: number
  income: number
  expenses: number
  balance: number
  transactions: Transaction[]
}

export default function FinancesView() {
  const { t, language } = useLanguage()
  const { formatCurrency, config } = useCurrency()
  const [transactions, setTransactions] = useKV<Transaction[]>('transactions', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    type: 'income' as TransactionType,
    amount: 0,
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    propertyId: '',
    serviceProvider: ''
  })

  const locale = language === 'pt' ? ptBR : enUS

  const monthlyData = useMemo(() => {
    if (!transactions || transactions.length === 0) return []

    const monthMap = new Map<string, MonthlyData>()

    transactions.forEach((transaction) => {
      const date = parseISO(transaction.date)
      const monthKey = format(date, 'yyyy-MM')
      const monthLabel = format(date, 'MMMM yyyy', { locale })
      const year = date.getFullYear()

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthLabel,
          year,
          income: 0,
          expenses: 0,
          balance: 0,
          transactions: [],
        })
      }

      const monthData = monthMap.get(monthKey)!
      monthData.transactions.push(transaction)

      if (transaction.type === 'income') {
        monthData.income += transaction.amount
      } else {
        monthData.expenses += transaction.amount
      }

      monthData.balance = monthData.income - monthData.expenses
    })

    return Array.from(monthMap.values())
      .sort((a, b) => b.year - a.year || b.month.localeCompare(a.month))
  }, [transactions, locale])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const newTransaction: Transaction = {
      ...formData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    }
    setTransactions((current) => [...(current || []), newTransaction])
    toast.success(t.finances_view.form.created_success)
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      type: 'income',
      amount: 0,
      category: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      propertyId: '',
      serviceProvider: ''
    })
    setIsDialogOpen(false)
  }

  const handleDelete = (id: string) => {
    setTransactions((current) => (current || []).filter(t => t.id !== id))
    toast.success(t.finances_view.deleted_success)
  }

  const totalIncome = (transactions || []).filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0)
  const totalExpenses = (transactions || []).filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)
  const balance = totalIncome - totalExpenses

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t.finances_view.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t.finances_view.monthly_cashflow}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus weight="bold" size={16} />
              {t.finances_view.add_transaction}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t.finances_view.form.title_new}</DialogTitle>
              <DialogDescription>{t.finances_view.form.description}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">{t.finances_view.form.type}</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as TransactionType })}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">{t.finances_view.income}</SelectItem>
                      <SelectItem value="expense">{t.finances_view.expense}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">{t.finances_view.form.amount} ({config.symbol})</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">{t.finances_view.form.category}</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder={t.finances_view.form.category_placeholder}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">{t.finances_view.form.date}</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="propertyId">{t.finances_view.form.property} {t.finances_view.form.optional}</Label>
                <Select value={formData.propertyId || undefined} onValueChange={(value) => setFormData({ ...formData, propertyId: value })}>
                  <SelectTrigger id="propertyId">
                    <SelectValue placeholder={t.finances_view.form.select_property} />
                  </SelectTrigger>
                  <SelectContent>
                    {(properties || []).map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceProvider">{t.finances_view.form.provider} {t.finances_view.form.optional}</Label>
                <Input
                  id="serviceProvider"
                  value={formData.serviceProvider}
                  onChange={(e) => setFormData({ ...formData, serviceProvider: e.target.value })}
                  placeholder={t.finances_view.no_provider}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t.finances_view.form.description_field}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t.finances_view.form.description_placeholder}
                  rows={3}
                  required
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t.finances_view.form.cancel}
                </Button>
                <Button type="submit">{t.finances_view.form.save}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.finances_view.total_income}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendUp weight="duotone" size={20} className="text-success" />
              <span className="text-2xl font-bold text-success">
                {formatCurrency(totalIncome)}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.finances_view.total_expenses}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendDown weight="duotone" size={20} className="text-destructive" />
              <span className="text-2xl font-bold text-destructive">
                {formatCurrency(totalExpenses)}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.finances_view.net_balance}</CardTitle>
          </CardHeader>
          <CardContent>
            <span className={`text-2xl font-bold ${balance >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(balance)}
            </span>
          </CardContent>
        </Card>
      </div>

      {!transactions || transactions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarBlank weight="duotone" size={64} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t.finances_view.no_transactions}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t.finances_view.add_first}</p>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus weight="bold" size={16} />
              {t.finances_view.add_transaction}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t.finances_view.monthly_cashflow}</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {monthlyData.map((monthData, index) => (
                <AccordionItem key={index} value={`month-${index}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <CalendarBlank weight="duotone" size={24} className="text-primary" />
                        <div className="text-left">
                          <p className="font-semibold capitalize">{monthData.month}</p>
                          <p className="text-xs text-muted-foreground">
                            {monthData.transactions.length} {monthData.transactions.length === 1 ? 'transação' : 'transações'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{t.finances_view.income}</p>
                          <p className="text-sm font-semibold text-success">
                            {formatCurrency(monthData.income)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{t.finances_view.expense}</p>
                          <p className="text-sm font-semibold text-destructive">
                            {formatCurrency(monthData.expenses)}
                          </p>
                        </div>
                        <div className="text-right min-w-[100px]">
                          <p className="text-xs text-muted-foreground">{t.finances_view.net_balance}</p>
                          <p className={`text-base font-bold ${monthData.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {formatCurrency(monthData.balance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {monthData.transactions
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((transaction) => {
                          const property = (properties || []).find(p => p.id === transaction.propertyId)
                          return (
                            <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors ml-8">
                              <div className="flex items-center gap-3 flex-1">
                                <div className={`p-2 rounded-lg ${transaction.type === 'income' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                                  {transaction.type === 'income' ? (
                                    <TrendUp weight="duotone" size={18} className="text-success" />
                                  ) : (
                                    <TrendDown weight="duotone" size={18} className="text-destructive" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm">{transaction.description}</p>
                                    <Badge variant="outline" className="text-xs">{transaction.category}</Badge>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1">
                                    <p className="text-xs text-muted-foreground">{format(new Date(transaction.date), 'dd/MM/yyyy')}</p>
                                    {property && <p className="text-xs text-muted-foreground">• {property.name}</p>}
                                    {transaction.serviceProvider && <p className="text-xs text-muted-foreground">• {transaction.serviceProvider}</p>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-base font-bold ${transaction.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                                  {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount).replace(/^[^\d-]+/, '')}
                                </span>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(transaction.id)}>
                                  <Trash size={16} />
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
