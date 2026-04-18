import { useLanguage } from '@/lib/LanguageContext'
import { UserManagement } from '@/components/UserManagement'
import { MenuConfiguration } from '@/components/MenuConfiguration'

export default function SettingsView() {
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t.settings_view.title}</h2>
        <p className="text-muted-foreground mt-1">{t.settings_view.subtitle}</p>
      </div>

      <MenuConfiguration />

      <UserManagement />
    </div>
  )
}
