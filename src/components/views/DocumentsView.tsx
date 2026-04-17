import { useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Document, DocumentCategory, Property } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, FileText, Trash, ArrowsClockwise } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useLanguage } from '@/lib/LanguageContext'

export default function DocumentsView() {
  const { t } = useLanguage()
  const [documents, setDocuments] = useKV<Document[]>('documents', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'contract' as DocumentCategory,
    notes: '',
    propertyId: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const newDocument: Document = {
      ...formData,
      id: Date.now().toString(),
      uploadDate: new Date().toISOString()
    }
    setDocuments((current) => [...(current || []), newDocument])
    toast.success('Document added successfully')
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'contract',
      notes: '',
      propertyId: ''
    })
    setIsDialogOpen(false)
  }

  const handleDelete = (id: string) => {
    setDocuments((current) => (current || []).filter(d => d.id !== id))
    toast.success('Document deleted')
  }

  const getCategoryColor = (category: DocumentCategory) => {
    switch (category) {
      case 'contract': return 'bg-primary/10 text-primary-foreground border-primary/20'
      case 'receipt': return 'bg-success/10 text-success-foreground border-success/20'
      case 'insurance': return 'bg-accent/10 text-accent-foreground border-accent/20'
      case 'tax': return 'bg-destructive/10 text-destructive-foreground border-destructive/20'
      case 'other': return 'bg-muted text-muted-foreground border-border'
    }
  }

  const groupedDocuments = (documents || []).reduce((acc, doc) => {
    if (!acc[doc.category]) {
      acc[doc.category] = []
    }
    acc[doc.category].push(doc)
    return acc
  }, {} as Record<DocumentCategory, Document[]>)

  const handleRefresh = () => {
    setDocuments((current) => [...(current || [])])
    toast.success(t.common.refreshed_success)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Documents</h2>
          <p className="text-sm text-muted-foreground mt-1">Organize your rental documentation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {t.common.refresh}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus weight="bold" size={16} />
                Add Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Document</DialogTitle>
              <DialogDescription>Add a new document to your repository</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Document Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Lease Agreement 2024"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value as DocumentCategory })}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="receipt">Receipt</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                      <SelectItem value="tax">Tax</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="propertyId">Property (Optional)</Label>
                  <Select value={formData.propertyId} onValueChange={(value) => setFormData({ ...formData, propertyId: value })}>
                    <SelectTrigger id="propertyId">
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {(properties || []).map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional information about this document..."
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit">Add Document</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {!documents || documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText weight="duotone" size={64} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your first document to organize your records</p>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus weight="bold" size={16} />
              Add Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(Object.entries(groupedDocuments) as [DocumentCategory, Document[]][]).map(([category, docs]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold mb-3 capitalize flex items-center gap-2">
                <Badge variant="outline" className={getCategoryColor(category)}>
                  {category}
                </Badge>
                <span className="text-muted-foreground text-sm">({docs.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {docs.map((doc) => {
                  const property = (properties || []).find(p => p.id === doc.propertyId)
                  return (
                    <Card key={doc.id} className="hover:shadow-md transition-shadow duration-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <FileText weight="duotone" size={20} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm truncate">{doc.name}</h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(doc.uploadDate), 'MMM dd, yyyy')}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8 w-8 p-0" onClick={() => handleDelete(doc.id)}>
                            <Trash size={14} />
                          </Button>
                        </div>
                        {property && (
                          <Badge variant="outline" className="text-xs mb-2">
                            {property.name}
                          </Badge>
                        )}
                        {doc.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                            {doc.notes}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
