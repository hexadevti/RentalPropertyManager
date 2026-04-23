import { useState, useMemo, useEffect, useRef } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Transaction, TransactionType, Property, Contract, ServiceProvider, Guest, Owner } from '@/types'
import helpContent from '@/docs/finances.md?raw'
import formHelpContent from '@/docs/form-transaction.md?raw'
import { HelpButton } from '@/components/HelpButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Plus, TrendUp, TrendDown, Trash, CalendarBlank, ArrowsClockwise, PencilSimple, CaretDown, UploadSimple, DownloadSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'
import { useLanguage } from '@/lib/LanguageContext'
import { useCurrency } from '@/lib/CurrencyContext'
import { getContractSelectionLabel } from '@/lib/contractLabels'

interface MonthlyData {
  monthKey: string
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
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [serviceProviders] = useKV<ServiceProvider[]>('service-providers', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [owners] = useKV<Owner[]>('owners', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [csvParsedRows, setCsvParsedRows] = useState<Partial<Transaction>[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const restoreScrollYRef = useRef<number | null>(null)
  const [monthFilter, setMonthFilter] = useState('all')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [contractFilter, setContractFilter] = useState('all')
  const [guestFilter, setGuestFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [serviceProviderFilter, setServiceProviderFilter] = useState('all')
  const [ownerFilter, setOwnerFilter] = useState('all')
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    type: 'income' as TransactionType,
    amount: 0,
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    propertyId: undefined as string | undefined,
    contractId: undefined as string | undefined,
    serviceProviderId: undefined as string | undefined
  })

  const locale = language === 'pt' ? ptBR : enUS

  useEffect(() => {
    setRefreshKey(prev => prev + 1)
  }, [contracts, serviceProviders, guests])

  const monthOptions = useMemo(() => {
    return Array.from(new Set((transactions || []).map((transaction) => {
      const date = parseISO(transaction.date)
      return format(date, 'yyyy-MM')
    }))).sort()
  }, [transactions])

  const categoryOptions = useMemo(() => {
    return Array.from(new Set((transactions || [])
      .map((transaction) => transaction.category.trim())
      .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b))
  }, [transactions])

  const getTransactionContract = (transaction: Transaction) => (
    (contracts || []).find((contract) => contract.id === transaction.contractId) || null
  )

  const getTransactionPropertyIds = (transaction: Transaction) => {
    const propertyIds = new Set<string>()
    if (transaction.propertyId) propertyIds.add(transaction.propertyId)

    const contract = getTransactionContract(transaction)
    for (const propertyId of contract?.propertyIds || []) {
      propertyIds.add(propertyId)
    }

    return Array.from(propertyIds)
  }

  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter((transaction) => {
      const transactionDate = parseISO(transaction.date)
      const contract = getTransactionContract(transaction)
      const propertyIds = getTransactionPropertyIds(transaction)

      if (monthFilter !== 'all' && format(transactionDate, 'yyyy-MM') !== monthFilter) return false
      if (startDateFilter && transactionDate < parseISO(startDateFilter)) return false
      if (endDateFilter && transactionDate > parseISO(endDateFilter)) return false
      if (contractFilter !== 'all' && transaction.contractId !== contractFilter) return false
      if (guestFilter !== 'all' && contract?.guestId !== guestFilter) return false
      if (categoryFilter !== 'all' && transaction.category !== categoryFilter) return false
      if (serviceProviderFilter !== 'all' && transaction.serviceProviderId !== serviceProviderFilter) return false
      if (propertyFilter !== 'all' && !propertyIds.includes(propertyFilter)) return false

      if (ownerFilter !== 'all') {
        const hasOwner = propertyIds.some((propertyId) => {
          const property = (properties || []).find((item) => item.id === propertyId)
          return property?.ownerIds?.includes(ownerFilter)
        })
        if (!hasOwner) return false
      }

      return true
    })
  }, [
    transactions,
    contracts,
    properties,
    monthFilter,
    startDateFilter,
    endDateFilter,
    contractFilter,
    guestFilter,
    categoryFilter,
    serviceProviderFilter,
    ownerFilter,
    propertyFilter,
  ])

