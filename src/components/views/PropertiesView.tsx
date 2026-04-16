import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Property, PropertyType, PropertyStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, House, Bed, Buildings, Wrench, Check, Pencil, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'

export default function PropertiesView() {
  const [properties, setProperties] = useKV<Property[]>('properties', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'apartment' as PropertyType,
    capacity: 1,
    pricePerNight: 0,
    pricePerMonth: 0,
    status: 'available' as PropertyStatus,
    description: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingProperty) {
      setProperties((current) => 
        (current || []).map(p => p.id === editingProperty.id 
          ? { ...formData, id: p.id, createdAt: p.createdAt }
          : p
        )
      )
      toast.success('Property updated successfully')
    } else {
      const newProperty: Property = {
        ...formData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      }
      setProperties((current) => [...(current || []), newProperty])
      toast.success('Property added successfully')
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
      status: 'available',
      description: ''
    })
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
      status: property.status,
      description: property.description
    })
    setIsDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    setProperties((current) => (current || []).filter(p => p.id !== id))
    toast.success('Property deleted')
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Properties</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your rental properties</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus weight="bold" size={16} />
              Add Property
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProperty ? 'Edit Property' : 'Add New Property'}</DialogTitle>
              <DialogDescription>
                {editingProperty ? 'Update property details' : 'Add a new rental property to your portfolio'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Property Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Beach Apartment 101"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as PropertyType })}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="room">Room</SelectItem>
                      <SelectItem value="apartment">Apartment</SelectItem>
                      <SelectItem value="house">House</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricePerNight">Price/Night ($)</Label>
                  <Input
                    id="pricePerNight"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.pricePerNight}
                    onChange={(e) => setFormData({ ...formData, pricePerNight: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricePerMonth">Price/Month ($)</Label>
                  <Input
                    id="pricePerMonth"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.pricePerMonth}
                    onChange={(e) => setFormData({ ...formData, pricePerMonth: parseFloat(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as PropertyStatus })}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Property description..."
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingProperty ? 'Update' : 'Add'} Property
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!properties || properties.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <House weight="duotone" size={64} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No properties yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your first rental property to get started</p>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus weight="bold" size={16} />
              Add Property
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((property) => (
            <Card key={property.id} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-primary">
                      {getPropertyIcon(property.type)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{property.name}</CardTitle>
                      <CardDescription className="capitalize">{property.type}</CardDescription>
                    </div>
                  </div>
                  <Badge className={getStatusColor(property.status)}>
                    {property.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">{property.description || 'No description'}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Capacity:</span>
                  <span className="font-medium">{property.capacity} guests</span>
                </div>
                <div className="space-y-1 pt-2 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Per Night:</span>
                    <span className="font-semibold text-primary">${property.pricePerNight}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Per Month:</span>
                    <span className="font-semibold text-primary">${property.pricePerMonth}</span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => handleEdit(property)}>
                    <Pencil size={14} />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => handleDelete(property.id)}>
                    <Trash size={14} />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
