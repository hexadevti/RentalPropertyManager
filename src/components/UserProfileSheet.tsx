import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/lib/AuthContext'
import { useLanguage } from '@/lib/LanguageContext'
import { useCurrency, currencies, Currency } from '@/lib/CurrencyContext'
import { useDateFormat, dateFormats, DateFormat } from '@/lib/DateFormatContext'
import { SignOut, Globe, CurrencyCircleDollar, CalendarBlank, IdentificationCard, EnvelopeSimple, User } from '@phosphor-icons/react'
import { useState } from 'react'
import { toast } from 'sonner'

interface UserProfileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserProfileSheet({ open, onOpenChange }: UserProfileSheetProps) {
  const { currentUser, userProfile, signOut } = useAuth()
  const { t, language, setLanguage } = useLanguage()
  const { currency, setCurrency } = useCurrency()
  const { dateFormat, setDateFormat } = useDateFormat()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const login = currentUser?.login || userProfile?.githubLogin || 'user'
  const initials = login.slice(0, 2).toUpperCase()
  const roleLabel = userProfile?.role === 'admin' ? (t.roles?.admin || 'Administrador') : (t.roles?.guest || 'Hóspede')
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

  const handleLanguageChange = (val: string) => {
    setLanguage(val as 'pt' | 'en')
    toast.success(t.settings_view.language_updated)
  }

  const handleCurrencyChange = (val: string) => {
    setCurrency(val as Currency)
    toast.success(t.settings_view.currency_updated)
  }

  const handleDateFormatChange = (val: string) => {
    setDateFormat(val as DateFormat)
    toast.success(t.settings_view.date_format_updated)
  }

  if (!currentUser || !userProfile) return null

  const isPortuguese = language === 'pt'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto px-5 sm:px-7">
        <SheetHeader className="pb-4">
          <SheetTitle>{isPortuguese ? 'Perfil do Usuário' : 'User Profile'}</SheetTitle>
        </SheetHeader>

        {/* Avatar + role */}
        <div className="flex items-center gap-4 py-4">
          <Avatar className="h-16 w-16 border-2 border-border">
            <AvatarImage src={currentUser.avatarUrl} alt={login} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-lg font-semibold">{login}</p>
            <Badge variant={roleColor as any}>{roleLabel}</Badge>
          </div>
        </div>

        <Separator />

        {/* Identity data */}
        <div className="py-4 space-y-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            {isPortuguese ? 'Identificação' : 'Identity'}
          </p>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <IdentificationCard size={13} />
              {isPortuguese ? 'ID do usuário' : 'User ID'}
            </Label>
            <p className="text-sm font-mono bg-muted rounded px-2 py-1 break-all select-all">{currentUser.id}</p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <EnvelopeSimple size={13} />
              {isPortuguese ? 'E-mail' : 'Email'}
            </Label>
            <p className="text-sm bg-muted rounded px-2 py-1">{currentUser.email || userProfile.email || '—'}</p>
          </div>
        </div>

        <Separator />

        {/* Preferences */}
        <div className="py-4 space-y-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            {isPortuguese ? 'Preferências' : 'Preferences'}
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
              <CurrencyCircleDollar size={14} className="text-muted-foreground" />
              {t.settings_view.currency_label}
            </Label>
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="w-full">
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
        </div>

        <Separator />

        <div className="pt-4">
          <Button
            variant="outline"
            className="w-full gap-2 text-destructive hover:text-destructive"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            <SignOut size={16} />
            {isPortuguese ? 'Sair da conta' : 'Sign out'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