  const monthlyData = useMemo(() => {
    if (!filteredTransactions || filteredTransactions.length === 0) return []

    const monthMap = new Map<string, MonthlyData>()

    filteredTransactions.forEach((transaction) => {
      const date = parseISO(transaction.date)
      const monthKey = format(date, 'yyyy-MM')
      const monthLabel = format(date, 'MMMM yyyy', { locale })
      const year = date.getFullYear()

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          monthKey,
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
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
  }, [filteredTransactions, locale, contracts, serviceProviders, guests, properties, owners, refreshKey])

  const handleDownloadTemplate = () => {
    const rows = [
      ['type', 'amount', 'category', 'description', 'date'],
      ['income', '1500.00', 'Aluguel', 'Aluguel apartamento 01 - Janeiro', '2026-01-05'],
      ['expense', '250.00', 'Manutenção', 'Troca de torneira', '2026-01-10'],
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-transacoes.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const parseCSVLine = (line: string, sep: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === sep && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const parseDate = (raw: string): string => {
    const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    return new Date().toISOString().split('T')[0]
  }

  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError(null)
    setCsvParsedRows([])
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string).replace(/\r/g, '')
        const lines = text.split('\n').filter(l => l.trim())
        if (lines.length < 2) { setCsvError(t.finances_view.import_error_empty); return }
        const sep = lines[0].includes(';') ? ';' : ','
        const headers = parseCSVLine(lines[0], sep).map(h => h.toLowerCase().replace(/\s/g, ''))
        const typeMap: Record<string, TransactionType> = {
          income: 'income', receita: 'income', entrada: 'income',
          expense: 'expense', despesa: 'expense', saida: 'expense', saída: 'expense',
        }
        const rows: Partial<Transaction>[] = []
        for (let i = 1; i < lines.length; i++) {
          const vals = parseCSVLine(lines[i], sep)
          const row: Record<string, string> = {}
          headers.forEach((h, idx) => { row[h] = vals[idx] ?? '' })
          const amount = parseFloat(row.amount?.replace(',', '.') ?? '')
          if (!row.type && !row.amount) continue
          rows.push({
            type: typeMap[row.type?.toLowerCase()] ?? 'income',
            amount: isNaN(amount) ? 0 : amount,
            category: row.category ?? '',
            description: row.description ?? '',
            date: parseDate(row.date ?? ''),
          })
        }
        if (rows.length === 0) { setCsvError(t.finances_view.import_error_empty); return }
        setCsvParsedRows(rows)
      } catch {
        setCsvError(t.finances_view.import_error_parse)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleImportConfirm = () => {
    const newTransactions: Transaction[] = csvParsedRows.map((row) => ({
      ...row,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      type: row.type ?? 'income',
      amount: row.amount ?? 0,
      category: row.category ?? '',
      description: row.description ?? '',
      date: row.date ?? new Date().toISOString().split('T')[0],
    } as Transaction))
    setTransactions((current) => [...(current ?? []), ...newTransactions])
    toast.success(`${newTransactions.length} ${t.finances_view.import_success}`)
    setIsImportDialogOpen(false)
    setCsvParsedRows([])
    setCsvError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    restoreScrollYRef.current = window.scrollY
    
    if (editingTransaction) {
      const updatedTransaction: Transaction = {
        ...editingTransaction,
        ...formData
      }
      setTransactions((current) => 
        (current || []).map(t => t.id === editingTransaction.id ? updatedTransaction : t)
      )
      toast.success(t.finances_view.form.updated_success)
    } else {
      const newTransaction: Transaction = {
        ...formData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      }
      setTransactions((current) => [...(current || []), newTransaction])
      toast.success(t.finances_view.form.created_success)
    }
    resetForm()
  }

  useEffect(() => {
    if (isDialogOpen || restoreScrollYRef.current === null) return
    const scrollY = restoreScrollYRef.current
    restoreScrollYRef.current = null
    window.setTimeout(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: 'auto' })
      })
    }, 0)
  }, [isDialogOpen, transactions])

  const resetForm = () => {
    if (restoreScrollYRef.current === null) {
      restoreScrollYRef.current = window.scrollY
    }
    setFormData({
      type: 'income',
      amount: 0,
      category: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      propertyId: undefined,
      contractId: undefined,
      serviceProviderId: undefined
    })
    setEditingTransaction(null)
    setIsDialogOpen(false)
  }

  const handleEdit = (transaction: Transaction) => {
    restoreScrollYRef.current = window.scrollY
    setEditingTransaction(transaction)
    setFormData({
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description,
      date: transaction.date,
      propertyId: transaction.propertyId,
      contractId: transaction.contractId,
      serviceProviderId: transaction.serviceProviderId
    })
    setIsDialogOpen(true)
  }

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      resetForm()
      return
    }
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return
    setTransactions((current) => (current || []).filter(t => t.id !== id))
    toast.success(t.finances_view.deleted_success)
  }

  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0)
  const totalExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0)
  const balance = totalIncome - totalExpenses

  const contractOptions = (contracts || []).filter((contract) => (
    !formData.propertyId || contract.propertyIds.includes(formData.propertyId)
  ))

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    toast.success(t.common.refreshed_success)
  }

  const clearFilters = () => {
    setMonthFilter('all')
    setStartDateFilter('')
    setEndDateFilter('')
    setContractFilter('all')
    setGuestFilter('all')
    setCategoryFilter('all')
    setServiceProviderFilter('all')
    setOwnerFilter('all')
    setPropertyFilter('all')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">{t.finances_view.title}</h2>
            <HelpButton content={helpContent} title="Ajuda — Finanças" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{t.finances_view.monthly_cashflow}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {t.common.refresh}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => { setCsvParsedRows([]); setCsvError(null); setIsImportDialogOpen(true) }}>
            <UploadSimple weight="bold" size={16} />
            {t.finances_view.import_csv}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus weight="bold" size={16} />
                {t.finances_view.add_transaction}
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-w-2xl"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1">
                {editingTransaction ? t.finances_view.form.title_edit : t.finances_view.form.title_new}
                <HelpButton content={formHelpContent} title="Ajuda — Formulário de Transação" />
              </DialogTitle>
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
                  <DecimalInput
                    id="amount"
                    min="0"
                    value={formData.amount}
                    onValueChange={(value) => setFormData({ ...formData, amount: value })}
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
                  <DateInput
                    id="date"
                    value={formData.date}
                    onChange={(value) => setFormData({ ...formData, date: value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="propertyId">{t.finances_view.form.property} {t.finances_view.form.optional}</Label>
                <Select
                  value={formData.propertyId || 'none'}
                  onValueChange={(value) => {
                    const nextPropertyId = value === 'none' ? undefined : value
                    setFormData((current) => {
                      const currentContract = (contracts || []).find((contract) => contract.id === current.contractId)
                      const shouldKeepContract = !nextPropertyId || currentContract?.propertyIds.includes(nextPropertyId)
                      return {
                        ...current,
                        propertyId: nextPropertyId,
                        contractId: shouldKeepContract ? current.contractId : undefined,
                      }
                    })
                  }}
                >
                  <SelectTrigger id="propertyId">
                    <SelectValue placeholder={t.finances_view.form.select_property} />
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

              {formData.type === 'income' && (
                <div className="space-y-2">
                  <Label htmlFor="contractId">Contrato (opcional)</Label>
                  <Select value={formData.contractId || 'none'} onValueChange={(value) => setFormData({ ...formData, contractId: value === 'none' ? undefined : value })}>
                    <SelectTrigger id="contractId">
                      <SelectValue placeholder="Selecione um contrato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {contractOptions.map((contract) => (
                        <SelectItem key={contract.id} value={contract.id}>
                          {getContractSelectionLabel(contract, properties || [])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.type === 'expense' && (
                <div className="space-y-2">
                  <Label htmlFor="serviceProviderId">Prestador de Serviço (opcional)</Label>
                  <Select value={formData.serviceProviderId || 'none'} onValueChange={(value) => setFormData({ ...formData, serviceProviderId: value === 'none' ? undefined : value })}>
                    <SelectTrigger id="serviceProviderId">
                      <SelectValue placeholder="Selecione um prestador" />
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
              )}

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
      </div>

      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="h-auto gap-2 px-0 text-base font-semibold hover:bg-transparent">
                  <CaretDown
                    size={16}
                    className={`transition-transform ${filtersOpen ? 'rotate-0' : '-rotate-90'}`}
                  />
                  {t.finances_view.filters}
                </Button>
              </CollapsibleTrigger>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                {t.finances_view.clear_filters}
              </Button>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>{t.finances_view.month}</Label>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.finances_view.all_months}</SelectItem>
                {monthOptions.map((month) => (
                  <SelectItem key={month} value={month}>
                    {format(parseISO(`${month}-01`), 'MMMM yyyy', { locale })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.finances_view.start_date}</Label>
            <DateInput value={startDateFilter} onChange={setStartDateFilter} />
          </div>

          <div className="space-y-2">
            <Label>{t.finances_view.end_date}</Label>
            <DateInput value={endDateFilter} onChange={setEndDateFilter} />
          </div>

          <div className="space-y-2">
            <Label>{t.finances_view.contract_filter}</Label>
            <Select value={contractFilter} onValueChange={setContractFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.finances_view.all_contracts}</SelectItem>
                {(contracts || []).map((contract) => (
                  <SelectItem key={contract.id} value={contract.id}>
                    {getContractSelectionLabel(contract, properties || [])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.finances_view.guest_filter}</Label>
            <Select value={guestFilter} onValueChange={setGuestFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.finances_view.all_guests}</SelectItem>
                {(guests || []).map((guest) => (
                  <SelectItem key={guest.id} value={guest.id}>
                    {guest.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.finances_view.category_filter}</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.finances_view.all_categories}</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.finances_view.service_provider_filter}</Label>
            <Select value={serviceProviderFilter} onValueChange={setServiceProviderFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.finances_view.all_providers}</SelectItem>
                {(serviceProviders || []).map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name} - {provider.service}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.finances_view.owner_filter}</Label>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.finances_view.all_owners}</SelectItem>
                {(owners || []).map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.finances_view.property_filter}</Label>
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.finances_view.all_properties}</SelectItem>
                {(properties || []).map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
      ) : filteredTransactions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarBlank weight="duotone" size={64} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t.finances_view.no_results}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t.finances_view.no_results_hint}</p>
            <Button variant="outline" onClick={clearFilters}>
              {t.finances_view.clear_filters}
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
              {monthlyData.map((monthData) => (
                <AccordionItem key={monthData.monthKey} value={`month-${monthData.monthKey}`}>
                  <AccordionTrigger className="cursor-pointer hover:no-underline">
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
                      {[...monthData.transactions]
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((transaction) => {
                          const property = (properties || []).find(p => p.id === transaction.propertyId)
                          const contract = (contracts || []).find(c => c.id === transaction.contractId)
                          const guest = contract ? (guests || []).find(g => g.id === contract.guestId) : null
                          const provider = (serviceProviders || []).find(sp => sp.id === transaction.serviceProviderId)
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
                                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                                    <p className="text-xs text-muted-foreground">{format(new Date(transaction.date), 'dd/MM/yyyy')}</p>
                                    {property && <p className="text-xs text-muted-foreground">• {property.name}</p>}
                                    {guest && <p className="text-xs text-muted-foreground">• Contrato: {guest.name}</p>}
                                    {provider && <p className="text-xs text-muted-foreground">• Prestador: {provider.name}</p>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-base font-bold ${transaction.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                                  {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount).replace(/^[^\d-]+/, '')}
                                </span>
                                <Button variant="ghost" size="sm" className="text-primary hover:text-primary" onClick={() => handleEdit(transaction)}>
                                  <PencilSimple size={16} />
                                </Button>
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

      <Dialog open={isImportDialogOpen} onOpenChange={(open) => { setIsImportDialogOpen(open); if (!open) { setCsvParsedRows([]); setCsvError(null) } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.finances_view.import_dialog_title}</DialogTitle>
            <DialogDescription>{t.finances_view.import_hint}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadTemplate}>
              <DownloadSimple weight="bold" size={16} />
              {t.finances_view.import_download_template}
            </Button>
            <div className="space-y-2">
              <Label>{t.finances_view.import_select_file}</Label>
              <input
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:text-sm file:font-medium file:bg-background file:text-foreground hover:file:bg-accent cursor-pointer"
                onChange={handleCSVFile}
              />
            </div>
            {csvError && (
              <p className="text-sm text-destructive">{csvError}</p>
            )}
            {csvParsedRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t.finances_view.import_preview} — {csvParsedRows.length} {t.finances_view.import_rows_found}</p>
                <div className="border rounded-lg overflow-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">{t.finances_view.import_col_type}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.finances_view.import_col_amount}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.finances_view.import_col_category}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.finances_view.import_col_description}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.finances_view.import_col_date}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvParsedRows.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">
                            <Badge variant="outline" className={row.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                              {row.type === 'income' ? t.finances_view.income : t.finances_view.expense}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-medium">{formatCurrency(row.amount ?? 0)}</td>
                          <td className="px-3 py-2">{row.category}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate">{row.description}</td>
                          <td className="px-3 py-2">{row.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              {t.finances_view.cancel}
            </Button>
            <Button onClick={handleImportConfirm} disabled={csvParsedRows.length === 0}>
              {t.finances_view.import_confirm_btn} {csvParsedRows.length > 0 && `(${csvParsedRows.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
