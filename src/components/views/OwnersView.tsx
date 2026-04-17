import { useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Owner, Property } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, User, Pencil, Trash, House, EnvelopeSimple, Phone, IdentificationCard } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/LanguageContext'

export default function OwnersView() {
  const { t } = useLanguage()
  const [owners, setOwners] = useKV<Owner[]>('owners', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [ownerToDelete, setOwnerToDelete] = useState<Owner | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    document: '',
    documentType: '',
    nationality: '',
    maritalStatus: '',
    profession: '',
    address: '',
    notes: ''
  })

  const getOwnerProperties = (ownerId: string) => {
    return (properties || []).filter(p => p.ownerIds?.includes(ownerId))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingOwner) {
      setOwners((current) => 
        (current || []).map(o => o.id === editingOwner.id 
          ? { ...formData, id: o.id, createdAt: o.createdAt }
          : o
        )
      )
      toast.success(t.language === 'pt' ? 'Proprietário atualizado com sucesso!' : 'Owner updated successfully!')
    } else {
      const newOwner: Owner = {
        ...formData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      }
      setOwners((current) => [...(current || []), newOwner])
      toast.success(t.language === 'pt' ? 'Proprietário criado com sucesso!' : 'Owner created successfully!')
    }
    
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      document: '',
      documentType: '',
      nationality: '',
      maritalStatus: '',
      profession: '',
      address: '',
      notes: ''
    })
    setEditingOwner(null)
    setIsDialogOpen(false)
  }

  const handleEdit = (owner: Owner) => {
    setEditingOwner(owner)
    setFormData({
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
      document: owner.document,
      documentType: owner.documentType || '',
      nationality: owner.nationality || '',
      maritalStatus: owner.maritalStatus || '',
      profession: owner.profession || '',
      address: owner.address || '',
      notes: owner.notes || ''
    })
    setIsDialogOpen(true)
  }

  const handleDeleteClick = (owner: Owner) => {
    setOwnerToDelete(owner)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (ownerToDelete) {
      setOwners((current) => (current || []).filter(o => o.id !== ownerToDelete.id))
      toast.success(t.language === 'pt' ? 'Proprietário excluído com sucesso!' : 'Owner deleted successfully!')
      setOwnerToDelete(null)
      setDeleteDialogOpen(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {t.language === 'pt' ? 'Proprietários' : 'Owners'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t.language === 'pt' ? 'Gerencie os proprietários das propriedades' : 'Manage property owners'}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus weight="bold" size={16} />
              {t.language === 'pt' ? 'Novo Proprietário' : 'New Owner'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingOwner 
                  ? (t.language === 'pt' ? 'Editar Proprietário' : 'Edit Owner')
                  : (t.language === 'pt' ? 'Novo Proprietário' : 'New Owner')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">{t.language === 'pt' ? 'Nome Completo' : 'Full Name'}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.language === 'pt' ? 'Digite o nome completo' : 'Enter full name'}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t.language === 'pt' ? 'E-mail' : 'Email'}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={t.language === 'pt' ? 'Digite o e-mail' : 'Enter email'}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t.language === 'pt' ? 'Telefone' : 'Phone'}</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder={t.language === 'pt' ? 'Digite o telefone' : 'Enter phone'}
                    required
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="document">{t.language === 'pt' ? 'CPF/CNPJ' : 'Document ID'}</Label>
                  <Input
                    id="document"
                    value={formData.document}
                    onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                    placeholder={t.language === 'pt' ? 'Digite o CPF ou CNPJ' : 'Enter document ID'}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="documentType">{t.language === 'pt' ? 'Tipo de Documento' : 'Document Type'}</Label>
                  <Input
                    id="documentType"
                    value={formData.documentType}
                    onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                    placeholder={t.language === 'pt' ? 'Ex.: CPF, CNPJ, Passaporte' : 'E.g. ID, Tax ID, Passport'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">{t.language === 'pt' ? 'Nacionalidade' : 'Nationality'}</Label>
                  <Input
                    id="nationality"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    placeholder={t.language === 'pt' ? 'Ex.: Brasileira' : 'E.g. Brazilian'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maritalStatus">{t.language === 'pt' ? 'Estado Civil' : 'Marital Status'}</Label>
                  <Input
                    id="maritalStatus"
                    value={formData.maritalStatus}
                    onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })}
                    placeholder={t.language === 'pt' ? 'Ex.: Solteiro(a)' : 'E.g. Single'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profession">{t.language === 'pt' ? 'Profissão' : 'Profession'}</Label>
                  <Input
                    id="profession"
                    value={formData.profession}
                    onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                    placeholder={t.language === 'pt' ? 'Ex.: Engenheiro(a)' : 'E.g. Engineer'}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="address">{t.language === 'pt' ? 'Endereço' : 'Address'}</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder={t.language === 'pt' ? 'Digite o endereço completo' : 'Enter full address'}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="notes">{t.language === 'pt' ? 'Observações' : 'Notes'}</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t.language === 'pt' ? 'Observações adicionais' : 'Additional notes'}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t.language === 'pt' ? 'Cancelar' : 'Cancel'}
                </Button>
                <Button type="submit">
                  {t.language === 'pt' ? 'Salvar' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!owners || owners.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <User weight="duotone" size={64} className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {t.language === 'pt' ? 'Nenhum proprietário cadastrado' : 'No owners registered'}
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus weight="bold" size={16} />
              {t.language === 'pt' ? 'Adicionar Proprietário' : 'Add Owner'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {owners.map((owner) => {
            const ownerProperties = getOwnerProperties(owner.id)
            return (
              <Card key={owner.id} className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <User weight="duotone" size={24} className="text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{owner.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <House size={12} />
                          {ownerProperties.length} {t.language === 'pt' ? 'propriedade(s)' : 'property(ies)'}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <EnvelopeSimple size={16} />
                      <span className="truncate">{owner.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone size={16} />
                      <span>{owner.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IdentificationCard size={16} />
                      <span>{owner.documentType ? `${owner.documentType}: ` : ''}{owner.document}</span>
                    </div>
                  </div>
                  {ownerProperties.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {t.language === 'pt' ? 'Propriedades:' : 'Properties:'}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {ownerProperties.slice(0, 3).map(prop => (
                          <Badge key={prop.id} variant="outline" className="text-xs">
                            {prop.name}
                          </Badge>
                        ))}
                        {ownerProperties.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{ownerProperties.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 gap-2" 
                      onClick={() => handleEdit(owner)}
                    >
                      <Pencil size={14} />
                      {t.language === 'pt' ? 'Editar' : 'Edit'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 text-destructive hover:text-destructive" 
                      onClick={() => handleDeleteClick(owner)}
                    >
                      <Trash size={14} />
                      {t.language === 'pt' ? 'Excluir' : 'Delete'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.language === 'pt' ? 'Confirmar exclusão' : 'Confirm deletion'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.language === 'pt' 
                ? 'Tem certeza que deseja excluir este proprietário? Esta ação não pode ser desfeita.'
                : 'Are you sure you want to delete this owner? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t.language === 'pt' ? 'Cancelar' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.language === 'pt' ? 'Excluir' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
