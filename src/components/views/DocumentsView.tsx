import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import type { Contract, Document, DocumentCategory, DocumentRelationType, Guest, Owner, Property } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ArrowsClockwise, DownloadSimple, FileText, Plus, Trash, UploadSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useLanguage } from '@/lib/LanguageContext'
import { getContractSelectionLabel } from '@/lib/contractLabels'

const DOCUMENTS_BUCKET = 'documents'

type DocumentFormState = {
  name: string
  category: DocumentCategory
  notes: string
  relationType: DocumentRelationType
  relationId: string
}

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
}

function formatFileSize(size?: number) {
  if (!size) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export default function DocumentsView() {
  const { language, t } = useLanguage()
  const { currentTenantId } = useAuth()
  const [documents, setDocuments] = useKV<Document[]>('documents', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [owners] = useKV<Owner[]>('owners', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [relationFilter, setRelationFilter] = useState<DocumentRelationType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const labels = useMemo(() => ({
    title: language === 'pt' ? 'Documentos' : 'Documents',
    subtitle: language === 'pt'
      ? 'Faça upload, baixe e organize documentos por propriedade, contrato, hóspede, proprietário ou geral.'
      : 'Upload, download and organize documents by property, contract, guest, owner or general.',
    add: language === 'pt' ? 'Novo documento' : 'New document',
    upload: language === 'pt' ? 'Enviar documento' : 'Upload document',
    uploading: language === 'pt' ? 'Enviando...' : 'Uploading...',
    file: language === 'pt' ? 'Arquivo' : 'File',
    name: language === 'pt' ? 'Nome do documento' : 'Document name',
    category: language === 'pt' ? 'Categoria' : 'Category',
    relation: language === 'pt' ? 'Vincular a' : 'Relate to',
    entity: language === 'pt' ? 'Registro vinculado' : 'Linked record',
    notes: language === 'pt' ? 'Observações' : 'Notes',
    noDocuments: language === 'pt' ? 'Nenhum documento cadastrado' : 'No documents yet',
    noDocumentsHelp: language === 'pt' ? 'Envie seu primeiro arquivo para organizar o repositório.' : 'Upload your first file to organize the repository.',
    download: language === 'pt' ? 'Baixar' : 'Download',
    delete: language === 'pt' ? 'Excluir' : 'Delete',
    cancel: language === 'pt' ? 'Cancelar' : 'Cancel',
    refresh: language === 'pt' ? 'Atualizar' : 'Refresh',
    search: language === 'pt' ? 'Buscar documentos...' : 'Search documents...',
    allRelations: language === 'pt' ? 'Todos os vínculos' : 'All relations',
    selectEntity: language === 'pt' ? 'Selecione o registro' : 'Select record',
    uploadSuccess: language === 'pt' ? 'Documento enviado com sucesso' : 'Document uploaded successfully',
    uploadError: language === 'pt' ? 'Falha ao enviar documento' : 'Failed to upload document',
    downloadError: language === 'pt' ? 'Falha ao baixar documento' : 'Failed to download document',
    deleteSuccess: language === 'pt' ? 'Documento excluído com sucesso' : 'Document deleted successfully',
    fileRequired: language === 'pt' ? 'Selecione um arquivo.' : 'Select a file.',
    relationRequired: language === 'pt' ? 'Selecione o registro vinculado.' : 'Select the linked record.',
    tenantRequired: language === 'pt' ? 'Tenant não carregado. Entre novamente.' : 'Tenant not loaded. Sign in again.',
  }), [language])

  const relationLabels: Record<DocumentRelationType, string> = {
    general: language === 'pt' ? 'Geral' : 'General',
    property: language === 'pt' ? 'Propriedade' : 'Property',
    contract: language === 'pt' ? 'Contrato' : 'Contract',
    guest: language === 'pt' ? 'Hóspede/Inquilino' : 'Guest/Tenant',
    owner: language === 'pt' ? 'Proprietário' : 'Owner',
  }

  const categoryLabels: Record<DocumentCategory, string> = {
    contract: language === 'pt' ? 'Contrato' : 'Contract',
    receipt: language === 'pt' ? 'Recibo' : 'Receipt',
    insurance: language === 'pt' ? 'Seguro' : 'Insurance',
    tax: language === 'pt' ? 'Imposto' : 'Tax',
    other: language === 'pt' ? 'Outro' : 'Other',
  }

  const [formData, setFormData] = useState<DocumentFormState>({
    name: '',
    category: 'other',
    notes: '',
    relationType: 'general',
    relationId: '',
  })

  const relationOptions = useMemo(() => {
    switch (formData.relationType) {
      case 'property':
        return (properties || []).map((property) => ({ id: property.id, label: property.name }))
      case 'contract':
        return (contracts || []).map((contract) => ({
          id: contract.id,
          label: getContractSelectionLabel(contract, properties || []),
        }))
      case 'guest':
        return (guests || []).map((guest) => ({ id: guest.id, label: guest.name }))
      case 'owner':
        return (owners || []).map((owner) => ({ id: owner.id, label: owner.name }))
      case 'general':
        return []
    }
  }, [contracts, formData.relationType, guests, owners, properties])

  const getRelationLabel = (document: Document) => {
    const relationType = document.relationType || (document.propertyId ? 'property' : 'general')
    const relationId = document.relationId || document.propertyId
    if (relationType === 'general' || !relationId) return relationLabels.general

    const source = relationType === 'property'
      ? (properties || []).map((property) => ({ id: property.id, label: property.name }))
      : relationType === 'contract'
      ? (contracts || []).map((contract) => ({
          id: contract.id,
          label: getContractSelectionLabel(contract, properties || []),
        }))
      : relationType === 'guest'
      ? (guests || []).map((guest) => ({ id: guest.id, label: guest.name }))
      : (owners || []).map((owner) => ({ id: owner.id, label: owner.name }))

    const entity = source.find((item) => item.id === relationId)
    return entity ? `${relationLabels[relationType]}: ${entity.label}` : relationLabels[relationType]
  }

  const filteredDocuments = (documents || []).filter((document) => {
    const relationType = document.relationType || (document.propertyId ? 'property' : 'general')
    const matchesRelation = relationFilter === 'all' || relationType === relationFilter
    const query = searchQuery.trim().toLowerCase()
    const matchesQuery = !query || [
      document.name,
      document.fileName || '',
      document.notes || '',
      getRelationLabel(document),
      categoryLabels[document.category],
    ].some((value) => value.toLowerCase().includes(query))
    return matchesRelation && matchesQuery
  })

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'other',
      notes: '',
      relationType: 'general',
      relationId: '',
    })
    setSelectedFile(null)
    setIsUploading(false)
    setIsDialogOpen(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentTenantId) {
      toast.error(labels.tenantRequired)
      return
    }
    if (!selectedFile) {
      toast.error(labels.fileRequired)
      return
    }
    if (formData.relationType !== 'general' && !formData.relationId) {
      toast.error(labels.relationRequired)
      return
    }

    setIsUploading(true)
    const id = createId()
    const safeFileName = sanitizeFileName(selectedFile.name)
    const filePath = `${currentTenantId}/${id}/${safeFileName}`

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, selectedFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: selectedFile.type || undefined,
      })

    if (uploadError) {
      setIsUploading(false)
      toast.error(uploadError.message || labels.uploadError)
      return
    }

    const newDocument: Document = {
      id,
      name: formData.name.trim() || selectedFile.name,
      category: formData.category,
      notes: formData.notes.trim() || undefined,
      relationType: formData.relationType,
      relationId: formData.relationType === 'general' ? undefined : formData.relationId,
      propertyId: formData.relationType === 'property' ? formData.relationId : undefined,
      fileName: selectedFile.name,
      filePath,
      fileSize: selectedFile.size,
      mimeType: selectedFile.type || undefined,
      uploadDate: new Date().toISOString(),
    }

    setDocuments((current) => [...(current || []), newDocument])
    toast.success(labels.uploadSuccess)
    resetForm()
  }

  const handleDownload = async (document: Document) => {
    if (!document.filePath) {
      toast.error(labels.downloadError)
      return
    }

    setDownloadingId(document.id)
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .download(document.filePath)

    setDownloadingId(null)

    if (error || !data) {
      toast.error(error?.message || labels.downloadError)
      return
    }

    const url = URL.createObjectURL(data)
    const link = window.document.createElement('a')
    link.href = url
    link.download = document.fileName || document.name
    window.document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleDelete = async (document: Document) => {
    if (document.filePath) {
      const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([document.filePath])
      if (error) {
        toast.error(error.message)
        return
      }
    }
    setDocuments((current) => (current || []).filter((item) => item.id !== document.id))
    toast.success(labels.deleteSuccess)
  }

  const handleRefresh = () => {
    setDocuments((current) => [...(current || [])])
    toast.success(t.common.refreshed_success)
  }

  const getCategoryColor = (category: DocumentCategory) => {
    switch (category) {
      case 'contract': return 'bg-primary/10 text-primary border-primary/20'
      case 'receipt': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'insurance': return 'bg-sky-100 text-sky-800 border-sky-200'
      case 'tax': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'other': return 'bg-muted text-muted-foreground border-border'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{labels.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{labels.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {labels.refresh}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => open ? setIsDialogOpen(true) : resetForm()}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus weight="bold" size={16} />
                {labels.add}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{labels.upload}</DialogTitle>
                <DialogDescription>{labels.subtitle}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="document-file">{labels.file}</Label>
                  <Input
                    id="document-file"
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      setSelectedFile(file)
                      if (file && !formData.name) {
                        setFormData((current) => ({ ...current, name: file.name.replace(/\.[^/.]+$/, '') }))
                      }
                    }}
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="document-name">{labels.name}</Label>
                    <Input
                      id="document-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={language === 'pt' ? 'Ex.: Contrato assinado' : 'E.g.: Signed agreement'}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="document-category">{labels.category}</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value as DocumentCategory })}>
                      <SelectTrigger id="document-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="document-relation-type">{labels.relation}</Label>
                    <Select
                      value={formData.relationType}
                      onValueChange={(value) => setFormData({
                        ...formData,
                        relationType: value as DocumentRelationType,
                        relationId: '',
                      })}
                    >
                      <SelectTrigger id="document-relation-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(relationLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="document-relation-id">{labels.entity}</Label>
                    <Select
                      value={formData.relationId || 'none'}
                      disabled={formData.relationType === 'general'}
                      onValueChange={(value) => setFormData({ ...formData, relationId: value === 'none' ? '' : value })}
                    >
                      <SelectTrigger id="document-relation-id">
                        <SelectValue placeholder={labels.selectEntity} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{labels.selectEntity}</SelectItem>
                        {relationOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="document-notes">{labels.notes}</Label>
                  <Textarea
                    id="document-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    {labels.cancel}
                  </Button>
                  <Button type="submit" disabled={isUploading}>
                    <UploadSimple size={16} />
                    {isUploading ? labels.uploading : labels.upload}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={labels.search} />
        <Select value={relationFilter} onValueChange={(value) => setRelationFilter(value as DocumentRelationType | 'all')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{labels.allRelations}</SelectItem>
            {Object.entries(relationLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredDocuments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText weight="duotone" size={64} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{labels.noDocuments}</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">{labels.noDocumentsHelp}</p>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus weight="bold" size={16} />
              {labels.add}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDocuments.map((document) => (
            <Card key={document.id} className="hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText weight="duotone" size={22} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate">{document.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{document.fileName || '-'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={getCategoryColor(document.category)}>
                    {categoryLabels[document.category]}
                  </Badge>
                  <Badge variant="outline">{getRelationLabel(document)}</Badge>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>{format(new Date(document.uploadDate), 'dd/MM/yyyy')}</p>
                  <p>{formatFileSize(document.fileSize)} {document.mimeType ? `- ${document.mimeType}` : ''}</p>
                </div>

                {document.notes && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{document.notes}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    disabled={!document.filePath || downloadingId === document.id}
                    onClick={() => handleDownload(document)}
                  >
                    <DownloadSimple size={16} />
                    {labels.download}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(document)}
                  >
                    <Trash size={16} />
                    {labels.delete}
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
