import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLanguage } from '@/lib/LanguageContext'
import { useCurrency, currencies, Currency } from '@/lib/CurrencyContext'
import { toast } from 'sonner'
import { Globe, CurrencyCircleDollar } from '@phosphor-icons/react'
import { UserManagement } from '@/components/UserManagement'

export default function SettingsView() {
  const { t, language, setLanguage } = useLanguage()
  const { currency, setCurrency } = useCurrency()

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang as 'pt' | 'en')
    toast.success(t.settings_view.language_updated)
  }

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency as Currency)
    toast.success(t.settings_view.currency_updated)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t.settings_view.title}</h2>
        <p className="text-muted-foreground mt-1">{t.settings_view.subtitle}</p>
      </div>

      <UserManagement />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe size={24} weight="duotone" className="text-primary" />
            </div>
            <div>
              <CardTitle>{t.settings_view.language_section}</CardTitle>
              <CardDescription>{t.settings_view.language_description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="language">{t.settings_view.language_label}</Label>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger id="language" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt">{t.settings_view.languages.pt}</SelectItem>
                <SelectItem value="en">{t.settings_view.languages.en}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <CurrencyCircleDollar size={24} weight="duotone" className="text-accent" />
            </div>
            <div>
              <CardTitle>{t.settings_view.currency_section}</CardTitle>
              <CardDescription>{t.settings_view.currency_description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="currency">{t.settings_view.currency_label}</Label>
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger id="currency" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(currencies).map(([code, config]) => (
                  <SelectItem key={code} value={code}>
                    {config.symbol} - {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
