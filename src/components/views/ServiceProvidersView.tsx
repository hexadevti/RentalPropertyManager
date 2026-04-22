import { useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MagnifyingGlass, Plus, Pencil, Trash, Wrench, Envelope, Phone, Briefcase, ArrowsClockwise } from '@phosphor-icons/react'
import helpContent from '@/docs/service-providers.md?raw'
import formHelpContent from '@/docs/form-service-provider.md?raw'
import { HelpButton } from '@/components/HelpButton'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/LanguageContext'
import { usePhoneFormat } from '@/lib/PhoneFormatContext'

export interface ServiceProvider {
  id: string
  name: string
  service: string
  phone: string
  email?: string
  document?: string
  address?: string
  notes?: string
  createdAt: string
}

export default function ServiceProvidersView() {
  const { t } = useLanguage()
  const { formatPhone } = usePhoneFormat()
  const [providers, setProviders] = useKV<ServiceProvider[]>('service-providers', [])
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ServiceProvider | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    service: '',
    phone: '',
    email: '',
    document: '',
    address: '',
    notes: '',
  })

  const resetForm = () => {
    setFormData({
      name: '',
      service: '',
      phone: '',
      email: '',
      document: '',
      address: '',
      notes: '',
    })
    setEditingProvider(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingProvider) {
      setProviders((currentProviders) =>
        (currentProviders || []).map(p =>
          p.id === editingProvider.id
            ? { ...formData, id: p.id, createdAt: p.createdAt }
            : p
        )
      )
      toast.success(t.service_providers_view.updated_success)
    } else {
      const newProvider: ServiceProvider = {
        ...formData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      }
      setProviders((currentProviders) => [...(currentProviders || []), newProvider])
      toast.success(t.service_providers_view.created_success)
    }
    
    setDialogOpen(false)
    resetForm()
  }

  const handleEdit = (provider: ServiceProvider) => {
    setEditingProvider(provider)
    setFormData({
      name: provider.name,
      service: provider.service,
      phone: provider.phone,
      email: provider.email || '',
      document: provider.document || '',
      address: provider.address || '',
      notes: provider.notes || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return
    setProviders((currentProviders) => (currentProviders || []).filter(p => p.id !== id))
    toast.success(t.service_providers_view.deleted_success)
  }

  const filteredProviders = (providers || []).filter(provider =>
    provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (provider.email && provider.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleRefresh = () => {
    setProviders((current) => [...(current || [])])
    toast.success(t.common.refreshed_success)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">{t.service_providers_view.title}</h2>
            <HelpButton content={helpContent} title={t.service_providers_view.help_title} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {t.common.refresh}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus weight="bold" />
                {t.service_providers_view.add_provider}
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1">
                {editingProvider ? t.service_providers_view.form.title_edit : t.service_providers_view.form.title_new}
                <HelpButton content={formHelpContent} title={t.service_providers_view.form.help_title} />
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="provider-name">{t.service_providers_view.form.name_required}</Label>
                  <Input
                    id="provider-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.service_providers_view.form.name_placeholder}
                    required
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="provider-service">{t.service_providers_view.form.service_required}</Label>
                  <Input
                    id="provider-service"
                    value={formData.service}
                    onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                    placeholder={t.service_providers_view.form.service_placeholder}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="provider-phone">{t.service_providers_view.form.phone_required}</Label>
                  <PhoneInput
                    id="provider-phone"
                    value={formData.phone}
                    onValueChange={(value) => setFormData({ ...formData, phone: value })}
                    placeholder={t.service_providers_view.form.phone_placeholder}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="provider-email">{t.service_providers_view.form.email_optional}</Label>
                  <Input
                    id="provider-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={t.service_providers_view.form.email_placeholder}
                  />
                </div>

                <div>
                  <Label htmlFor="provider-document">{t.service_providers_view.form.document_optional}</Label>
                  <Input
                    id="provider-document"
                    value={formData.document}
                    onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                    placeholder={t.service_providers_view.form.document_placeholder}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="provider-address">{t.service_providers_view.form.address_optional}</Label>
                  <Input
                    id="provider-address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder={t.service_providers_view.form.address_placeholder}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="provider-notes">{t.service_providers_view.form.notes_optional}</Label>
                  <Textarea
                    id="provider-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t.service_providers_view.form.notes_placeholder}
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setDialogOpen(false)
                  resetForm()
                }}>
                  {t.service_providers_view.form.cancel}
                </Button>
                <Button type="submit">{t.service_providers_view.form.save}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <Input
          placeholder={t.service_providers_view.search_placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredProviders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Wrench size={64} weight="duotone" className="text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {searchQuery ? t.service_providers_view.no_results : t.service_providers_view.no_providers}
            </h3>
            {!searchQuery && (
              <p className="text-muted-foreground text-center max-w-md">
                {t.service_providers_view.add_first}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredProviders.map((provider) => (
            <Card key={provider.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center">
                      <Wrench size={24} weight="duotone" className="text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-xl mb-1">{provider.name}</CardTitle>
                      <div className="flex items-center gap-2 text-sm mb-2">
                        <Briefcase size={16} weight="duotone" className="text-accent" />
                        <span className="font-medium text-accent">{provider.service}</span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Phone size={16} weight="duotone" />
                          {formatPhone(provider.phone)}
                        </div>
                        {provider.email && (
                          <div className="flex items-center gap-1.5">
                            <Envelope size={16} weight="duotone" />
                            {provider.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(provider)}
                    >
                      <Pencil size={18} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(provider.id)}
                    >
                      <Trash size={18} className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {(provider.document || provider.address || provider.notes) && (
                <CardContent>
                  <div className="space-y-2">
                    {provider.document && (
                      <div className="text-sm">
                        <span className="font-medium text-foreground">{t.service_providers_view.document_label}:</span>{' '}
                        <span className="text-muted-foreground">{provider.document}</span>
                      </div>
                    )}
                    {provider.address && (
                      <div className="text-sm">
                        <span className="font-medium text-foreground">{t.service_providers_view.address_label}:</span>{' '}
                        <span className="text-muted-foreground">{provider.address}</span>
                      </div>
                    )}
                    {provider.notes && (
                      <div className="text-sm">
                        <span className="font-medium text-foreground">{t.service_providers_view.notes_label}:</span>{' '}
                        <span className="text-muted-foreground italic">{provider.notes}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
