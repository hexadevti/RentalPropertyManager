import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { useCurrency, Currency } from '@/lib/CurrencyContext'
import { useNumberFormat } from '@/lib/NumberFormatContext'
import { usePhoneFormat } from '@/lib/PhoneFormatContext'
import { useDateFormat, dateFormats, DateFormat } from '@/lib/DateFormatContext'
import type { DecimalSeparator } from '@/lib/numberFormat'
import { SignOut, Globe, CurrencyCircleDollar, CalendarBlank, IdentificationCard, EnvelopeSimple, MoonStars } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { BugReportDialog } from '@/components/BugReportDialog'
import { ContactUsDialog } from '@/components/ContactUsDialog'

interface UserProfileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeTab?: string
  activeTabLabel?: string
  tabTitleMap?: Record<string, string>
}

export function UserProfileSheet({ open, onOpenChange, activeTab = '', activeTabLabel = '', tabTitleMap = {} }: UserProfileSheetProps) {
  const { currentUser, userProfile, accessProfile, signOut } = useAuth()
  const { t, setLanguage, language } = useLanguage()
  const { currency, setCurrency, availableCurrencies } = useCurrency()
  const { decimalSeparator, setDecimalSeparator } = useNumberFormat()
  const { validPhoneMasks, setValidPhoneMasks } = usePhoneFormat()
  const { dateFormat, setDateFormat } = useDateFormat()
  const { theme, setTheme } = useTheme()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [newPhoneMask, setNewPhoneMask] = useState('')

  const login = currentUser?.login || userProfile?.githubLogin || 'user'
  const initials = login.slice(0, 2).toUpperCase()
  const roleLabel = accessProfile?.name || 'Perfil padrao'
  const roleColor = userProfile?.role === 'admin' ? 'default' : 'secondary'

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
      onOpenChange(false)
    } catch (error) {
      console.error('Sign out failed:', error)
    } finally {
      setIsSigningOut(false)
    }
  }

  const handleLanguageChange = (value: string) => {
    setLanguage(value as 'pt' | 'en')
    toast.success(t.settings_view.language_updated)
  }

  const handleThemeChange = (value: string) => {
    setTheme(value)
    toast.success(t.settings_view.theme_updated)
  }

  const handleCurrencyChange = (value: string) => {
    setCurrency(value as Currency)
    toast.success(t.settings_view.currency_updated)
  }

  const handleDateFormatChange = (value: string) => {
    setDateFormat(value as DateFormat)
    toast.success(t.settings_view.date_format_updated)
  }

  const handleDecimalSeparatorChange = (value: string) => {
    setDecimalSeparator(value as DecimalSeparator)
    toast.success(t.settings_view.number_format_updated)
  }

  const handleAddPhoneMask = () => {
    const trimmedMask = newPhoneMask.trim()
    if (!trimmedMask || !trimmedMask.toLowerCase().includes('x')) {
      toast.error(t.settings_view.phone_mask_invalid)
      return
    }

    setValidPhoneMasks([...validPhoneMasks, trimmedMask])
    setNewPhoneMask('')
    toast.success(t.settings_view.phone_mask_added)
  }

  const handleRemovePhoneMask = (mask: string) => {
    setValidPhoneMasks(validPhoneMasks.filter((item) => item !== mask))
  }

  if (!currentUser || !userProfile) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto px-5 sm:px-7">
        <SheetHeader className="pb-4">
          <SheetTitle>{t.settings_view.profile_title}</SheetTitle>
        </SheetHeader>

        <div className="flex items-center gap-4 py-4">
          <Avatar className="h-16 w-16 border-2 border-border">
            <AvatarImage src={currentUser.avatarUrl} alt={login} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-lg font-semibold">{login}</p>
            <Badge variant={roleColor as 'default' | 'secondary'}>{roleLabel}</Badge>
          </div>
        </div>

        <Separator />

        <div className="py-4 space-y-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            {t.settings_view.identity_section}
          </p>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <IdentificationCard size={13} />
              {t.settings_view.user_id}
            </Label>
            <p className="text-sm font-mono bg-muted rounded px-2 py-1 break-all select-all">{currentUser.id}</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <EnvelopeSimple size={13} />
              {t.guests_view.form.email}
            </Label>
            <p className="text-sm bg-muted rounded px-2 py-1">{currentUser.email || userProfile.email || '—'}</p>
          </div>
        </div>

        <Separator />

        <div className="py-4 space-y-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            {t.settings_view.preferences_section}
          </p>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Globe size={14} className="text-muted-foreground" />
              {t.settings_view.language_label}
            </Label>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt">{t.settings_view.languages.pt}</SelectItem>
                <SelectItem value="en">{t.settings_view.languages.en}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <MoonStars size={14} className="text-muted-foreground" />
              {t.settings_view.theme_label}
            </Label>
            <Select value={theme || 'light'} onValueChange={handleThemeChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t.settings_view.themes.light}</SelectItem>
                <SelectItem value="dark">{t.settings_view.themes.dark}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CurrencyCircleDollar size={14} className="text-muted-foreground" />
              {t.settings_view.currency_label}
            </Label>
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(availableCurrencies).map(([code, config]) => (
                  <SelectItem key={code} value={code}>
                    {config.symbol} - {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CalendarBlank size={14} className="text-muted-foreground" />
              {t.settings_view.date_format_label}
            </Label>
            <Select value={dateFormat} onValueChange={handleDateFormatChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(dateFormats).map(([pattern, config]) => (
                  <SelectItem key={pattern} value={pattern}>
                    {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CurrencyCircleDollar size={14} className="text-muted-foreground" />
              {t.settings_view.number_format_label}
            </Label>
            <Select value={decimalSeparator} onValueChange={handleDecimalSeparatorChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=",">{t.settings_view.decimal_comma}</SelectItem>
                <SelectItem value=".">{t.settings_view.decimal_point}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t.settings_view.number_format_hint}</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <IdentificationCard size={14} className="text-muted-foreground" />
              {t.settings_view.phone_masks_label}
            </Label>
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {t.settings_view.valid_masks}
              </p>
              {validPhoneMasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma mascara cadastrada. O campo de telefone ficara livre para digitacao.
                </p>
              ) : (
                <div className="space-y-2">
                  {validPhoneMasks.map((mask) => (
                    <div key={mask} className="flex items-center justify-between gap-2 rounded bg-muted px-2 py-1 text-sm">
                      <span className="font-mono">{mask}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemovePhoneMask(mask)}>
                        {t.settings_view.remove_mask}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={newPhoneMask}
                  onChange={(event) => setNewPhoneMask(event.target.value)}
                  placeholder={t.settings_view.phone_mask_placeholder}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddPhoneMask}>
                  {t.settings_view.add_mask}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t.settings_view.phone_mask_hint}</p>
          </div>
        </div>

        <Separator />

        <div className="pt-4 space-y-2">
          <BugReportDialog
            activeTab={activeTab}
            activeTabLabel={activeTabLabel}
            tabTitleMap={tabTitleMap}
            fullWidth
          />
          <ContactUsDialog fullWidth />
          <Button
            variant="outline"
            className="w-full gap-2 text-destructive hover:text-destructive"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            <SignOut size={16} />
            {t.settings_view.sign_out}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
