import { useMemo, useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import type {
  Contract,
  Guest,
  Inspection,
  InspectionArea,
  InspectionItemCondition,
  InspectionStatus,
  InspectionType,
  Property,
  Task,
} from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  CheckCircle,
  CheckSquare,
  ClipboardText,
  FilePdf,
  LinkSimple,
  PencilSimple,
  Play,
  Plus,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { downloadInspectionPDF } from '@/lib/inspectionPDF'
import { getContractSelectionLabel } from '@/lib/contractLabels'

type InspectionFormState = {
  title: string
  propertyId: string
  contractId: string
  type: InspectionType
  inspectorName: string
  scheduledDate: string
  summary: string
  areas: InspectionArea[]
}

type FormStep = 'select-property-contract' | 'fill-matrix'

/** In 'structure' mode (draft/new): edit labels, add/remove areas — conditions disabled.
 *  In 'evaluate' mode (in-progress): rate condition + notes — labels read-only, structure locked. */
type MatrixMode = 'structure' | 'evaluate'

type InspectionDifference = {
  areaName: string
  itemLabel: string
  previousCondition?: InspectionItemCondition
  currentCondition: InspectionItemCondition
  currentNotes: string
}

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function buildArea(name: string, items: string[]): InspectionArea {
  return {
    id: createId(),
    name,
    notes: '',
    items: items.map((label) => ({
      id: createId(),
      label,
      condition: 'na' as InspectionItemCondition,
      notes: '',
    })),
  }
}

function buildInspectionAreas(language: 'pt' | 'en', property: Property | null | undefined): InspectionArea[] {
  if (!property) return []

  if (property.type === 'room') {
    const areas: InspectionArea[] = []
    if (property.furnitureItems?.length) {
      areas.push(buildArea(language === 'pt' ? 'Mobiliário' : 'Furniture', property.furnitureItems))
    }
    if (property.inspectionItems?.length) {
      areas.push(buildArea(language === 'pt' ? 'Itens de vistoria' : 'Inspection items', property.inspectionItems))
    }
    return areas
  }

  const environments = property.environments || []
  const inspectionItems = property.inspectionItems || []
  return environments.map((env) => buildArea(env, inspectionItems))
}

/** What types are allowed for a new inspection given existing ones for the same contract */
function getAllowedTypes(contractInspections: Inspection[]): {
  allowed: InspectionType[]
  checkInId: string | null
  reason: 'no-check-in' | 'check-in-not-active' | 'check-in-in-progress' | 'check-in-assessed' | 'check-in-draft'
} {
  const checkIn = contractInspections.find((i) => i.type === 'check-in')

  if (!checkIn) {
    return { allowed: ['check-in'], checkInId: null, reason: 'no-check-in' }
  }

  if (checkIn.status === 'in-progress') {
    return { allowed: ['check-out', 'periodic', 'maintenance'], checkInId: checkIn.id, reason: 'check-in-in-progress' }
  }

  if (checkIn.status === 'assessed') {
    return { allowed: ['check-out', 'periodic', 'maintenance'], checkInId: checkIn.id, reason: 'check-in-assessed' }
  }

  // draft
  return { allowed: [], checkInId: checkIn.id, reason: 'check-in-draft' }
}

const STATUS_NEXT: Partial<Record<InspectionStatus, InspectionStatus>> = {
  draft: 'in-progress',
  'in-progress': 'assessed',
}

function resetAreaEvaluations(areas: InspectionArea[]): InspectionArea[] {
  return areas.map((area) => ({
    ...area,
    notes: '',
    items: area.items.map((item) => ({ ...item, condition: 'na' as InspectionItemCondition, notes: '' })),
  }))
}

export default function InspectionsView() {
  const { language } = useLanguage()
  const [inspections, setInspections] = useKV<Inspection[]>('inspections', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [, setTasks] = useKV<Task[]>('tasks', [])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingInspection, setEditingInspection] = useState<Inspection | null>(null)
  const [linkedSourceInspection, setLinkedSourceInspection] = useState<Inspection | null>(null)
  const [formStep, setFormStep] = useState<FormStep>('select-property-contract')
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [propertyFilter, setPropertyFilter] = useState('all')

  const labels = useMemo(() => ({
    title: language === 'pt' ? 'Vistoria digital' : 'Digital inspections',
    subtitle: language === 'pt'
      ? 'Registre entrada, saída e manutenção com checklist por ambiente.'
      : 'Track move-in, move-out and maintenance with room-by-room checklists.',
    add: language === 'pt' ? 'Nova vistoria' : 'New inspection',
    edit: language === 'pt' ? 'Editar vistoria' : 'Edit inspection',
    emptyTitle: language === 'pt' ? 'Nenhuma vistoria cadastrada' : 'No inspections yet',
    emptyDescription: language === 'pt'
      ? 'Crie sua primeira vistoria para acompanhar o estado dos imóveis.'
      : 'Create your first inspection to track property condition.',
    property: language === 'pt' ? 'Propriedade' : 'Property',
    contract: language === 'pt' ? 'Contrato' : 'Contract',
    noContract: language === 'pt' ? 'Sem contrato' : 'No contract',
    selectPropertyFirst: language === 'pt' ? 'Selecione uma propriedade primeiro' : 'Select a property first',
    noContractForProperty: language === 'pt' ? 'Nenhum contrato para esta propriedade' : 'No contracts for this property',
    continueToMatrix: language === 'pt' ? 'Continuar para checklist' : 'Continue to checklist',
    backToSelection: language === 'pt' ? 'Voltar' : 'Back',
    type: language === 'pt' ? 'Tipo' : 'Type',
    inspector: language === 'pt' ? 'Responsável' : 'Inspector',
    scheduledDate: language === 'pt' ? 'Data da vistoria' : 'Inspection date',
    summary: language === 'pt' ? 'Resumo geral' : 'Summary',
    search: language === 'pt' ? 'Buscar por título, imóvel ou responsável...' : 'Search by title, property or inspector...',
    allProperties: language === 'pt' ? 'Todas as propriedades' : 'All properties',
    save: language === 'pt' ? 'Salvar vistoria' : 'Save inspection',
    cancel: language === 'pt' ? 'Cancelar' : 'Cancel',
    delete: language === 'pt' ? 'Excluir' : 'Delete',
    refresh: language === 'pt' ? 'Atualizar' : 'Refresh',
    areaNotes: language === 'pt' ? 'Observações' : 'Notes',
    itemNotes: language === 'pt' ? 'Observações do item' : 'Item notes',
    addArea: language === 'pt' ? 'Adicionar ambiente' : 'Add area',
    addItem: language === 'pt' ? 'Adicionar item' : 'Add item',
    issues: language === 'pt' ? 'pontos de atenção' : 'attention points',
    items: language === 'pt' ? 'itens' : 'items',
    noItemsConfigured: language === 'pt'
      ? 'Nenhum item de vistoria ou mobiliário cadastrado nesta propriedade.'
      : 'No inspection items or furniture registered for this property.',
    noEnvironmentsConfigured: language === 'pt'
      ? 'Nenhum ambiente cadastrado nesta propriedade.'
      : 'No environments registered for this property.',
    generatePdf: language === 'pt' ? 'Gerar PDF' : 'Generate PDF',
    generatingPdf: language === 'pt' ? 'Gerando...' : 'Generating...',
    pdfError: language === 'pt' ? 'Erro ao gerar PDF' : 'Failed to generate PDF',
    pdfNeedsAssessed: language === 'pt'
      ? 'A vistoria precisa estar no status "Avaliada" para gerar o PDF.'
      : 'The inspection must be in "Assessed" status to generate the PDF.',
    advanceDraft: language === 'pt' ? 'Iniciar' : 'Start',
    advanceInProgress: language === 'pt' ? 'Concluir avaliação' : 'Complete evaluation',
    statusAdvanced: language === 'pt' ? 'Status atualizado' : 'Status updated',
    backToDraft: language === 'pt' ? 'Voltar para rascunho' : 'Back to draft',
    backToDraftConfirm: language === 'pt'
      ? 'Ao voltar para rascunho, todas as classificações e observações serão apagadas. Deseja continuar?'
      : 'Going back to draft will clear all condition ratings and notes. Continue?',
    backToDraftSuccess: language === 'pt' ? 'Vistoria voltou para rascunho' : 'Inspection returned to draft',
    created: language === 'pt' ? 'Vistoria criada com sucesso' : 'Inspection created successfully',
    updated: language === 'pt' ? 'Vistoria atualizada com sucesso' : 'Inspection updated successfully',
    deleted: language === 'pt' ? 'Vistoria excluída com sucesso' : 'Inspection deleted successfully',
    structureModeHint: language === 'pt'
      ? 'Em rascunho: edite os itens e ambientes. Inicie a vistoria para avaliar as condições.'
      : 'Draft mode: edit items and areas. Start the inspection to rate conditions.',
    evaluateModeHint: language === 'pt'
      ? 'Em andamento: avalie as condições de cada item. Estrutura bloqueada.'
      : 'In progress: rate conditions for each item. Structure is locked.',
    // type-constraint messages
    hintNoCheckIn: language === 'pt'
      ? 'Nenhuma vistoria registrada para este contrato. Crie a vistoria de entrada primeiro.'
      : 'No inspections for this contract yet. Create the move-in inspection first.',
    hintCheckInDraft: language === 'pt'
      ? 'A vistoria de entrada existe mas ainda está em rascunho. Inicie-a para liberar outros tipos.'
      : 'The move-in inspection exists but is still a draft. Start it to unlock other types.',
    hintCheckInInProgress: language === 'pt'
      ? 'Vistoria de entrada em andamento. Você pode criar vistorias de saída, manutenção ou periódica.'
      : 'Move-in inspection is in progress. You can create check-out, maintenance or periodic inspections.',
    hintCheckInAssessed: language === 'pt'
      ? 'Vistoria de entrada avaliada. Você pode criar vistorias de saída, manutenção ou periódica vinculadas a ela.'
      : 'Move-in inspection is assessed. You can create check-out, maintenance or periodic inspections linked to it.',
    linkedCheckIn: language === 'pt' ? 'Vistoria de entrada vinculada' : 'Linked move-in inspection',
    createLinked: language === 'pt' ? 'Nova vistoria vinculada' : 'New linked inspection',
    linkedGroup: language === 'pt' ? 'Vistorias vinculadas' : 'Linked inspections',
    mainInspection: language === 'pt' ? 'Vistoria principal' : 'Main inspection',
    comparedToPrevious: language === 'pt' ? 'Diferenças da vistoria anterior' : 'Differences from previous inspection',
    noDifferences: language === 'pt' ? 'Sem diferenças registradas' : 'No differences recorded',
    previous: language === 'pt' ? 'Anterior' : 'Previous',
    current: language === 'pt' ? 'Atual' : 'Current',
    createTask: language === 'pt' ? 'Criar task' : 'Create task',
    taskCreated: language === 'pt' ? 'Task criada e vinculada à propriedade' : 'Task created and linked to property',
  }), [language])

  const typeLabels: Record<InspectionType, string> = {
    'check-in':  language === 'pt' ? 'Entrada'    : 'Move-in',
    'check-out': language === 'pt' ? 'Saída'      : 'Move-out',
    maintenance: language === 'pt' ? 'Manutenção' : 'Maintenance',
    periodic:    language === 'pt' ? 'Periódica'  : 'Periodic',
  }

  const statusLabels: Record<InspectionStatus, string> = {
    draft:         language === 'pt' ? 'Rascunho'     : 'Draft',
    'in-progress': language === 'pt' ? 'Em andamento' : 'In progress',
    assessed:      language === 'pt' ? 'Avaliada'     : 'Assessed',
  }

  const conditionLabels: Record<InspectionItemCondition, string> = {
    excellent: language === 'pt' ? 'Excelente' : 'Excellent',
    good:      language === 'pt' ? 'Bom'       : 'Good',
    attention: language === 'pt' ? 'Atenção'   : 'Needs attention',
    damaged:   language === 'pt' ? 'Danificado': 'Damaged',
    na:        language === 'pt' ? 'N/A'       : 'N/A',
  }

  const buildEmptyForm = (): InspectionFormState => ({
    title: '',
    propertyId: '',
    contractId: '',
    type: 'check-in',
    inspectorName: '',
    scheduledDate: new Date().toISOString().slice(0, 10),
    summary: '',
    areas: [],
  })

  const [formData, setFormData] = useState<InspectionFormState>(buildEmptyForm)

  const resetForm = () => {
    setEditingInspection(null)
    setLinkedSourceInspection(null)
    setFormData(buildEmptyForm())
    setFormStep('select-property-contract')
    setIsDialogOpen(false)
  }

  const getPropertyById = (propertyId: string) =>
    (properties || []).find((p) => p.id === propertyId) ?? null

  const getPropertyName = (propertyId: string) =>
    getPropertyById(propertyId)?.name ?? (language === 'pt' ? 'Propriedade removida' : 'Deleted property')

  const selectedProperty = getPropertyById(formData.propertyId)
  const isRoomType = selectedProperty?.type === 'room'

  // Matrix mode based on the inspection being edited
  const matrixMode: MatrixMode = editingInspection?.status === 'in-progress' ? 'evaluate' : 'structure'

  const getContractLabel = (contractId: string) => {
    const contract = (contracts || []).find((item) => item.id === contractId)
    if (!contract) return labels.noContract
    return getContractSelectionLabel(contract, properties || [])
  }

  const getIssueCount = (inspection: InspectionFormState | Inspection) =>
    inspection.areas.reduce((total, area) => (
      total + area.items.filter((item) => item.condition === 'attention' || item.condition === 'damaged').length
    ), 0)

  const getConditionSeverity = (condition: InspectionItemCondition) => {
    switch (condition) {
      case 'excellent': return 0
      case 'good': return 1
      case 'na': return 1
      case 'attention': return 2
      case 'damaged': return 3
    }
  }

  const isNegativeDifference = (difference: InspectionDifference) => {
    if (!difference.previousCondition) {
      return difference.currentCondition === 'attention' || difference.currentCondition === 'damaged'
    }

    return getConditionSeverity(difference.currentCondition) > getConditionSeverity(difference.previousCondition)
  }

  const getInspectionDifferences = (current: Inspection, previous?: Inspection): InspectionDifference[] => {
    if (!previous) return []

    const previousItems = new Map<string, InspectionArea['items'][number]>()
    for (const area of previous.areas) {
      for (const item of area.items) {
        previousItems.set(`${area.name}::${item.label}`, item)
      }
    }

    return current.areas.flatMap((area) =>
      area.items.flatMap((item) => {
        const previousItem = previousItems.get(`${area.name}::${item.label}`)
        if (!previousItem) {
          return [{
            areaName: area.name,
            itemLabel: item.label,
            previousCondition: undefined,
            currentCondition: item.condition,
            currentNotes: item.notes || '',
          }]
        }

        const conditionChanged = previousItem.condition !== item.condition
        const notesChanged = (previousItem.notes || '') !== (item.notes || '')
        if (!conditionChanged && !notesChanged) return []

        return [{
          areaName: area.name,
          itemLabel: item.label,
          previousCondition: previousItem.condition,
          currentCondition: item.condition,
          currentNotes: item.notes || '',
        }]
      })
    )
  }

  const filteredContracts = (contracts || []).filter((contract) =>
    formData.propertyId !== '' && contract.propertyIds.includes(formData.propertyId)
  )

  const handleCreateTaskFromDifference = (inspection: Inspection, difference: InspectionDifference) => {
    const title = language === 'pt'
      ? `Corrigir ${difference.itemLabel} - ${difference.areaName}`
      : `Fix ${difference.itemLabel} - ${difference.areaName}`
    const previousText = difference.previousCondition
      ? conditionLabels[difference.previousCondition]
      : (language === 'pt' ? 'Sem registro anterior' : 'No previous record')
    const description = [
      language === 'pt'
        ? `Diferença negativa identificada na vistoria "${inspection.title}".`
        : `Negative difference identified in inspection "${inspection.title}".`,
      `${labels.previous}: ${previousText}`,
      `${labels.current}: ${conditionLabels[difference.currentCondition]}`,
      difference.currentNotes
        ? `${language === 'pt' ? 'Observação' : 'Note'}: ${difference.currentNotes}`
        : '',
    ].filter(Boolean).join('\n')

    const newTask: Task = {
      id: createId(),
      title,
      description,
      dueDate: new Date().toISOString().slice(0, 10),
      priority: difference.currentCondition === 'damaged' ? 'high' : 'medium',
      status: 'pending',
      assignee: '',
      propertyId: inspection.propertyId,
      createdAt: new Date().toISOString(),
    }

    setTasks((current) => [...(current || []), newTask])
    toast.success(labels.taskCreated)
  }

  const contractConstraint = useMemo(() => {
    if (!formData.contractId) return null
    const contractInspections = (inspections || []).filter(
      (i) => i.contractId === formData.contractId && (!editingInspection || i.id !== editingInspection.id)
    )
    return getAllowedTypes(contractInspections)
  }, [formData.contractId, inspections, editingInspection])

  const constraintHint = useMemo(() => {
    if (!contractConstraint) return null
    switch (contractConstraint.reason) {
      case 'no-check-in':        return labels.hintNoCheckIn
      case 'check-in-draft':     return labels.hintCheckInDraft
      case 'check-in-in-progress': return labels.hintCheckInInProgress
      case 'check-in-assessed':  return labels.hintCheckInAssessed
      case 'check-in-not-active': return null
    }
  }, [contractConstraint, labels])

  const canContinue = formData.propertyId !== '' &&
    formData.contractId !== '' &&
    (contractConstraint?.allowed.length ?? 0) > 0

  const isLinkedCreation = !!linkedSourceInspection && !editingInspection

  const filteredInspections = (inspections || []).filter((inspection) => {
    const matchesProperty = propertyFilter === 'all' || inspection.propertyId === propertyFilter
    const query = searchQuery.trim().toLowerCase()
    const matchesQuery = !query || [
      inspection.title,
      inspection.inspectorName,
      getPropertyName(inspection.propertyId),
      typeLabels[inspection.type],
    ].some((value) => value.toLowerCase().includes(query))
    return matchesProperty && matchesQuery
  })

  const inspectionGroups = useMemo(() => {
    const allInspections = inspections || []
    const byId = new Map(allInspections.map((inspection) => [inspection.id, inspection]))
    const filteredIds = new Set(filteredInspections.map((inspection) => inspection.id))
    const groups = new Map<string, { root: Inspection; children: Inspection[] }>()

    for (const inspection of filteredInspections) {
      const root = inspection.parentInspectionId
        ? (byId.get(inspection.parentInspectionId) || inspection)
        : inspection
      const existing = groups.get(root.id) || { root, children: [] }
      groups.set(root.id, existing)
    }

    for (const inspection of allInspections) {
      if (!inspection.parentInspectionId) continue
      const rootId = inspection.parentInspectionId
      const group = groups.get(rootId)
      if (!group) continue
      if (!filteredIds.has(inspection.id) && !filteredIds.has(rootId)) continue
      if (!group.children.some((child) => child.id === inspection.id)) {
        group.children.push(inspection)
      }
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        children: group.children.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      }))
      .sort((a, b) => b.root.createdAt.localeCompare(a.root.createdAt))
  }, [filteredInspections, inspections])

  const upsertArea = (areaId: string, updater: (area: InspectionArea) => InspectionArea) => {
    setFormData((current) => ({
      ...current,
      areas: current.areas.map((area) => area.id === areaId ? updater(area) : area),
    }))
  }

  const handleContractChange = (contractId: string) => {
    const contractInspections = (inspections || []).filter((i) => i.contractId === contractId)
    const { allowed } = getAllowedTypes(contractInspections)
    const defaultType: InspectionType = allowed[0] ?? 'check-in'
    setFormData((current) => ({
      ...current,
      contractId,
      type: allowed.includes(current.type as InspectionType) ? current.type : defaultType,
    }))
  }

  const getCheckInForContract = (contractId: string): Inspection | undefined =>
    (inspections || []).find((i) => i.contractId === contractId && i.type === 'check-in')

  const handleOpenCreate = () => {
    setEditingInspection(null)
    setLinkedSourceInspection(null)
    setFormData(buildEmptyForm())
    setFormStep('select-property-contract')
    setIsDialogOpen(true)
  }

  const handleOpenLinked = (sourceInspection: Inspection) => {
    const contractInspections = (inspections || []).filter(
      (i) => i.contractId === sourceInspection.contractId
    )
    const { allowed } = getAllowedTypes(contractInspections)
    if (allowed.length === 0) return
    const defaultType: InspectionType = allowed[0]

    // Use the most recently updated inspection for this contract as the data template,
    // falling back to the source (check-in) itself when no others exist.
    const reference = contractInspections
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? sourceInspection

    // Deep-copy areas so edits don't mutate the reference, and generate fresh IDs.
    const copiedAreas: InspectionArea[] = reference.areas.map((area) => ({
      ...area,
      id: createId(),
      items: area.items.map((item) => ({ ...item, id: createId() })),
    }))

    setEditingInspection(null)
    setLinkedSourceInspection(sourceInspection)
    setFormData({
      title: '',
      propertyId: sourceInspection.propertyId,
      contractId: sourceInspection.contractId,
      type: defaultType,
      inspectorName: reference.inspectorName,
      scheduledDate: new Date().toISOString().slice(0, 10),
      summary: reference.summary ?? '',
      areas: copiedAreas,
    })
    setFormStep('select-property-contract')
    setIsDialogOpen(true)
  }

  const handleEdit = (inspection: Inspection) => {
    setEditingInspection(inspection)
    setLinkedSourceInspection(null)
    setFormData({
      title: inspection.title,
      propertyId: inspection.propertyId,
      contractId: inspection.contractId,
      type: inspection.type,
      inspectorName: inspection.inspectorName,
      scheduledDate: inspection.scheduledDate.slice(0, 10),
      summary: inspection.summary || '',
      areas: inspection.areas,
    })
    setFormStep('fill-matrix')
    setIsDialogOpen(true)
  }

  const handleDelete = (inspectionId: string) => {
    setInspections((current) => (current || []).filter((inspection) => inspection.id !== inspectionId))
    toast.success(labels.deleted)
  }

  const handleRefresh = () => {
    setInspections((current) => [...(current || [])])
    toast.success(language === 'pt' ? 'Dados atualizados' : 'Data updated')
  }

  const handleAdvanceStatus = (inspection: Inspection) => {
    const next = STATUS_NEXT[inspection.status]
    if (!next) return
    const now = new Date().toISOString()
    setInspections((current) =>
      (current || []).map((i) =>
        i.id === inspection.id
          ? {
              ...i,
              status: next,
              completedDate: next === 'assessed' ? now.slice(0, 10) : i.completedDate,
              updatedAt: now,
            }
          : i
      )
    )
    toast.success(labels.statusAdvanced)
  }

  const handleBackToDraft = (inspection: Inspection) => {
    const confirmed = window.confirm(labels.backToDraftConfirm)
    if (!confirmed) return
    const now = new Date().toISOString()
    setInspections((current) =>
      (current || []).map((i) =>
        i.id === inspection.id
          ? {
              ...i,
              status: 'draft',
              completedDate: undefined,
              updatedAt: now,
              areas: resetAreaEvaluations(i.areas),
            }
          : i
      )
    )
    toast.success(labels.backToDraftSuccess)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.propertyId) {
      toast.error(language === 'pt' ? 'Selecione uma propriedade.' : 'Select a property.')
      return
    }
    if (!formData.contractId) {
      toast.error(language === 'pt' ? 'Selecione um contrato.' : 'Select a contract.')
      return
    }

    const now = new Date().toISOString()
    const normalizedTitle = formData.title.trim() || `${typeLabels[formData.type]} - ${getPropertyName(formData.propertyId)}`
    const parentInspectionId = formData.type !== 'check-in'
      ? (editingInspection?.parentInspectionId ?? linkedSourceInspection?.id ?? getCheckInForContract(formData.contractId)?.id)
      : undefined
    const inspectionPayload: Inspection = {
      id: editingInspection?.id || createId(),
      title: normalizedTitle,
      propertyId: formData.propertyId,
      contractId: formData.contractId,
      parentInspectionId,
      type: formData.type,
      status: editingInspection?.status ?? 'draft',
      inspectorName: formData.inspectorName.trim(),
      scheduledDate: formData.scheduledDate,
      completedDate: editingInspection?.completedDate,
      summary: formData.summary.trim(),
      areas: formData.areas,
      createdAt: editingInspection?.createdAt || now,
      updatedAt: now,
    }

    if (editingInspection) {
      setInspections((current) =>
        (current || []).map((inspection) => inspection.id === editingInspection.id ? inspectionPayload : inspection)
      )
      toast.success(labels.updated)
    } else {
      setInspections((current) => [...(current || []), inspectionPayload])
      toast.success(labels.created)
    }

    resetForm()
  }

  const handleGeneratePDF = async (inspection: Inspection) => {
    const property = getPropertyById(inspection.propertyId)
    const contract = (contracts || []).find((c) => c.id === inspection.contractId)
    if (!property || !contract) {
      toast.error(labels.pdfError)
      return
    }
    const guest = (guests || []).find((g) => g.id === contract.guestId) ?? null
    setGeneratingPdfId(inspection.id)
    try {
      await downloadInspectionPDF({ inspection, property, contract, guest, language })
    } catch {
      toast.error(labels.pdfError)
    } finally {
      setGeneratingPdfId(null)
    }
  }

  const getStatusClass = (status: InspectionStatus) => {
    switch (status) {
      case 'draft':        return 'bg-muted text-muted-foreground'
      case 'in-progress':  return 'bg-amber-100 text-amber-800'
      case 'assessed':     return 'bg-emerald-100 text-emerald-800'
    }
  }

  const getConditionClass = (condition: InspectionItemCondition) => {
    switch (condition) {
      case 'excellent': return 'bg-emerald-100 text-emerald-800'
      case 'good':      return 'bg-sky-100 text-sky-800'
      case 'attention': return 'bg-amber-100 text-amber-800'
      case 'damaged':   return 'bg-rose-100 text-rose-800'
      case 'na':        return 'bg-muted text-muted-foreground'
    }
  }

  const matrixEmptyMessage = selectedProperty
    ? isRoomType
      ? (!selectedProperty.furnitureItems?.length && !selectedProperty.inspectionItems?.length)
        ? labels.noItemsConfigured : null
      : !selectedProperty.environments?.length
        ? labels.noEnvironmentsConfigured : null
    : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{labels.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{labels.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleRefresh} className="gap-2">
            <ArrowsClockwise weight="bold" size={16} />
            {labels.refresh}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => open ? setIsDialogOpen(true) : resetForm()}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={handleOpenCreate}>
                <Plus weight="bold" size={16} />
                {labels.add}
              </Button>
            </DialogTrigger>
            <DialogContent className="flex flex-col w-[calc(100vw-2rem)] max-w-6xl h-[90vh] overflow-hidden p-0">
              <DialogHeader className="border-b px-6 py-4 pr-12">
                <DialogTitle>{editingInspection ? labels.edit : isLinkedCreation ? labels.createLinked : labels.add}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-6">

                  {/* ── Step 1: property, contract, metadata ── */}
                  {formStep === 'select-property-contract' && (
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="inspection-property">{labels.property} *</Label>
                          <Select
                            value={formData.propertyId}
                            disabled={isLinkedCreation}
                            onValueChange={(value) => {
                              const property = getPropertyById(value)
                              setFormData((current) => ({
                                ...current,
                                propertyId: value,
                                contractId: '',
                                type: 'check-in',
                                areas: buildInspectionAreas(language, property),
                              }))
                            }}
                          >
                            <SelectTrigger id="inspection-property">
                              <SelectValue placeholder={labels.property} />
                            </SelectTrigger>
                            <SelectContent>
                              {(properties || []).map((property) => (
                                <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="inspection-contract">{labels.contract} *</Label>
                          <Select
                            value={formData.contractId}
                            onValueChange={handleContractChange}
                            disabled={!formData.propertyId || isLinkedCreation}
                          >
                            <SelectTrigger id="inspection-contract">
                              <SelectValue placeholder={
                                !formData.propertyId
                                  ? labels.selectPropertyFirst
                                  : filteredContracts.length === 0
                                  ? labels.noContractForProperty
                                  : labels.contract
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredContracts.map((contract) => (
                                <SelectItem key={contract.id} value={contract.id}>
                                  {getContractSelectionLabel(contract, properties || [])}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* constraint hint */}
                      {constraintHint && formData.contractId && (
                        <div className={`rounded-lg border px-4 py-3 text-sm ${
                          contractConstraint?.allowed.length === 0
                            ? 'border-destructive/40 bg-destructive/5 text-destructive'
                            : 'border-amber-300 bg-amber-50 text-amber-800'
                        }`}>
                          {constraintHint}
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="inspection-type">{labels.type}</Label>
                          <Select
                            value={formData.type}
                            onValueChange={(value) => setFormData((current) => ({ ...current, type: value as InspectionType }))}
                            disabled={!contractConstraint || contractConstraint.allowed.length <= 1}
                          >
                            <SelectTrigger id="inspection-type"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(contractConstraint?.allowed ?? ['check-in']).map((value) => (
                                <SelectItem key={value} value={value}>{typeLabels[value as InspectionType]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="inspection-inspector">{labels.inspector}</Label>
                          <Input
                            id="inspection-inspector"
                            value={formData.inspectorName}
                            onChange={(e) => setFormData((current) => ({ ...current, inspectorName: e.target.value }))}
                            placeholder={language === 'pt' ? 'Nome do vistoriador' : 'Inspector name'}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="inspection-scheduled-date">{labels.scheduledDate}</Label>
                          <Input
                            id="inspection-scheduled-date"
                            type="date"
                            value={formData.scheduledDate}
                            onChange={(e) => setFormData((current) => ({ ...current, scheduledDate: e.target.value }))}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="inspection-title">{language === 'pt' ? 'Título (opcional)' : 'Title (optional)'}</Label>
                          <Input
                            id="inspection-title"
                            value={formData.title}
                            onChange={(e) => setFormData((current) => ({ ...current, title: e.target.value }))}
                            placeholder={language === 'pt' ? 'Ex.: Vistoria de entrada - Apto 203' : 'E.g. Move-in inspection - Apt 203'}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="inspection-summary">{labels.summary}</Label>
                        <Textarea
                          id="inspection-summary"
                          value={formData.summary}
                          onChange={(e) => setFormData((current) => ({ ...current, summary: e.target.value }))}
                          rows={3}
                          placeholder={language === 'pt' ? 'Resumo do estado do imóvel, pendências e próximos passos.' : 'Summarize property condition, pending issues and next steps.'}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── Step 2: checklist matrix ── */}
                  {formStep === 'fill-matrix' && (
                    <div className="space-y-4">
                      {/* Mode hint banner */}
                      <div className={`rounded-lg border px-4 py-2.5 text-sm ${
                        matrixMode === 'evaluate'
                          ? 'border-amber-300 bg-amber-50 text-amber-800'
                          : 'border-sky-200 bg-sky-50 text-sky-800'
                      }`}>
                        {matrixMode === 'evaluate' ? labels.evaluateModeHint : labels.structureModeHint}
                      </div>

                      {matrixEmptyMessage ? (
                        <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-6 text-center">
                          {matrixEmptyMessage}
                        </p>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                              {getIssueCount(formData)} {labels.issues}
                            </div>
                            {/* Add area only allowed in structure mode for non-room types */}
                            {matrixMode === 'structure' && !isRoomType && (
                              <Button
                                type="button"
                                variant="outline"
                                className="gap-2"
                                onClick={() => setFormData((current) => ({
                                  ...current,
                                  areas: [
                                    ...current.areas,
                                    {
                                      id: createId(),
                                      name: language === 'pt' ? 'Novo ambiente' : 'New area',
                                      notes: '',
                                      items: (selectedProperty?.inspectionItems || []).map((label) => ({
                                        id: createId(),
                                        label,
                                        condition: 'na' as InspectionItemCondition,
                                        notes: '',
                                      })),
                                    },
                                  ],
                                }))}
                              >
                                <Plus size={16} />
                                {labels.addArea}
                              </Button>
                            )}
                          </div>

                          {formData.areas.map((area) => (
                            <Card key={area.id} className="border-border/70">
                              <CardHeader className="pb-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] flex-1">
                                    <div className="space-y-2">
                                      <Label>{isRoomType ? (language === 'pt' ? 'Seção' : 'Section') : (language === 'pt' ? 'Ambiente' : 'Area')}</Label>
                                      {matrixMode === 'structure' ? (
                                        <Input
                                          value={area.name}
                                          onChange={(e) => upsertArea(area.id, (current) => ({ ...current, name: e.target.value }))}
                                        />
                                      ) : (
                                        <p className="text-sm font-semibold py-2 px-3 rounded-md border border-border bg-muted/50 text-muted-foreground">
                                          {area.name}
                                        </p>
                                      )}
                                    </div>
                                    {matrixMode === 'structure' && (
                                      <div className="space-y-2">
                                        <Label>{labels.areaNotes}</Label>
                                        <Input
                                          value={area.notes || ''}
                                          onChange={(e) => upsertArea(area.id, (current) => ({ ...current, notes: e.target.value }))}
                                        />
                                      </div>
                                    )}
                                  </div>
                                  {matrixMode === 'structure' && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => setFormData((current) => ({
                                        ...current,
                                        areas: current.areas.filter((item) => item.id !== area.id),
                                      }))}
                                    >
                                      <Trash size={16} />
                                    </Button>
                                  )}
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {area.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className={`grid gap-3 rounded-lg border border-border/70 p-3 ${
                                      matrixMode === 'structure'
                                        ? 'md:grid-cols-[minmax(0,1fr)_40px]'
                                        : 'md:grid-cols-[minmax(0,1.2fr)_200px_minmax(0,1fr)]'
                                    }`}
                                  >
                                    {matrixMode === 'structure' ? (
                                      /* Structure mode: editable label, no condition/notes */
                                      <>
                                        <Input
                                          value={item.label}
                                          onChange={(e) => upsertArea(area.id, (current) => ({
                                            ...current,
                                            items: current.items.map((entry) => entry.id === item.id ? { ...entry, label: e.target.value } : entry),
                                          }))}
                                        />
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="text-destructive hover:text-destructive"
                                          onClick={() => upsertArea(area.id, (current) => ({
                                            ...current,
                                            items: current.items.filter((entry) => entry.id !== item.id),
                                          }))}
                                        >
                                          <Trash size={14} />
                                        </Button>
                                      </>
                                    ) : (
                                      /* Evaluate mode: read-only label, condition + notes */
                                      <>
                                        <p className="text-sm py-2 px-3 rounded-md border border-border bg-muted/50 self-start">
                                          {item.label}
                                        </p>
                                        <Select
                                          value={item.condition}
                                          onValueChange={(value) => upsertArea(area.id, (current) => ({
                                            ...current,
                                            items: current.items.map((entry) => (
                                              entry.id === item.id ? { ...entry, condition: value as InspectionItemCondition } : entry
                                            )),
                                          }))}
                                        >
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            {Object.entries(conditionLabels).map(([value, label]) => (
                                              <SelectItem key={value} value={value}>{label}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Input
                                          value={item.notes || ''}
                                          placeholder={labels.itemNotes}
                                          onChange={(e) => upsertArea(area.id, (current) => ({
                                            ...current,
                                            items: current.items.map((entry) => entry.id === item.id ? { ...entry, notes: e.target.value } : entry),
                                          }))}
                                        />
                                      </>
                                    )}
                                  </div>
                                ))}
                                {matrixMode === 'structure' && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => upsertArea(area.id, (current) => ({
                                      ...current,
                                      items: [
                                        ...current.items,
                                        { id: createId(), label: language === 'pt' ? 'Novo item' : 'New item', condition: 'na', notes: '' },
                                      ],
                                    }))}
                                  >
                                    <Plus size={14} />
                                    {labels.addItem}
                                  </Button>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <DialogFooter className="border-t px-6 py-4">
                  {formStep === 'select-property-contract' ? (
                    <>
                      <Button type="button" variant="outline" onClick={resetForm}>
                        {labels.cancel}
                      </Button>
                      <Button
                        type="button"
                        disabled={!canContinue}
                        onClick={() => setFormStep('fill-matrix')}
                      >
                        {labels.continueToMatrix}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" variant="outline" onClick={() => setFormStep('select-property-contract')}>
                        {labels.backToSelection}
                      </Button>
                      <Button type="submit">{labels.save}</Button>
                    </>
                  )}
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={labels.search}
        />
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{labels.allProperties}</SelectItem>
            {(properties || []).map((property) => (
              <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!inspectionGroups.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ClipboardText size={64} weight="duotone" className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{labels.emptyTitle}</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">{labels.emptyDescription}</p>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus weight="bold" size={16} />
              {labels.add}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {inspectionGroups.map((group) => (
            <div key={group.root.id} className="rounded-2xl border border-border/80 bg-card/40 p-3 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {labels.linkedGroup}
                  </p>
                  <p className="text-sm font-medium text-foreground">{getContractLabel(group.root.contractId)}</p>
                </div>
                <Badge variant="outline">
                  {1 + group.children.length} {language === 'pt' ? 'vistorias' : 'inspections'}
                </Badge>
              </div>
              <div className="space-y-3">
          {[group.root, ...group.children].map((inspection, inspectionIndex, groupInspections) => {
            const issueCount = getIssueCount(inspection)
            const nextStatus = STATUS_NEXT[inspection.status]
            const canPdf = inspection.status === 'assessed'
            const canEdit = inspection.status !== 'assessed'
            const isGroupRoot = inspection.id === group.root.id
            const canCreateLinked = isGroupRoot &&
              inspection.type === 'check-in' &&
              (inspection.status === 'in-progress' || inspection.status === 'assessed')
            const previousInspection = inspectionIndex > 0 ? groupInspections[inspectionIndex - 1] : undefined
            const inspectionDifferences = isGroupRoot ? [] : getInspectionDifferences(inspection, previousInspection)

            return (
              <Card key={inspection.id} className={`hover:shadow-md transition-shadow ${isGroupRoot ? 'border-primary/30' : 'ml-4 border-dashed bg-background/70'}`}>
                <CardHeader className={isGroupRoot ? undefined : 'pb-3'}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <Badge variant="outline" className={isGroupRoot ? 'border-primary/40 text-primary' : ''}>
                        {isGroupRoot ? labels.mainInspection : typeLabels[inspection.type]}
                      </Badge>
                      {isGroupRoot ? (
                        <>
                          <CardTitle className="text-xl">{inspection.title}</CardTitle>
                          <CardDescription>{getPropertyName(inspection.propertyId)}</CardDescription>
                        </>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{format(new Date(inspection.scheduledDate), 'dd/MM/yyyy')}</span>
                          <span>•</span>
                          <span>{inspectionDifferences.length} {language === 'pt' ? 'diferença(s)' : 'difference(s)'}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusClass(inspection.status)}>
                        {statusLabels[inspection.status]}
                      </Badge>
                      {isGroupRoot && <Badge variant="outline">{typeLabels[inspection.type]}</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={isGroupRoot ? 'space-y-4' : 'space-y-3 pt-0'}>
                  <div className={isGroupRoot ? 'grid gap-3 md:grid-cols-2' : 'grid gap-3'}>
                    {isGroupRoot && (
                      <>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">{labels.inspector}</p>
                          <p className="text-sm font-medium">{inspection.inspectorName}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">{labels.scheduledDate}</p>
                          <p className="text-sm font-medium">{format(new Date(inspection.scheduledDate), 'dd/MM/yyyy')}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">{labels.contract}</p>
                          <p className="text-sm font-medium">{getContractLabel(inspection.contractId)}</p>
                        </div>
                      </>
                    )}
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        {isGroupRoot ? labels.issues : labels.comparedToPrevious}
                      </p>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {(isGroupRoot ? issueCount : inspectionDifferences.length) > 0
                          ? <WarningCircle size={16} className="text-amber-600" />
                          : <CheckCircle size={16} className="text-emerald-600" />}
                        {isGroupRoot ? issueCount : inspectionDifferences.length}
                      </div>
                    </div>
                  </div>

                  {inspection.summary && (
                    <div className={`rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground ${!isGroupRoot ? 'line-clamp-2' : ''}`}>
                      {inspection.summary}
                    </div>
                  )}

                  {isGroupRoot ? (
                    <div className="space-y-2">
                      {inspection.areas.slice(0, 3).map((area) => {
                      const highlighted = area.items.filter((item) => item.condition === 'attention' || item.condition === 'damaged')
                      return (
                        <div key={area.id} className="rounded-lg border border-border/70 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{area.name}</p>
                            <span className="text-xs text-muted-foreground">{area.items.length} {labels.items}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(highlighted.length ? highlighted : area.items.slice(0, 2)).map((item) => (
                              <Badge key={item.id} variant="outline" className={getConditionClass(item.condition)}>
                                {item.label}: {conditionLabels[item.condition]}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )
                      })}
                      {inspection.areas.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{inspection.areas.length - 3} {language === 'pt' ? 'seções adicionais' : 'additional sections'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {inspectionDifferences.length === 0 ? (
                        <p className="rounded-lg border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
                          {labels.noDifferences}
                        </p>
                      ) : (
                        inspectionDifferences.slice(0, 4).map((difference) => (
                          <div key={`${difference.areaName}-${difference.itemLabel}`} className="rounded-lg border border-border/70 p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{difference.areaName}</span>
                                <span className="text-muted-foreground">•</span>
                                <span>{difference.itemLabel}</span>
                              </div>
                              {isNegativeDifference(difference) && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1.5"
                                  onClick={() => handleCreateTaskFromDifference(inspection, difference)}
                                >
                                  <CheckSquare size={14} />
                                  {labels.createTask}
                                </Button>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {difference.previousCondition && (
                                <Badge variant="outline" className={getConditionClass(difference.previousCondition)}>
                                  {labels.previous}: {conditionLabels[difference.previousCondition]}
                                </Badge>
                              )}
                              <Badge variant="outline" className={getConditionClass(difference.currentCondition)}>
                                {labels.current}: {conditionLabels[difference.currentCondition]}
                              </Badge>
                            </div>
                            {difference.currentNotes && (
                              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{difference.currentNotes}</p>
                            )}
                          </div>
                        ))
                      )}
                      {inspectionDifferences.length > 4 && (
                        <p className="text-xs text-muted-foreground">
                          +{inspectionDifferences.length - 4} {language === 'pt' ? 'diferenças adicionais' : 'additional differences'}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {/* Advance status: draft → in-progress, in-progress → assessed */}
                    {nextStatus && (
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => handleAdvanceStatus(inspection)}
                      >
                        <Play size={15} weight="fill" />
                        {nextStatus === 'in-progress' ? labels.advanceDraft : labels.advanceInProgress}
                      </Button>
                    )}

                    {/* Back to draft from in-progress */}
                    {inspection.status === 'in-progress' && (
                      <Button
                        variant="outline"
                        className="gap-2 text-muted-foreground"
                        onClick={() => handleBackToDraft(inspection)}
                      >
                        <ArrowCounterClockwise size={15} />
                        {labels.backToDraft}
                      </Button>
                    )}

                    {/* Create linked inspection from a check-in card */}
                    {canCreateLinked && (
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => handleOpenLinked(inspection)}
                      >
                        <LinkSimple size={15} />
                        {labels.createLinked}
                      </Button>
                    )}

                    {/* Edit only for draft and in-progress */}
                    {canEdit && (
                      <Button variant="outline" className="gap-2" onClick={() => handleEdit(inspection)}>
                        <PencilSimple size={16} />
                        {labels.edit}
                      </Button>
                    )}

                    {/* PDF button: always visible, disabled with tooltip if not assessed */}
                    <span
                      title={!canPdf ? labels.pdfNeedsAssessed : undefined}
                      className="inline-flex"
                    >
                      <Button
                        variant="outline"
                        className="gap-2"
                        disabled={!canPdf || generatingPdfId === inspection.id}
                        onClick={() => handleGeneratePDF(inspection)}
                      >
                        <FilePdf size={16} />
                        {generatingPdfId === inspection.id ? labels.generatingPdf : labels.generatePdf}
                      </Button>
                    </span>

                    <Button
                      variant="outline"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(inspection.id)}
                    >
                      <Trash size={16} />
                      {labels.delete}
                    </Button>
                  </div>
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
