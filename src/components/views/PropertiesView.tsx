import { useEffect, useState } from 'react'
import type { ClipboardEvent, DragEvent } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { Property, PropertyPhoto, PropertyICalFeed, ICalProvider, PropertyType, PropertyStatus, Contract, Owner } from '@/types'
import helpContent from '@/docs/properties.md?raw'
import formHelpContent from '@/docs/form-property.md?raw'
import { HelpButton } from '@/components/HelpButton'
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
import { Plus, House, Bed, Buildings, Pencil, Trash, FileText, ArrowsClockwise, Compass, SquaresFour, UploadSimple, DownloadSimple, Image as ImageIcon, Star, Car, CalendarBlank, Copy, LinkSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/LanguageContext'
import { useCurrency } from '@/lib/CurrencyContext'
import { getPropertyAvailabilityStatus } from '@/lib/propertyAvailability'
import ContractDialogForm from '@/components/ContractDialogForm'
import PropertyMapView from '@/components/PropertyMapView'
import { PropertyAdDialog } from '@/components/PropertyAdDialog'

const PROPERTY_IMAGES_BUCKET = 'property-images'

type PropertyPhotoDraft = {
  id: string
  fileName: string
  filePath?: string
  fileSize?: number
  mimeType?: string
  isCover: boolean
  sortOrder: number
  createdAt: string
  previewUrl: string
  file?: File
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

export default function PropertiesView({ readOnly = false }: { readOnly?: boolean }) {
  const { t, language } = useLanguage()
  const { formatCurrency } = useCurrency()
  const { currentTenantId } = useAuth()
  const [properties, setProperties] = useKV<Property[]>('properties', [])
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [owners] = useKV<Owner[]>('owners', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<Property | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [csvParsedRows, setCsvParsedRows] = useState<Partial<Property>[]>([])
  const [csvError, setCsvError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null)
  const [contractDialogOpen, setContractDialogOpen] = useState(false)
  const [adDialogOpen, setAdDialogOpen] = useState(false)
  const [selectedPropertyForAd, setSelectedPropertyForAd] = useState<Property | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [focusPropertyId, setFocusPropertyId] = useState<string | null>(null)
  const [selectedPropertyForContract, setSelectedPropertyForContract] = useState<string | undefined>(undefined)
  const [environmentInput, setEnvironmentInput] = useState('')
  const [editingEnvironmentIndex, setEditingEnvironmentIndex] = useState<number | null>(null)
  const [furnitureInput, setFurnitureInput] = useState('')
  const [editingFurnitureIndex, setEditingFurnitureIndex] = useState<number | null>(null)
  const [inspectionItemInput, setInspectionItemInput] = useState('')
  const [editingInspectionItemIndex, setEditingInspectionItemIndex] = useState<number | null>(null)
  const [photoDrafts, setPhotoDrafts] = useState<PropertyPhotoDraft[]>([])
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false)
  const [isSavingPhotos, setIsSavingPhotos] = useState(false)
  const [coverPhotoUrls, setCoverPhotoUrls] = useState<Record<string, string>>({})
  
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
    ownerIds: [] as string[],
    photos: [] as PropertyPhoto[],
    icalFeeds: [] as PropertyICalFeed[],
  })
  const [icalFeedDraft, setICalFeedDraft] = useState({ provider: 'airbnb' as ICalProvider, label: '', url: '' })

  const supportsEnvironments = formData.type === 'house' || formData.type === 'apartment'

  useEffect(() => {
    void (async () => {
      const entries = await Promise.all((properties || []).map(async (property) => {
        const coverPhoto = (property.photos || []).find((photo) => photo.isCover) || property.photos?.[0]
        if (!coverPhoto?.filePath) return [property.id, ''] as const

        const { data } = await supabase.storage
          .from(PROPERTY_IMAGES_BUCKET)
          .createSignedUrl(coverPhoto.filePath, 60 * 10)

        return [property.id, data?.signedUrl || ''] as const
      }))

      setCoverPhotoUrls(Object.fromEntries(entries.filter((entry) => entry[1])))
    })()
  }, [properties])

  const getDefaultEnvironments = (propertyType: PropertyType) => {
    if (propertyType === 'house') return t.properties_view.form.default_environments_house
    if (propertyType === 'apartment') return t.properties_view.form.default_environments_apartment
    return []
  }

  const getPropertyStatus = (propertyId: string): PropertyStatus => {
    return getPropertyAvailabilityStatus(
      propertyId,
      (contracts || []).map((contract) => ({
        id: contract.id,
        status: contract.status,
        property_ids: contract.propertyIds,
      }))
    ) as PropertyStatus
  }

  const syncDraftsToFormData = (drafts: PropertyPhotoDraft[]) => {
    setFormData((current) => ({
      ...current,
      photos: drafts.map((photo, index) => ({
        id: photo.id,
        fileName: photo.fileName,
        filePath: photo.filePath || '',
        fileSize: photo.fileSize,
        mimeType: photo.mimeType,
        isCover: photo.isCover,
        sortOrder: index,
        createdAt: photo.createdAt,
      })),
    }))
  }

  const loadExistingPhotoDrafts = async (photos: PropertyPhoto[]) => {
    const drafts = await Promise.all((photos || []).map(async (photo, index) => {
      const { data } = await supabase.storage
        .from(PROPERTY_IMAGES_BUCKET)
        .createSignedUrl(photo.filePath, 60 * 5)

      return {
        ...photo,
        isCover: Boolean(photo.isCover),
        sortOrder: photo.sortOrder ?? index,
        previewUrl: data?.signedUrl || '',
      } satisfies PropertyPhotoDraft
    }))

    setPhotoDrafts(drafts)
    syncDraftsToFormData(drafts)
  }

  const applyPhotoDrafts = (updater: (current: PropertyPhotoDraft[]) => PropertyPhotoDraft[]) => {
    setPhotoDrafts((current) => {
      const next = updater(current)
        .map((photo, index) => ({
          ...photo,
          sortOrder: index,
        }))

      const hasCover = next.some((photo) => photo.isCover)
      const normalized = next.map((photo, index) => ({
        ...photo,
        isCover: hasCover ? photo.isCover : index === 0,
      }))

      syncDraftsToFormData(normalized)
      return normalized
    })
  }

  const attachPhotos = (files: FileList | File[] | null) => {
    const list = files ? Array.from(files) : []
    const imageFiles = list.filter((file) => file.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    applyPhotoDrafts((current) => [
      ...current,
      ...imageFiles.map((file, index) => ({
        id: createId(),
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || undefined,
        isCover: current.length === 0 && index === 0,
        sortOrder: current.length + index,
        createdAt: new Date().toISOString(),
        previewUrl: URL.createObjectURL(file),
        file,
      })),
    ])
  }

  const handlePastePhotos = (event: ClipboardEvent<HTMLFormElement | HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))

    if (files.length === 0) return
    event.preventDefault()
    attachPhotos(files)
  }

  const handleDropPhotos = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDraggingPhoto(false)
    attachPhotos(event.dataTransfer.files)
  }

  const handleRemovePhoto = (photoId: string) => {
    applyPhotoDrafts((current) => {
      const target = current.find((photo) => photo.id === photoId)
      if (target?.file) URL.revokeObjectURL(target.previewUrl)
      return current.filter((photo) => photo.id !== photoId)
    })
  }

  const handleSetCoverPhoto = (photoId: string) => {
    applyPhotoDrafts((current) => current.map((photo) => ({
      ...photo,
      isCover: photo.id === photoId,
    })))
  }

  const uploadPropertyPhotos = async (propertyId: string, drafts: PropertyPhotoDraft[]) => {
    if (!currentTenantId) throw new Error(t.properties_view.form.photos_tenant_required)

    const uploadedPhotos: PropertyPhoto[] = []

    for (const [index, draft] of drafts.entries()) {
      let filePath = draft.filePath

      if (draft.file) {
        const safeFileName = sanitizeFileName(draft.file.name)
        filePath = `${currentTenantId}/${propertyId}/${draft.id}-${safeFileName}`
        const { error } = await supabase.storage
          .from(PROPERTY_IMAGES_BUCKET)
          .upload(filePath, draft.file, {
            cacheControl: '3600',
            upsert: false,
            contentType: draft.file.type || undefined,
          })

        if (error) throw error
      }

      if (!filePath) continue

      uploadedPhotos.push({
        id: draft.id,
        fileName: draft.fileName,
        filePath,
        fileSize: draft.fileSize,
        mimeType: draft.mimeType,
        isCover: draft.isCover,
        sortOrder: index,
        createdAt: draft.createdAt,
      })
    }

    return uploadedPhotos
  }

  const handleDownloadTemplate = () => {
    const rows = [
      ['name', 'type', 'capacity', 'pricePerNight', 'pricePerMonth', 'address', 'city', 'description', 'conservationState'],
      ['Apartamento Vista Mar', 'apartment', '4', '250', '3500', 'Rua das Flores, 123', 'São Paulo', 'Lindo apartamento com vista para o mar', 'Ótimo'],
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template-propriedades.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const parseCSVLine = (line: string, sep: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === sep && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError(null)
    setCsvParsedRows([])
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = (event.target?.result as string).replace(/\r/g, '')
        const lines = text.split('\n').filter(l => l.trim())
        if (lines.length < 2) { setCsvError(t.properties_view.import_error_empty); return }
        const sep = lines[0].includes(';') ? ';' : ','
        const headers = parseCSVLine(lines[0], sep).map(h => h.toLowerCase().replace(/\s/g, ''))
        const typeMap: Record<string, PropertyType> = {
          room: 'room', quarto: 'room',
          apartment: 'apartment', apartamento: 'apartment',
          house: 'house', casa: 'house',
          parking: 'parking', estacionamento: 'parking',
        }
        const rows: Partial<Property>[] = []
        for (let i = 1; i < lines.length; i++) {
          const vals = parseCSVLine(lines[i], sep)
          const row: Record<string, string> = {}
          headers.forEach((h, idx) => { row[h] = vals[idx] ?? '' })
          if (!row.name) continue
          rows.push({
            name: row.name,
            type: typeMap[row.type?.toLowerCase()] ?? 'apartment',
            capacity: Math.max(1, parseInt(row.capacity) || 1),
            pricePerNight: parseFloat(row.pricepernight) || 0,
            pricePerMonth: parseFloat(row.pricepermonth) || 0,
            address: row.address ?? '',
            city: row.city ?? '',
            description: row.description ?? '',
            conservationState: row.conservationstate ?? '',
          })
        }
        if (rows.length === 0) { setCsvError(t.properties_view.import_error_empty); return }
        setCsvParsedRows(rows)
      } catch {
        setCsvError(t.properties_view.import_error_parse)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleImportConfirm = () => {
    const newProperties: Property[] = csvParsedRows.map((row) => ({
      ...row,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      status: 'available' as const,
      ownerIds: [],
      environments: [],
      furnitureItems: [],
      inspectionItems: [],
      photos: [],
      description: row.description ?? '',
    } as Property))
    setProperties((current) => [...(current ?? []), ...newProperties])
    toast.success(`${newProperties.length} ${t.properties_view.import_success}`)
    setIsImportDialogOpen(false)
    setCsvParsedRows([])
    setCsvError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (readOnly) return

    const propertyId = editingProperty?.id || Date.now().toString()
    const createdAt = editingProperty?.createdAt || new Date().toISOString()
    const existingPhotos = editingProperty?.photos || []
    const removedExistingPhotoPaths = existingPhotos
      .filter((existingPhoto) => !photoDrafts.some((draft) => draft.id === existingPhoto.id))
      .map((photo) => photo.filePath)

    try {
      setIsSavingPhotos(true)
      const uploadedPhotos = await uploadPropertyPhotos(propertyId, photoDrafts)
      const normalizedFormData = {
        ...formData,
        environments: supportsEnvironments ? formData.environments : [],
        photos: uploadedPhotos,
      }

      if (editingProperty) {
        setProperties((current) =>
          (current || []).map((property) => property.id === editingProperty.id
            ? {
                ...normalizedFormData,
                id: property.id,
                createdAt: property.createdAt,
                status: getPropertyStatus(property.id),
                ownerIds: normalizedFormData.ownerIds,
              }
            : property
          )
        )
        toast.success(t.properties_view.form.updated_success)
      } else {
        const newProperty: Property = {
          ...normalizedFormData,
          id: propertyId,
          createdAt,
          status: 'available',
          ownerIds: formData.ownerIds,
        }
        setProperties((current) => [...(current || []), newProperty])
        toast.success(t.properties_view.form.created_success)
      }

      if (removedExistingPhotoPaths.length > 0) {
        const { error } = await supabase.storage.from(PROPERTY_IMAGES_BUCKET).remove(removedExistingPhotoPaths)
        if (error) console.warn('Failed to delete removed property images:', error.message)
      }

      resetForm()
    } catch (error: any) {
      toast.error(error?.message || t.properties_view.form.photos_upload_error)
    } finally {
      setIsSavingPhotos(false)
    }
  }

  const resetForm = () => {
    for (const photo of photoDrafts) {
      if (photo.file) URL.revokeObjectURL(photo.previewUrl)
    }

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
      ownerIds: [],
      photos: [],
      icalFeeds: [],
    })
    setPhotoDrafts([])
    setIsDraggingPhoto(false)
    setEnvironmentInput('')
    setEditingEnvironmentIndex(null)
    setFurnitureInput('')
    setEditingFurnitureIndex(null)
    setInspectionItemInput('')
    setEditingInspectionItemIndex(null)
    setICalFeedDraft({ provider: 'airbnb', label: '', url: '' })
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
      ownerIds: property.ownerIds || [],
      photos: property.photos || [],
      icalFeeds: property.icalFeeds || [],
    })
    void loadExistingPhotoDrafts(property.photos || [])
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

  const icalExportUrl = (propertyId: string) =>
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ical-export?propertyId=${propertyId}`

  const handleAddICalFeed = () => {
    if (!icalFeedDraft.url.trim()) return
    const newFeed: PropertyICalFeed = {
      id: createId(),
      provider: icalFeedDraft.provider,
      label: icalFeedDraft.label.trim(),
      url: icalFeedDraft.url.trim(),
    }
    setFormData(prev => ({ ...prev, icalFeeds: [...prev.icalFeeds, newFeed] }))
    setICalFeedDraft({ provider: 'airbnb', label: '', url: '' })
  }

  const handleRemoveICalFeed = (id: string) => {
    setFormData(prev => ({ ...prev, icalFeeds: prev.icalFeeds.filter(f => f.id !== id) }))
  }

  const handleCopyICalUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    toast.success(t.properties_view.ical_export_copied)
  }

  const ICAL_PROVIDER_LABELS: Record<ICalProvider, string> = {
    airbnb: t.properties_view.ical_provider_airbnb,
    booking: t.properties_view.ical_provider_booking,
    vrbo: t.properties_view.ical_provider_vrbo,
    expedia: t.properties_view.ical_provider_expedia,
    other: t.properties_view.ical_provider_other,
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
    if (readOnly) return
    setPropertyToDelete(property)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (propertyToDelete) {
      const photoPaths = (propertyToDelete.photos || []).map((photo) => photo.filePath)
      if (photoPaths.length > 0) {
        void supabase.storage.from(PROPERTY_IMAGES_BUCKET).remove(photoPaths).then(({ error }) => {
          if (error) console.warn('Failed to remove property images:', error.message)
        })
      }
      setProperties((current) => (current || []).filter(p => p.id !== propertyToDelete.id))
      toast.success(t.properties_view.deleted_success)
      setPropertyToDelete(null)
      setDeleteDialogOpen(false)
    }
  }

  const handleGenerateContract = (propertyId: string) => {
    if (readOnly) return
    if (getPropertyStatus(propertyId) !== 'available') {
      toast.error(t.properties_view.contract_unavailable)
      return
    }

    setSelectedPropertyForContract(propertyId)
    setContractDialogOpen(true)
  }

  const handleGenerateAd = (property: Property) => {
    setSelectedPropertyForAd(property)
    setAdDialogOpen(true)
  }

  const buildDuplicatePropertyName = (baseName: string, existingNames: string[]) => {
    const copyLabel = t.properties_view.copy_label
    let candidate = `${baseName} (${copyLabel})`
    let index = 2

    while (existingNames.includes(candidate)) {
      candidate = `${baseName} (${copyLabel} ${index})`
      index += 1
    }

    return candidate
  }

  const handleDuplicateProperty = (property: Property) => {
    if (readOnly) return
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
        photos: [],
      }

      return [...currentList, duplicatedProperty]
    })

    toast.success(t.properties_view.duplicated_success)
  }

  const getStatusColor = (status: PropertyStatus) => {
    switch (status) {
      case 'available': return 'bg-emerald-600 text-white border-emerald-700'
      case 'occupied': return 'bg-blue-600 text-white border-blue-700'
      case 'maintenance': return 'bg-amber-500 text-white border-amber-600'
    }
  }

  const getPropertyIcon = (type: PropertyType) => {
    switch (type) {
      case 'room': return <Bed weight="duotone" size={24} />
      case 'apartment': return <Buildings weight="duotone" size={24} />
      case 'house': return <House weight="duotone" size={24} />
      case 'parking': return <Car weight="duotone" size={24} />
    }
  }

  const getCoverPhoto = (property: Property) => {
    return (property.photos || []).find((photo) => photo.isCover) || property.photos?.[0] || null
  }

  const handleRefresh = () => {
    setProperties((current) => [...(current || [])])
    toast.success(t.common.refreshed_success)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">{t.properties_view.title}</h2>
            <HelpButton content={helpContent} title="Ajuda — Propriedades" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {t.common.refresh}
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
            title={t.properties_view.view_list}
          >
            <SquaresFour size={16} />
          </Button>
          <Button
            variant={viewMode === 'map' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('map')}
            title={t.properties_view.view_map}
          >
            <Compass size={16} />
          </Button>
          {!readOnly && (
            <>
            <Button variant="outline" className="gap-2" onClick={() => { setCsvParsedRows([]); setCsvError(null); setIsImportDialogOpen(true) }}>
              <UploadSimple weight="bold" size={16} />
              {t.properties_view.import_csv}
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              if (!open) {
                resetForm()
                return
              }
              setIsDialogOpen(true)
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus weight="bold" size={16} />
                  {t.properties_view.add_property}
                </Button>
              </DialogTrigger>
            <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden w-[720px] min-w-[480px] max-w-[92vw] h-[88vh] min-h-[400px] resize-x">
              <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                <DialogTitle className="flex items-center gap-1">
                  {editingProperty ? t.properties_view.form.title_edit : t.properties_view.form.title_new}
                  <HelpButton content={formHelpContent} title="Ajuda — Formulário de Propriedade" />
                </DialogTitle>
              </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
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
                      <SelectItem value="parking">{t.properties_view.type.parking}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid gap-4 md:grid-cols-3">
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
                <Label htmlFor="address">{t.properties_view.form.address}</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder={t.properties_view.form.address_placeholder}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="conservationState">{t.properties_view.form.conservation_state}</Label>
                <Input
                  id="conservationState"
                  value={formData.conservationState}
                  onChange={(e) => setFormData({ ...formData, conservationState: e.target.value })}
                  placeholder={t.properties_view.form.conservation_state_placeholder}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">{t.properties_view.form.city}</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder={t.properties_view.form.city_placeholder}
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

              <div
                className={`space-y-3 rounded-xl border border-dashed p-4 transition-colors ${isDraggingPhoto ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'}`}
                onPaste={handlePastePhotos}
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDraggingPhoto(true)
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node)) return
                  setIsDraggingPhoto(false)
                }}
                onDrop={handleDropPhotos}
              >
                <div className="space-y-2">
                  <Label htmlFor="property-photos">{t.properties_view.form.photos}</Label>
                  <Input
                    id="property-photos"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => attachPhotos(event.target.files)}
                  />
                  <p className="text-sm text-muted-foreground">
                    {isDraggingPhoto ? t.properties_view.form.photos_drop_here : t.properties_view.form.photos_hint}
                  </p>
                </div>

                {photoDrafts.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">{t.properties_view.form.cover_preview}</p>
                      {photoDrafts.filter((photo) => photo.isCover).map((photo) => (
                        <div key={photo.id} className="overflow-hidden rounded-xl border bg-card">
                          {photo.previewUrl ? (
                            <img src={photo.previewUrl} alt={photo.fileName} className="aspect-[4/3] w-full object-cover" />
                          ) : (
                            <div className="flex aspect-[4/3] items-center justify-center bg-muted text-muted-foreground">
                              <ImageIcon size={28} />
                            </div>
                          )}
                          <div className="space-y-1 p-3">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="gap-1">
                                <Star size={12} weight="fill" />
                                {t.properties_view.form.cover_badge}
                              </Badge>
                            </div>
                            <p className="truncate text-sm font-medium">{photo.fileName}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(photo.fileSize)}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">{t.properties_view.form.photos_gallery}</p>
                      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 140px), 260px))' }}>
                        {photoDrafts.map((photo) => (
                          <div key={photo.id} className="overflow-hidden rounded-xl border bg-card">
                            {photo.previewUrl ? (
                              <img src={photo.previewUrl} alt={photo.fileName} className="aspect-[4/3] w-full object-cover" />
                            ) : (
                              <div className="flex aspect-[4/3] items-center justify-center bg-muted text-muted-foreground">
                                <ImageIcon size={28} />
                              </div>
                            )}
                            <div className="space-y-2 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-medium">{photo.fileName}</p>
                                {photo.isCover && <Badge variant="secondary">{t.properties_view.form.cover_badge}</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground">{formatFileSize(photo.fileSize)}</p>
                              <div className="flex gap-2">
                                {!photo.isCover && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    title={t.properties_view.form.set_cover}
                                    aria-label={t.properties_view.form.set_cover}
                                    onClick={() => handleSetCoverPhoto(photo.id)}
                                  >
                                    <Star size={14} />
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleRemovePhoto(photo.id)}
                                >
                                  <Trash size={14} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t.properties_view.form.photos_empty}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t.properties_view.form.furniture}</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={furnitureInput}
                    onChange={(e) => setFurnitureInput(e.target.value)}
                    placeholder={t.properties_view.form.furniture_placeholder}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddOrUpdateFurniture()
                      }
                    }}
                  />
                  <Button type="button" onClick={handleAddOrUpdateFurniture}>
                    {editingFurnitureIndex === null
                      ? t.properties_view.form.add
                      : t.properties_view.form.update}
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
                    {t.properties_view.form.furniture_empty}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t.properties_view.form.inspection_items}</Label>
                <div className="flex gap-2">
                  <Input
                    value={inspectionItemInput}
                    onChange={(e) => setInspectionItemInput(e.target.value)}
                    placeholder={t.properties_view.form.inspection_items_placeholder}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddOrUpdateInspectionItem()
                      }
                    }}
                  />
                  <Button type="button" onClick={handleAddOrUpdateInspectionItem}>
                    {editingInspectionItemIndex === null
                      ? t.properties_view.form.add
                      : t.properties_view.form.update}
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
                    {t.properties_view.form.inspection_items_empty}
                  </p>
                )}
              </div>

              {supportsEnvironments && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>{t.properties_view.form.environments}</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleLoadDefaultEnvironments}>
                      {t.properties_view.form.load_defaults}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={environmentInput}
                      onChange={(e) => setEnvironmentInput(e.target.value)}
                      placeholder={t.properties_view.form.environments_placeholder}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddOrUpdateEnvironment()
                        }
                      }}
                    />
                    <Button type="button" onClick={handleAddOrUpdateEnvironment}>
                      {editingEnvironmentIndex === null
                        ? t.properties_view.form.add
                        : t.properties_view.form.update}
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
                      {t.properties_view.form.environments_empty}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>{t.properties_view.form.owners}</Label>
                {(!owners || owners.length === 0) ? (
                  <p className="text-sm text-muted-foreground">
                    {t.properties_view.form.owners_empty}
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

              {/* iCal Integrations */}
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center gap-2">
                  <CalendarBlank size={16} className="text-primary" />
                  <p className="text-sm font-medium">{t.properties_view.ical_section_title}</p>
                </div>
                <p className="text-xs text-muted-foreground">{t.properties_view.ical_section_description}</p>

                {/* Export link — only shown when editing an existing property */}
                {editingProperty && (
                  <div className="space-y-1.5 rounded-md bg-muted/40 p-3">
                    <p className="text-xs font-medium">{t.properties_view.ical_export_title}</p>
                    <p className="text-xs text-muted-foreground">{t.properties_view.ical_export_description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs font-mono">
                        {icalExportUrl(editingProperty.id)}
                      </code>
                      <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5"
                        onClick={() => handleCopyICalUrl(icalExportUrl(editingProperty.id))}>
                        <Copy size={13} />
                        {t.properties_view.ical_export_copy}
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5"
                        onClick={() => window.open(icalExportUrl(editingProperty.id), '_blank')}>
                        <LinkSimple size={13} />
                        {t.properties_view.ical_export_open}
                      </Button>
                    </div>
                  </div>
                )}

                {/* External feeds list */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{t.properties_view.ical_feeds_title}</p>
                  {formData.icalFeeds.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t.properties_view.ical_feeds_empty}</p>
                  ) : (
                    <div className="space-y-2">
                      {formData.icalFeeds.map((feed) => (
                        <div key={feed.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                          <CalendarBlank size={14} className="text-muted-foreground shrink-0" />
                          <span className="font-medium shrink-0">{ICAL_PROVIDER_LABELS[feed.provider]}</span>
                          {feed.label && <span className="text-muted-foreground shrink-0">· {feed.label}</span>}
                          <span className="flex-1 truncate text-xs text-muted-foreground font-mono">{feed.url}</span>
                          <Button type="button" variant="ghost" size="sm" className="shrink-0 h-6 w-6 p-0"
                            onClick={() => handleCopyICalUrl(feed.url)}>
                            <Copy size={13} />
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="shrink-0 h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveICalFeed(feed.id)}>
                            <Trash size={13} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add feed form */}
                <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
                  <Select value={icalFeedDraft.provider} onValueChange={(v) => setICalFeedDraft(prev => ({ ...prev, provider: v as ICalProvider }))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="airbnb">{t.properties_view.ical_provider_airbnb}</SelectItem>
                      <SelectItem value="booking">{t.properties_view.ical_provider_booking}</SelectItem>
                      <SelectItem value="vrbo">{t.properties_view.ical_provider_vrbo}</SelectItem>
                      <SelectItem value="expedia">{t.properties_view.ical_provider_expedia}</SelectItem>
                      <SelectItem value="other">{t.properties_view.ical_provider_other}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8 text-sm"
                    placeholder={t.properties_view.ical_feed_url_placeholder}
                    value={icalFeedDraft.url}
                    onChange={(e) => setICalFeedDraft(prev => ({ ...prev, url: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddICalFeed() } }}
                  />
                  <Button type="button" size="sm" className="h-8 shrink-0" onClick={handleAddICalFeed} disabled={!icalFeedDraft.url.trim()}>
                    <Plus size={14} weight="bold" />
                    {t.properties_view.ical_feed_add}
                  </Button>
                </div>
              </div>

              </div>
              <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t.properties_view.form.cancel}
                </Button>
                <Button type="submit" disabled={isSavingPhotos}>
                  {isSavingPhotos ? t.properties_view.form.photos_saving : t.properties_view.form.save}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
            </Dialog>
            </>
          )}
        </div>
      </div>

      <Dialog open={isImportDialogOpen} onOpenChange={(open) => { setIsImportDialogOpen(open); if (!open) { setCsvParsedRows([]); setCsvError(null) } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.properties_view.import_dialog_title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t.properties_view.import_hint}</p>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadTemplate}>
              <DownloadSimple weight="bold" size={16} />
              {t.properties_view.import_download_template}
            </Button>
            <div className="space-y-2">
              <Label>{t.properties_view.import_select_file}</Label>
              <input
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-input file:text-sm file:font-medium file:bg-background file:text-foreground hover:file:bg-accent cursor-pointer"
                onChange={handleCSVFile}
              />
            </div>
            {csvError && (
              <p className="text-sm text-destructive">{csvError}</p>
            )}
            {csvParsedRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t.properties_view.import_preview} — {csvParsedRows.length} {t.properties_view.import_rows_found}</p>
                <div className="border rounded-lg overflow-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">{t.properties_view.import_col_name}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.properties_view.import_col_type}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.properties_view.import_col_capacity}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.properties_view.import_col_price_night}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.properties_view.import_col_price_month}</th>
                        <th className="text-left px-3 py-2 font-medium">{t.properties_view.import_col_city}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvParsedRows.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2">{row.type}</td>
                          <td className="px-3 py-2">{row.capacity}</td>
                          <td className="px-3 py-2">{row.pricePerNight}</td>
                          <td className="px-3 py-2">{row.pricePerMonth}</td>
                          <td className="px-3 py-2">{row.city}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              {t.properties_view.form.cancel}
            </Button>
            <Button onClick={handleImportConfirm} disabled={csvParsedRows.length === 0}>
              {t.properties_view.import_confirm_btn} {csvParsedRows.length > 0 && `(${csvParsedRows.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewMode === 'map' && properties && properties.length > 0 && (
        <PropertyMapView properties={properties} getPropertyStatus={getPropertyStatus} focusPropertyId={focusPropertyId} />
      )}

      {!properties || properties.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <House weight="duotone" size={64} className="text-muted-foreground mb-4" />
            {!readOnly && (
              <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                <Plus weight="bold" size={16} />
                {t.properties_view.add_property}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((property) => {
            const currentStatus = getPropertyStatus(property.id)
            const coverPhoto = getCoverPhoto(property)
            const coverPhotoUrl = coverPhotoUrls[property.id]
            const hasCoverHero = Boolean(coverPhoto && coverPhotoUrl)
            return (
            <Card
              key={property.id}
              className="overflow-hidden py-0 hover:shadow-lg transition-shadow duration-200"
            >
              <div
                className="relative h-[158px] overflow-hidden border-b"
                style={hasCoverHero ? {
                  backgroundImage: `url("${coverPhotoUrl}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                } : {
                  background: 'linear-gradient(135deg, rgba(226,232,240,1) 0%, rgba(203,213,225,1) 52%, rgba(241,245,249,1) 100%)',
                }}
              >
                <div className={`absolute inset-0 ${hasCoverHero ? 'bg-white/35 backdrop-blur-[0.5px]' : 'bg-white/12'}`} />
                <div className={`absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t ${hasCoverHero ? 'from-white/78' : 'from-white/60'} to-transparent`} />
              </div>
              <div>
                <CardHeader className="relative z-10 -mt-12 pb-3">
                  <div className="flex items-start gap-3">
                    <div className="text-primary rounded-2xl bg-white/78 p-2 shadow-sm backdrop-blur">
                      {getPropertyIcon(property.type)}
                    </div>
                    <div>
                      <CardTitle className="text-lg rounded-md bg-white/78 px-2 py-1 shadow-sm backdrop-blur w-fit">
                        {property.name}
                      </CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <CardDescription className="rounded-md bg-white/72 px-2 py-1 backdrop-blur w-fit">
                          {t.properties_view.type[property.type]}
                        </CardDescription>
                        <Badge className={`${getStatusColor(currentStatus)} inline-flex border px-3 py-1 text-xs font-semibold shadow-sm`}>
                          {t.properties_view.status[currentStatus]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pb-8">
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
                  <div className="space-y-1 pt-2 border-t border-black/10">
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 bg-white/80"
                      onClick={() => handleGenerateAd(property)}
                    >
                      <ImageIcon size={14} />
                      {t.properties_view.generate_ad}
                    </Button>
                    {(property.address || property.city) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 bg-white/80"
                        onClick={() => { setFocusPropertyId(property.id); setViewMode('map') }}
                      >
                        <Compass size={14} />
                        {t.properties_view.show_on_map}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => handleCopyICalUrl(icalExportUrl(property.id))}
                      title={icalExportUrl(property.id)}
                    >
                      <CalendarBlank size={14} />
                      {t.properties_view.ical_export_copy}
                    </Button>
                    {!readOnly && currentStatus === 'available' && (
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
                    {!readOnly && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 gap-2 bg-white/80" onClick={() => handleEdit(property)}>
                          <Pencil size={14} />
                          {t.properties_view.edit}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 bg-white/80"
                          onClick={() => handleDuplicateProperty(property)}
                        >
                          <Plus size={14} />
                          {t.properties_view.duplicate}
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2 bg-white/80 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(property)}>
                          <Trash size={14} />
                          {t.properties_view.delete}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </div>
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

      <PropertyAdDialog
        open={adDialogOpen}
        onOpenChange={setAdDialogOpen}
        property={selectedPropertyForAd}
        currentStatus={selectedPropertyForAd ? getPropertyStatus(selectedPropertyForAd.id) : null}
        coverPhotoUrl={selectedPropertyForAd ? coverPhotoUrls[selectedPropertyForAd.id] : ''}
      />
    </div>
  )
}
