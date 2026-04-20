import { useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Property, PropertyType, PropertyStatus, Contract, Owner } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { DecimalInput } from '@/components/ui/decimal-input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, House, Bed, Buildings, Pencil, Trash, FileText, ArrowsClockwise, Compass, SquaresFour } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/LanguageContext'
import { useCurrency } from '@/lib/CurrencyContext'
import ContractDialogForm from '@/components/ContractDialogForm'
import PropertyMapView from '@/components/PropertyMapView'

export default function PropertiesView() {
  const { t, language } = useLanguage()
  const { formatCurrency } = useCurrency()
  const [properties, setProperties] = useKV<Property[]>('properties', [])
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [owners] = useKV<Owner[]>('owners', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null)
  const [contractDialogOpen, setContractDialogOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [focusPropertyId, setFocusPropertyId] = useState<string | null>(null)
  const [selectedPropertyForContract, setSelectedPropertyForContract] = useState<string | undefined>(undefined)
  const [environmentInput, setEnvironmentInput] = useState('')
  const [editingEnvironmentIndex, setEditingEnvironmentIndex] = useState<number | null>(null)
  const [furnitureInput, setFurnitureInput] = useState('')
  const [editingFurnitureIndex, setEditingFurnitureIndex] = useState<number | null>(null)
  const [inspectionItemInput, setInspectionItemInput] = useState('')
  const [editingInspectionItemIndex, setEditingInspectionItemIndex] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'apartment' as PropertyType,
    capacity: 1,
    pricePerNight: 0,
    pricePerMonth: 0,
    address: '',
    city: '',
    conservationState: '',
    environments: [] as string[],
    furnitureItems: [] as string[],
    inspectionItems: [] as string[],
    description: '',
    ownerIds: [] as string[]
  })

  const supportsEnvironments = formData.type === 'house' || formData.type === 'apartment'

  const getDefaultEnvironments = (propertyType: PropertyType) => {
    if (propertyType === 'house') {
      return language === 'pt'
        ? ['Sala', 'Cozinha', 'Quarto principal', 'Quarto 2', 'Banheiro social', 'Área de serviço', 'Garagem', 'Área externa']
        : ['Living room', 'Kitchen', 'Primary bedroom', 'Bedroom 2', 'Main bathroom', 'Laundry area', 'Garage', 'Outdoor area']
    }

    if (propertyType === 'apartment') {
      return language === 'pt'
        ? ['Sala', 'Cozinha', 'Quarto principal', 'Quarto 2', 'Banheiro', 'Lavanderia', 'Varanda']
        : ['Living room', 'Kitchen', 'Primary bedroom', 'Bedroom 2', 'Bathroom', 'Laundry area', 'Balcony']
    }

    return []
  }

  const getPropertyStatus = (propertyId: string): PropertyStatus => {
    const activeContracts = (contracts || []).filter(contract => 
      contract.status === 'active' && 
      contract.propertyIds.includes(propertyId)
    )
    
    return activeContracts.length > 0 ? 'occupied' : 'available'
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingProperty) {
      const normalizedFormData = {
        ...formData,
        environments: supportsEnvironments ? formData.environments : [],
      }
      setProperties((current) => 
        (current || []).map(p => p.id === editingProperty.id 
          ? { ...normalizedFormData, id: p.id, createdAt: p.createdAt, status: getPropertyStatus(p.id), ownerIds: normalizedFormData.ownerIds }
          : p
        )
      )
      toast.success(t.properties_view.form.updated_success)
    } else {
      const newProperty: Property = {
        ...formData,
        environments: supportsEnvironments ? formData.environments : [],
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        status: 'available',
        ownerIds: formData.ownerIds
      }
      setProperties((current) => [...(current || []), newProperty])
      toast.success(t.properties_view.form.created_success)
    }
    
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'apartment',
      capacity: 1,
      pricePerNight: 0,
      pricePerMonth: 0,
      address: '',
      city: '',
      conservationState: '',
      environments: [],
      furnitureItems: [],
      inspectionItems: [],
      description: '',
      ownerIds: []
    })
    setEnvironmentInput('')
    setEditingEnvironmentIndex(null)
    setFurnitureInput('')
    setEditingFurnitureIndex(null)
    setInspectionItemInput('')
    setEditingInspectionItemIndex(null)
    setEditingProperty(null)
    setIsDialogOpen(false)
  }

  const handleEdit = (property: Property) => {
    setEditingProperty(property)
    setFormData({
      name: property.name,
      type: property.type,
      capacity: property.capacity,
      pricePerNight: property.pricePerNight,
      pricePerMonth: property.pricePerMonth,
      address: property.address || '',
      city: property.city || '',
      conservationState: property.conservationState || '',
      environments: property.environments || [],
      furnitureItems: property.furnitureItems || [],
      inspectionItems: property.inspectionItems || [],
      description: property.description,
      ownerIds: property.ownerIds || []
    })
    setEnvironmentInput('')
    setEditingEnvironmentIndex(null)
    setFurnitureInput('')
    setEditingFurnitureIndex(null)
    setInspectionItemInput('')
    setEditingInspectionItemIndex(null)
    setIsDialogOpen(true)
  }

  const handleAddOrUpdateFurniture = () => {
    const normalized = furnitureInput.trim()
    if (!normalized) return

    if (editingFurnitureIndex === null) {
      setFormData((current) => ({
        ...current,
        furnitureItems: [...current.furnitureItems, normalized],
      }))
    } else {
      setFormData((current) => ({
        ...current,
        furnitureItems: current.furnitureItems.map((item, index) =>
          index === editingFurnitureIndex ? normalized : item
        ),
      }))
    }

    setFurnitureInput('')
    setEditingFurnitureIndex(null)
  }

  const handleEditFurniture = (index: number) => {
    setFurnitureInput(formData.furnitureItems[index] || '')
    setEditingFurnitureIndex(index)
  }

  const handleRemoveFurniture = (index: number) => {
    setFormData((current) => ({
      ...current,
      furnitureItems: current.furnitureItems.filter((_item, itemIndex) => itemIndex !== index),
    }))

    if (editingFurnitureIndex === index) {
      setFurnitureInput('')
      setEditingFurnitureIndex(null)
    }
  }

  const handleAddOrUpdateEnvironment = () => {
    const normalized = environmentInput.trim()
    if (!normalized) return

    if (editingEnvironmentIndex === null) {
      setFormData((current) => ({
        ...current,
        environments: [...current.environments, normalized],
      }))
    } else {
      setFormData((current) => ({
        ...current,
        environments: current.environments.map((item, index) =>
          index === editingEnvironmentIndex ? normalized : item
        ),
      }))
    }

    setEnvironmentInput('')
    setEditingEnvironmentIndex(null)
  }

  const handleEditEnvironment = (index: number) => {
    setEnvironmentInput(formData.environments[index] || '')
    setEditingEnvironmentIndex(index)
  }

  const handleRemoveEnvironment = (index: number) => {
    setFormData((current) => ({
      ...current,
      environments: current.environments.filter((_item, itemIndex) => itemIndex !== index),
    }))

    if (editingEnvironmentIndex === index) {
      setEnvironmentInput('')
      setEditingEnvironmentIndex(null)
    }
  }

  const handleLoadDefaultEnvironments = () => {
    if (!supportsEnvironments) return
    setFormData((current) => ({
      ...current,
      environments: getDefaultEnvironments(current.type),
    }))
    setEnvironmentInput('')
    setEditingEnvironmentIndex(null)
  }

  const handleAddOrUpdateInspectionItem = () => {
    const normalized = inspectionItemInput.trim()
    if (!normalized) return

    if (editingInspectionItemIndex === null) {
      setFormData((current) => ({
        ...current,
        inspectionItems: [...current.inspectionItems, normalized],
      }))
    } else {
      setFormData((current) => ({
        ...current,
        inspectionItems: current.inspectionItems.map((item, index) =>
          index === editingInspectionItemIndex ? normalized : item
        ),
      }))
    }

    setInspectionItemInput('')
    setEditingInspectionItemIndex(null)
  }

  const handleEditInspectionItem = (index: number) => {
    setInspectionItemInput(formData.inspectionItems[index] || '')
    setEditingInspectionItemIndex(index)
  }

  const handleRemoveInspectionItem = (index: number) => {
    setFormData((current) => ({
      ...current,
      inspectionItems: current.inspectionItems.filter((_item, itemIndex) => itemIndex !== index),
    }))

    if (editingInspectionItemIndex === index) {
      setInspectionItemInput('')
      setEditingInspectionItemIndex(null)
    }
  }

  const handleOwnerToggle = (ownerId: string) => {
    setFormData(prev => ({
      ...prev,
      ownerIds: prev.ownerIds.includes(ownerId)
        ? prev.ownerIds.filter(id => id !== ownerId)
        : [...prev.ownerIds, ownerId]
    }))
  }

  const handleDeleteClick = (property: Property) => {
    setPropertyToDelete(property)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (propertyToDelete) {
      setProperties((current) => (current || []).filter(p => p.id !== propertyToDelete.id))
      toast.success(t.properties_view.deleted_success)
      setPropertyToDelete(null)
      setDeleteDialogOpen(false)
    }
  }

  const handleGenerateContract = (propertyId: string) => {
    if (getPropertyStatus(propertyId) !== 'available') {
      toast.error(language === 'pt'
        ? 'Só é possível criar contrato para propriedades disponíveis.'
        : 'Contracts can only be created for available properties.'
      )
      return
    }

    setSelectedPropertyForContract(propertyId)
    setContractDialogOpen(true)
  }

  const buildDuplicatePropertyName = (baseName: string, existingNames: string[]) => {
    const copyLabel = t.language === 'pt' ? 'Cópia' : 'Copy'
    let candidate = `${baseName} (${copyLabel})`
    let index = 2

    while (existingNames.includes(candidate)) {
      candidate = `${baseName} (${copyLabel} ${index})`
      index += 1
    }

    return candidate
  }

  const handleDuplicateProperty = (property: Property) => {
    setProperties((current) => {
      const currentList = current || []
      const existingNames = currentList.map((item) => item.name)
      const duplicatedProperty: Property = {
        ...property,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        status: 'available',
        name: buildDuplicatePropertyName(property.name, existingNames),
        environments: [...(property.environments || [])],
        furnitureItems: [...(property.furnitureItems || [])],
        inspectionItems: [...(property.inspectionItems || [])],
        ownerIds: [...(property.ownerIds || [])],
      }

      return [...currentList, duplicatedProperty]
    })

    toast.success(t.language === 'pt' ? 'Imóvel duplicado com sucesso' : 'Property duplicated successfully')
  }

  const getStatusColor = (status: PropertyStatus) => {
    switch (status) {
      case 'available': return 'bg-success/10 text-success-foreground'
      case 'occupied': return 'bg-accent/10 text-accent-foreground'
      case 'maintenance': return 'bg-muted text-muted-foreground'
    }
  }

  const getPropertyIcon = (type: PropertyType) => {
    switch (type) {
      case 'room': return <Bed weight="duotone" size={24} />
      case 'apartment': return <Buildings weight="duotone" size={24} />
      case 'house': return <House weight="duotone" size={24} />
    }
  }

  const handleRefresh = () => {
    setProperties((current) => [...(current || [])])
    toast.success(t.common.refreshed_success)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t.properties_view.title}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {t.common.refresh}
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
            title={language === 'pt' ? 'Lista' : 'List'}
          >
            <SquaresFour size={16} />
          </Button>
          <Button
            variant={viewMode === 'map' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('map')}
            title={language === 'pt' ? 'Mapa' : 'Map'}
          >
            <Compass size={16} />
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus weight="bold" size={16} />
                {t.properties_view.add_property}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
              <DialogTitle>{editingProperty ? t.properties_view.form.title_edit : t.properties_view.form.title_new}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t.properties_view.form.name}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.properties_view.form.name_placeholder}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">{t.properties_view.form.type}</Label>
                  <Select value={formData.type} onValueChange={(value) => {
                    const nextType = value as PropertyType
                    setFormData((current) => ({
                      ...current,
                      type: nextType,
                      environments: nextType === 'house' || nextType === 'apartment'
                        ? current.environments
                        : [],
                    }))
                    setEnvironmentInput('')
                    setEditingEnvironmentIndex(null)
                  }}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="room">{t.properties_view.type.room}</SelectItem>
                      <SelectItem value="apartment">{t.properties_view.type.apartment}</SelectItem>
                      <SelectItem value="house">{t.properties_view.type.house}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capacity">{t.properties_view.form.capacity}</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    placeholder={t.properties_view.form.capacity_placeholder}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricePerNight">{t.properties_view.form.price_night}</Label>
                  <DecimalInput
                    id="pricePerNight"
                    min="0"
                    value={formData.pricePerNight}
                    onValueChange={(value) => setFormData({ ...formData, pricePerNight: value })}
                    placeholder={t.properties_view.form.price_night_placeholder}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricePerMonth">{t.properties_view.form.price_month}</Label>
                  <DecimalInput
                    id="pricePerMonth"
                    min="0"
                    value={formData.pricePerMonth}
                    onValueChange={(value) => setFormData({ ...formData, pricePerMonth: value })}
                    placeholder={t.properties_view.form.price_month_placeholder}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{t.language === 'pt' ? 'Endereço' : 'Address'}</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder={t.language === 'pt' ? 'Digite o endereço do imóvel' : 'Enter property address'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="conservationState">{t.language === 'pt' ? 'Estado de conservação' : 'Conservation state'}</Label>
                <Input
                  id="conservationState"
                  value={formData.conservationState}
                  onChange={(e) => setFormData({ ...formData, conservationState: e.target.value })}
                  placeholder={t.language === 'pt' ? 'Ex.: Ótimo, Bom, Regular' : 'E.g.: Excellent, Good, Fair'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">{t.language === 'pt' ? 'Cidade' : 'City'}</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder={t.language === 'pt' ? 'Ex.: São Paulo' : 'E.g.: Sao Paulo'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t.properties_view.form.description}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t.properties_view.form.description_placeholder}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>{t.language === 'pt' ? 'Mobília' : 'Furniture'}</Label>
                <div className="flex gap-2">
                  <Input
                    value={furnitureInput}
                    onChange={(e) => setFurnitureInput(e.target.value)}
                    placeholder={t.language === 'pt' ? 'Ex.: Cama box queen' : 'E.g.: Queen bed'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddOrUpdateFurniture()
                      }
                    }}
                  />
                  <Button type="button" onClick={handleAddOrUpdateFurniture}>
                    {editingFurnitureIndex === null
                      ? (t.language === 'pt' ? 'Adicionar' : 'Add')
                      : (t.language === 'pt' ? 'Alterar' : 'Update')}
                  </Button>
                </div>
                {formData.furnitureItems.length > 0 ? (
                  <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                    {formData.furnitureItems.map((item, index) => (
                      <div key={`${item}-${index}`} className="flex items-center justify-between gap-2">
                        <span className="text-sm">{item}</span>
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleEditFurniture(index)}>
                            <Pencil size={14} />
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRemoveFurniture(index)}>
                            <Trash size={14} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t.language === 'pt' ? 'Nenhum item de mobília adicionado' : 'No furniture items added'}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t.language === 'pt' ? 'Itens para vistoria' : 'Inspection items'}</Label>
                <div className="flex gap-2">
                  <Input
                    value={inspectionItemInput}
                    onChange={(e) => setInspectionItemInput(e.target.value)}
                    placeholder={t.language === 'pt' ? 'Ex.: Interfone, Fechadura digital, Ar-condicionado' : 'E.g.: Intercom, Smart lock, Air conditioner'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddOrUpdateInspectionItem()
                      }
                    }}
                  />
                  <Button type="button" onClick={handleAddOrUpdateInspectionItem}>
                    {editingInspectionItemIndex === null
                      ? (t.language === 'pt' ? 'Adicionar' : 'Add')
                      : (t.language === 'pt' ? 'Alterar' : 'Update')}
                  </Button>
                </div>
                {formData.inspectionItems.length > 0 ? (
                  <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                    {formData.inspectionItems.map((item, index) => (
                      <div key={`${item}-${index}`} className="flex items-center justify-between gap-2">
                        <span className="text-sm">{item}</span>
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleEditInspectionItem(index)}>
                            <Pencil size={14} />
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRemoveInspectionItem(index)}>
                            <Trash size={14} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t.language === 'pt' ? 'Nenhum item de vistoria adicionado' : 'No inspection items added'}
                  </p>
                )}
              </div>

              {supportsEnvironments && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>{t.language === 'pt' ? 'Ambientes' : 'Environments'}</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleLoadDefaultEnvironments}>
                      {t.language === 'pt' ? 'Carregar base' : 'Load defaults'}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={environmentInput}
                      onChange={(e) => setEnvironmentInput(e.target.value)}
                      placeholder={t.language === 'pt' ? 'Ex.: Sala, Cozinha, Suíte, Lavanderia' : 'E.g.: Living room, Kitchen, Suite, Laundry'}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddOrUpdateEnvironment()
                        }
                      }}
                    />
                    <Button type="button" onClick={handleAddOrUpdateEnvironment}>
                      {editingEnvironmentIndex === null
                        ? (t.language === 'pt' ? 'Adicionar' : 'Add')
                        : (t.language === 'pt' ? 'Alterar' : 'Update')}
                    </Button>
                  </div>
                  {formData.environments.length > 0 ? (
                    <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                      {formData.environments.map((item, index) => (
                        <div key={`${item}-${index}`} className="flex items-center justify-between gap-2">
                          <span className="text-sm">{item}</span>
                          <div className="flex items-center gap-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleEditEnvironment(index)}>
                              <Pencil size={14} />
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRemoveEnvironment(index)}>
                              <Trash size={14} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t.language === 'pt' ? 'Nenhum ambiente cadastrado' : 'No environments added'}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>{t.language === 'pt' ? 'Proprietários' : 'Owners'}</Label>
                {(!owners || owners.length === 0) ? (
                  <p className="text-sm text-muted-foreground">
                    {t.language === 'pt' ? 'Nenhum proprietário cadastrado' : 'No owners registered'}
                  </p>
                ) : (
                  <div className="border rounded-lg p-4 space-y-3 max-h-48 overflow-y-auto">
                    {owners.map((owner) => (
                      <div key={owner.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`owner-${owner.id}`}
                          checked={formData.ownerIds.includes(owner.id)}
                          onCheckedChange={() => handleOwnerToggle(owner.id)}
                        />
                        <label
                          htmlFor={`owner-${owner.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {owner.name}
                          <span className="text-xs text-muted-foreground ml-2">({owner.email})</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t.properties_view.form.cancel}
                </Button>
                <Button type="submit">
                  {t.properties_view.form.save}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {viewMode === 'map' && properties && properties.length > 0 && (
        <PropertyMapView properties={properties} getPropertyStatus={getPropertyStatus} focusPropertyId={focusPropertyId} />
      )}

      {!properties || properties.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <House weight="duotone" size={64} className="text-muted-foreground mb-4" />
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus weight="bold" size={16} />
              {t.properties_view.add_property}
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((property) => {
            const currentStatus = getPropertyStatus(property.id)
            return (
            <Card key={property.id} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-primary">
                      {getPropertyIcon(property.type)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{property.name}</CardTitle>
                      <CardDescription>{t.properties_view.type[property.type]}</CardDescription>
                    </div>
                  </div>
                  <Badge className={getStatusColor(currentStatus)}>
                    {t.properties_view.status[currentStatus]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {property.address && (
                  <p className="text-sm text-muted-foreground">{property.address}</p>
                )}
                {property.city && (
                  <p className="text-sm text-muted-foreground">
                    {property.city}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t.properties_view.capacity}:</span>
                  <span className="font-medium">{property.capacity} {t.properties_view.people}</span>
                </div>
                <div className="space-y-1 pt-2 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t.properties_view.per_night}:</span>
                    <span className="font-semibold text-primary">{formatCurrency(property.pricePerNight)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t.properties_view.per_month}:</span>
                    <span className="font-semibold text-primary">{formatCurrency(property.pricePerMonth)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  {(property.address || property.city) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => { setFocusPropertyId(property.id); setViewMode('map') }}
                    >
                      <Compass size={14} />
                      {language === 'pt' ? 'Mostrar no mapa' : 'Show on map'}
                    </Button>
                  )}
                  {currentStatus === 'available' && (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => handleGenerateContract(property.id)}
                    >
                      <FileText size={14} />
                      {t.properties_view.generate_contract}
                    </Button>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => handleEdit(property)}>
                      <Pencil size={14} />
                      {t.properties_view.edit}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleDuplicateProperty(property)}
                    >
                      <Plus size={14} />
                      {t.language === 'pt' ? 'Duplicar' : 'Duplicate'}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(property)}>
                      <Trash size={14} />
                      {t.properties_view.delete}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      ) : null}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.properties_view.delete_confirm_title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.properties_view.delete_confirm_description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.properties_view.delete_confirm_cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t.properties_view.delete_confirm_delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ContractDialogForm
        open={contractDialogOpen}
        onOpenChange={setContractDialogOpen}
        preSelectedPropertyId={selectedPropertyForContract}
      />
    </div>
  )
}
