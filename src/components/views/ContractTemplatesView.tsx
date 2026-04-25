import { useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useKV } from '@/lib/useSupabaseKV'


import { HelpButton } from '@/components/HelpButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Pencil, Trash, Copy, MagnifyingGlass, Question, Brain } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Contract, ContractTemplate, Guest, Owner, Property, TEMPLATE_LANGUAGES, TemplateLanguage, TemplateType } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import { useCurrency } from '@/lib/CurrencyContext'
import { useDateFormat } from '@/lib/DateFormatContext'
import RichTextEditor, { plainTextToHTML, RichTextEditorHandle } from '@/components/RichTextEditor'
import { buildTemplateXPathContext, renderContractTemplateContent, resolveTemplateXPath, TemplateXPathContext } from '@/lib/contractPDF'
import { getContractSelectionLabel } from '@/lib/contractLabels'
import { TemplateDocumentImportDialog, type TemplateDocumentImportResult } from '@/components/TemplateDocumentImportDialog'

type XPathPreviewRow = {
  path: string
  value: string
}

const NO_PREVIEW_CONTRACT_VALUE = '__none__'

function stringifyPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function collectXPathPreviewRows(
  value: unknown,
  basePath: string,
  rows: XPathPreviewRow[],
  depth = 0,
  maxDepth = 5
) {
  if (rows.length >= 250) return

  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    rows.push({ path: basePath, value: stringifyPreviewValue(value) })
    return
  }

  if (depth >= maxDepth) {
    rows.push({ path: basePath, value: stringifyPreviewValue(value) })
    return
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      rows.push({ path: basePath, value: '[]' })
      return
    }
    value.forEach((item, index) => {
      collectXPathPreviewRows(item, `${basePath}{${index + 1}}`, rows, depth + 1, maxDepth)
    })
    return
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.length === 0) {
    rows.push({ path: basePath, value: '{}' })
    return
  }

  keys.forEach((key) => {
    collectXPathPreviewRows(record[key], `${basePath}.${key}`, rows, depth + 1, maxDepth)
  })
}

function isHTML(content: string) {
  return /<[a-z][\s\S]*>/i.test(content)
}

export default function ContractTemplatesView() {
  const { t, language } = useLanguage()
  const { formatCurrency } = useCurrency()
  const { formatDate } = useDateFormat()
  const [templates, setTemplates] = useKV<ContractTemplate[]>('contract-templates', [])
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [owners] = useKV<Owner[]>('owners', [])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [pendingTranslation, setPendingTranslation] = useState<{ sourceTemplate: ContractTemplate; targetLanguage: TemplateLanguage } | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [languageFilter, setLanguageFilter] = useState<TemplateLanguage | 'all'>(language === 'en' ? 'en' : 'pt')
  const [selectedPreviewContractId, setSelectedPreviewContractId] = useState(NO_PREVIEW_CONTRACT_VALUE)
  const [isAiImportDialogOpen, setIsAiImportDialogOpen] = useState(false)
  const [editorTab, setEditorTab] = useState<'template' | 'preview'>('template')
  const [xpathInput, setXpathInput] = useState('')
  const [xpathTableFilter, setXpathTableFilter] = useState('')
  const editorRef = useRef<RichTextEditorHandle | null>(null)
  const xpathTableFilterInputRef = useRef<HTMLInputElement | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'monthly' as TemplateType,
    language: (language === 'en' ? 'en' : 'pt') as TemplateLanguage,
    translationGroupId: '',
    content: '',
  })

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'monthly' as TemplateType,
      language: (language === 'en' ? 'en' : 'pt') as TemplateLanguage,
      translationGroupId: '',
      content: '',
    })
    setEditingTemplate(null)
    setEditorTab('template')
    setXpathTableFilter('')
  }

  const getLanguageLabel = (code: TemplateLanguage) => {
    const found = TEMPLATE_LANGUAGES.find((l) => l.code === code)
    return found ? found.nativeName : code.toUpperCase()
  }

  const getLanguagesAvailableForGroup = (translationGroupId: string): TemplateLanguage[] =>
    (templates || [])
      .filter((t) => t.translationGroupId === translationGroupId)
      .map((t) => t.language)

  const handleAddTranslation = (template: ContractTemplate, targetLanguage: TemplateLanguage) => {
    const alreadyExists = (templates || []).some(
      (item) => item.translationGroupId === template.translationGroupId && item.language === targetLanguage
    )
    if (alreadyExists) {
      toast.error(`Já existe uma tradução em ${getLanguageLabel(targetLanguage)}`)
      return
    }
    const newTemplate: ContractTemplate = {
      ...template,
      id: Date.now().toString(),
      language: targetLanguage,
      name: `${template.name} (${getLanguageLabel(targetLanguage)})`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setTemplates((current) => [...(current || []), newTemplate])
    toast.success(`Tradução criada em ${getLanguageLabel(targetLanguage)}`)
  }

  const handleAddTranslationWithAI = async (sourceTemplate: ContractTemplate, targetLanguage: TemplateLanguage) => {
    setIsTranslating(true)
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'translate-template',
          content: sourceTemplate.content,
          fromLanguage: sourceTemplate.language,
          toLanguage: targetLanguage,
        },
      })

      if (error) throw new Error(error.message || 'Falha ao traduzir')
      if (data?.error) throw new Error(data.error)
      if (!data?.translatedContent) throw new Error('A IA não retornou conteúdo traduzido')

      const alreadyExists = (templates || []).some(
        (item) => item.translationGroupId === sourceTemplate.translationGroupId && item.language === targetLanguage
      )
      if (alreadyExists) {
        toast.error(`Já existe uma tradução em ${getLanguageLabel(targetLanguage)}`)
        setPendingTranslation(null)
        return
      }

      const newTemplate: ContractTemplate = {
        ...sourceTemplate,
        id: Date.now().toString(),
        language: targetLanguage,
        name: `${sourceTemplate.name} (${getLanguageLabel(targetLanguage)})`,
        content: data.translatedContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setTemplates((current) => [...(current || []), newTemplate])
      setPendingTranslation(null)
      toast.success(`Tradução em ${getLanguageLabel(targetLanguage)} criada com IA`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao traduzir template')
    } finally {
      setIsTranslating(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const shouldKeepOpen = submitter?.value === 'continue'

    if (editingTemplate) {
      setTemplates((currentTemplates) =>
        (currentTemplates || []).map((t) =>
          t.id === editingTemplate.id
            ? {
                ...t,
                ...formData,
                updatedAt: new Date().toISOString(),
              }
            : t
        )
      )
      toast.success(shouldKeepOpen ? 'Template salvo. Continue editando.' : 'Template atualizado com sucesso')
    } else {
      const newTemplate: ContractTemplate = {
        id: Date.now().toString(),
        ...formData,
        translationGroupId: formData.translationGroupId || Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setTemplates((currentTemplates) => [...(currentTemplates || []), newTemplate])
      if (shouldKeepOpen) {
        setEditingTemplate(newTemplate)
        toast.success('Template salvo. Continue editando.')
      } else {
        toast.success('Template criado com sucesso')
      }
    }

    if (!shouldKeepOpen) {
      setDialogOpen(false)
      resetForm()
    } else {
      restoreEditorFocus()
    }
  }

  const handleEdit = (template: ContractTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      type: template.type,
      language: template.language,
      translationGroupId: template.translationGroupId,
      content: plainTextToHTML(template.content),
    })
    setDialogOpen(true)
    setEditorTab('template')
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return
    setTemplates((currentTemplates) => (currentTemplates || []).filter((t) => t.id !== id))
    toast.success('Template excluído com sucesso')
  }

  const handleDuplicate = (template: ContractTemplate) => {
    const newTemplate: ContractTemplate = {
      ...template,
      id: Date.now().toString(),
      name: `${template.name} (Cópia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setTemplates((currentTemplates) => [...(currentTemplates || []), newTemplate])
    toast.success('Template duplicado com sucesso')
  }


  const translationSources = useMemo(() => {
    if (!editingTemplate || !formData.translationGroupId) return []
    return (templates || []).filter(
      (t) => t.translationGroupId === formData.translationGroupId && t.language !== formData.language
    )
  }, [templates, editingTemplate, formData.translationGroupId, formData.language])

  const handleTranslateFrom = async (sourceTemplate: ContractTemplate) => {
    setIsTranslating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão inválida')

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'translate-template',
          content: sourceTemplate.content,
          fromLanguage: sourceTemplate.language,
          toLanguage: formData.language,
        },
      })

      if (error) throw new Error(error.message || 'Falha ao traduzir')
      if (data?.error) throw new Error(data.error)
      if (!data?.translatedContent) throw new Error('A IA não retornou conteúdo traduzido')

      setFormData((current) => ({ ...current, content: data.translatedContent }))
      toast.success(`Tradução de ${getLanguageLabel(sourceTemplate.language)} aplicada`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao traduzir template')
    } finally {
      setIsTranslating(false)
    }
  }

  const handleInsertVariable = (token: string) => {
    setHelpDialogOpen(false)

    if (editorRef.current) {
      editorRef.current.insertTokenAtCursor(token)
    } else {
      setFormData((current) => ({
        ...current,
        content: `${current.content || '<p></p>'}<p>${token}</p>`,
      }))
    }

    restoreEditorFocus()
    toast.success(`Variável inserida: ${token}`)
  }

  const handleCopyXPathToken = async () => {
    const trimmedXPath = xpathInput.trim()
    if (!trimmedXPath) {
      toast.error('Digite um XPath para copiar')
      return
    }

    const token = `{{${trimmedXPath}}}`
    try {
      await navigator.clipboard.writeText(token)
      toast.success(`XPath copiado: ${token}`)
    } catch {
      toast.error('Não foi possível copiar o XPath')
    }
  }

  const handleInsertXPathToken = () => {
    const trimmedXPath = xpathInput.trim()
    if (!trimmedXPath) {
      toast.error('Digite um XPath para inserir')
      return
    }

    handleInsertVariable(`{{${trimmedXPath}}}`)
  }

  const restoreEditorFocus = () => {
    // Wait for dialog focus trap teardown before restoring cursor/focus.
    setTimeout(() => {
      editorRef.current?.focusAtLastSelection()
    }, 80)
  }

  const filteredTemplates = (templates || []).filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.type.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLanguage = languageFilter === 'all' || template.language === languageFilter
    return matchesSearch && matchesLanguage
  })

  const helpContractOptions = useMemo(
    () => (contracts || []).map((contract) => {
      return {
        id: contract.id,
        label: getContractSelectionLabel(contract, properties || []),
      }
    }),
    [contracts, properties]
  )

  const selectedPreviewContract = useMemo(
    () => {
      if (selectedPreviewContractId === NO_PREVIEW_CONTRACT_VALUE) return null
      return (contracts || []).find((contract) => contract.id === selectedPreviewContractId) || null
    },
    [contracts, selectedPreviewContractId]
  )

  const selectedContractForPreview = selectedPreviewContract

  const selectedHelpContractData = useMemo(() => {
    if (!selectedContractForPreview) return null

    const contractGuest = (guests || []).find((guest) => guest.id === selectedContractForPreview.guestId)
    if (!contractGuest) return null

    const contractProperties = (properties || []).filter((property) =>
      selectedContractForPreview.propertyIds.includes(property.id)
    )

    const propertyOwnerIds = new Set<string>()
    contractProperties.forEach((property) => {
      property.ownerIds?.forEach((ownerId) => propertyOwnerIds.add(ownerId))
    })

    const contractOwners = (owners || []).filter((owner) => propertyOwnerIds.has(owner.id))

    const templateForPreview: ContractTemplate = {
      id: editingTemplate?.id || 'preview-template',
      name: formData.name || editingTemplate?.name || 'Preview Template',
      type: formData.type,
      content: formData.content || '',
      createdAt: editingTemplate?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return {
      contract: selectedContractForPreview,
      guest: contractGuest,
      properties: contractProperties,
      owners: contractOwners,
      template: templateForPreview,
    }
  }, [selectedContractForPreview, guests, properties, owners, editingTemplate, formData.name, formData.type, formData.content])

  const xpathContext = useMemo<TemplateXPathContext | null>(() => {
    if (!selectedHelpContractData) return null

    return buildTemplateXPathContext(
      selectedHelpContractData,
      formatDate,
      formatCurrency
    )
  }, [selectedHelpContractData, formatCurrency, formatDate])

  const xpathPreview = useMemo(() => {
    if (!xpathInput.trim()) return ''
    if (!xpathContext) return 'Selecione um contrato para testar o XPath.'
    const resolved = resolveTemplateXPath(xpathInput.trim(), xpathContext)
    return resolved.error || resolved.value
  }, [xpathInput, xpathContext])

  const inlineTokenPreviewResolver = useMemo<((xpath: string) => string | null) | null>(() => {
    if (!xpathContext || !selectedContractForPreview) return null

    return (xpath: string) => {
      const resolved = resolveTemplateXPath(xpath.trim(), xpathContext)
      if (resolved.error) return null
      return resolved.value
    }
  }, [xpathContext, selectedContractForPreview])

  const xpathPreviewRows = useMemo(() => {
    if (!xpathContext) return [] as XPathPreviewRow[]

    const rows: XPathPreviewRow[] = []
    const tables = ['contract', 'guest', 'properties', 'owners']
    tables.forEach((tableName) => {
      collectXPathPreviewRows(xpathContext[tableName], tableName, rows)
    })
    return rows
  }, [xpathContext])

  const filteredXPathPreviewRows = useMemo(() => {
    const query = xpathTableFilter.trim().toLowerCase()
    if (!query) return xpathPreviewRows

    return xpathPreviewRows.filter((row) =>
      row.path.toLowerCase().includes(query)
      || row.value.toLowerCase().includes(query)
    )
  }, [xpathPreviewRows, xpathTableFilter])

  const renderedPreviewContent = useMemo(() => {
    if (!selectedHelpContractData) return ''
    return renderContractTemplateContent(
      selectedHelpContractData,
      formatCurrency,
      formatDate
    )
  }, [selectedHelpContractData, formatCurrency, formatDate])

  const templateAvailablePaths = useMemo(() => {
    if (xpathPreviewRows.length > 0) {
      return Array.from(new Set(xpathPreviewRows.map((row) => row.path))).slice(0, 300)
    }

    return [
      'guest.name',
      'guest.email',
      'guest.phone',
      'guest.documents{1}.number',
      'owners{1}.name',
      'owners{1}.documents{1}.number',
      'properties{1}.name',
      'properties{1}.address',
      'contract.startDate',
      'contract.endDate',
      'contract.monthlyAmount',
      'currentDate',
    ]
  }, [xpathPreviewRows])

  const handleTemplateAiImportApplied = (result: TemplateDocumentImportResult) => {
    setFormData((current) => ({
      ...current,
      content: result.content,
    }))
    setEditorTab('template')
    restoreEditorFocus()
    toast.success(`Conteúdo do template atualizado pela IA (${Math.round(result.confidence * 100)}%)`)
  }

  const handleOpenAiImportFromTemplatesScreen = () => {
    if (!dialogOpen) {
      resetForm()
      setDialogOpen(true)
    }

    setEditorTab('template')
    setTimeout(() => setIsAiImportDialogOpen(true), 80)
  }

  const getTypeBadgeClass = (type: TemplateType) => {
    return type === 'monthly' 
      ? 'bg-primary text-primary-foreground' 
      : 'bg-accent text-accent-foreground'
  }

  const getTypeLabel = (type: TemplateType) => {
    return type === 'monthly' ? 'Mensal' : 'Temporário'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-2xl font-bold">Templates de Contrato</h2>
            <HelpButton docKey="contract-templates" title="Ajuda — Templates de Contrato" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie modelos de contratos reutilizáveis
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={handleOpenAiImportFromTemplatesScreen}>
            <Brain weight="duotone" size={18} className="mr-2" />
            Importar template por IA
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) {
              resetForm()
              setSelectedPreviewContractId(NO_PREVIEW_CONTRACT_VALUE)
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus weight="bold" size={18} className="mr-2" />
                Novo Template
              </Button>
            </DialogTrigger>
            <DialogContent className="flex flex-col p-0 gap-0 overflow-hidden max-h-[96vh] w-[min(96vw,1300px)] max-w-none">
              <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                <DialogTitle className="flex items-center gap-1">
                  {editingTemplate ? 'Editar Template' : 'Novo Template'}
                  <HelpButton docKey="form-template" title="Ajuda — Formulário de Template" />
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Template</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Dialog open={helpDialogOpen} onOpenChange={(open) => {
                      if (open) {
                        editorRef.current?.captureCurrentSelection()
                        setTimeout(() => {
                          xpathTableFilterInputRef.current?.focus()
                        }, 50)
                      }
                      setHelpDialogOpen(open)
                      if (!open) {
                        setXpathInput('')
                        restoreEditorFocus()
                      }
                    }}>
                    <Tabs value={editorTab} onValueChange={(value) => setEditorTab(value as 'template' | 'preview')}>
                      {/* Single toolbar row */}
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div className="flex flex-wrap items-end gap-2 min-w-0">
                          <div className="space-y-1 w-40 shrink-0">
                            <Label htmlFor="type">Tipo de Contrato</Label>
                            <Select
                              value={formData.type}
                              onValueChange={(value) => setFormData({ ...formData, type: value as TemplateType })}
                            >
                              <SelectTrigger id="type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="monthly">Mensal</SelectItem>
                                <SelectItem value="short-term">Temporário</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1 w-40 shrink-0">
                            <Label htmlFor="language">Idioma</Label>
                            <Select
                              value={formData.language}
                              onValueChange={(value) => setFormData({ ...formData, language: value as TemplateLanguage })}
                            >
                              <SelectTrigger id="language">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {TEMPLATE_LANGUAGES.map((lang) => (
                                  <SelectItem key={lang.code} value={lang.code}>
                                    {lang.nativeName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1 w-[360px] max-w-[45vw] min-w-0">
                            <Label htmlFor="preview-contract">Contrato base para preview</Label>
                            <Select value={selectedPreviewContractId} onValueChange={setSelectedPreviewContractId}>
                              <SelectTrigger id="preview-contract">
                                <SelectValue placeholder="Selecione um contrato" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NO_PREVIEW_CONTRACT_VALUE}>Sem contrato base (sem preview)</SelectItem>
                                {helpContractOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="ml-auto flex flex-wrap items-end justify-end gap-2">
                          <div className="space-y-1">
                            <Label>Conteúdo do Contrato</Label>
                            <TabsList className="shrink-0">
                              <TabsTrigger value="template">Template</TabsTrigger>
                              <TabsTrigger value="preview">Preview</TabsTrigger>
                            </TabsList>
                          </div>
                          {translationSources.length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="shrink-0"
                                  disabled={isTranslating}
                                >
                                  {isTranslating ? 'Traduzindo...' : 'Traduzir de...'}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {translationSources.map((src) => (
                                  <DropdownMenuItem
                                    key={src.id}
                                    onClick={() => void handleTranslateFrom(src)}
                                  >
                                    {getLanguageLabel(src.language)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          <DialogTrigger asChild>
                            <Button
                              type="button"
                              className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                              onMouseDown={() => editorRef.current?.captureCurrentSelection()}
                            >
                              <Question size={16} className="mr-2" />
                              Ajuda: Variáveis
                            </Button>
                          </DialogTrigger>
                        </div>
                      </div>

                      {/* Editor / Preview — same fixed height */}
                      <TabsContent value="template" className="mt-3">
                        <div className="h-[50vh]">
                          <RichTextEditor
                            ref={editorRef}
                            content={formData.content}
                            onChange={(html) => setFormData({ ...formData, content: html })}
                            tokenPreviewResolver={inlineTokenPreviewResolver}
                          />
                        </div>
                      </TabsContent>
                      <TabsContent value="preview" className="mt-3">
                        <div className="h-[50vh] overflow-auto rounded-md border bg-white p-4 text-sm leading-relaxed text-foreground [&_p]:my-1 [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_[style*='text-align:center']]:text-center [&_[style*='text-align:right']]:text-right [&_[style*='text-align:justify']]:text-justify">
                          {!selectedContractForPreview && (
                            <p className="text-muted-foreground">Selecione um contrato base para visualizar o preview em tempo real.</p>
                          )}
                          {selectedContractForPreview && !renderedPreviewContent && (
                            <p className="text-muted-foreground">Preview indisponível para o contrato selecionado.</p>
                          )}
                          {selectedContractForPreview && renderedPreviewContent && (
                            isHTML(renderedPreviewContent)
                              ? <div dangerouslySetInnerHTML={{ __html: renderedPreviewContent }} />
                              : <pre className="text-xs whitespace-pre-wrap font-mono">{renderedPreviewContent}</pre>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>

                    <DialogContent
                      className="max-w-3xl max-h-[85vh] overflow-y-hidden p-0"
                      onCloseAutoFocus={(event) => {
                        // Keep focus restoration under our control.
                        event.preventDefault()
                      }}
                    >
                    <DialogHeader className="px-6 pt-6 pb-3 pr-12 border-b bg-background">
                      <DialogTitle>Variáveis disponíveis no template</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 px-6 pb-6 overflow-y-auto max-h-[calc(85vh-76px)]">
                      <div className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
                        {'Use tokens no formato {{xpath}}. O caminho segue a estrutura tabela{indice}.coluna{indice}.subcoluna, com índices começando em 1. Exemplo: {{owners{1}.documents{1}.number}}. Para não inventar variáveis, use a lista abaixo como fonte de verdade dos caminhos disponíveis no contrato selecionado.'}
                      </div>

                      <div className="grid gap-3 rounded-md border p-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>XPath</Label>
                            <Input
                              value={xpathInput}
                              onChange={(e) => setXpathInput(e.target.value)}
                              placeholder="Ex.: owners{1}.documents{1}.number"
                            />
                            <p className="text-xs text-muted-foreground">
                              O token inserido no template será: {'{{seu_xpath}}'}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label>Preview do valor</Label>
                            <div className="max-h-32 overflow-auto rounded border bg-muted/40 px-3 py-2">
                              <p className="font-mono text-xs whitespace-pre-wrap break-all">{xpathPreview || 'Digite um XPath para visualizar o valor'}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyXPathToken()}>
                            Copiar XPath
                          </Button>
                          <Button type="button" size="sm" onClick={handleInsertXPathToken}>
                            Inserir no template
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-md border p-3">
                        <p className="text-sm font-medium mb-2">Caminhos e valores do contrato selecionado</p>
                        <div className="relative mb-3">
                          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                          <Input
                            ref={xpathTableFilterInputRef}
                            value={xpathTableFilter}
                            onChange={(e) => setXpathTableFilter(e.target.value)}
                            placeholder="Filtrar caminhos e valores..."
                            className="pl-9"
                          />
                        </div>
                        {!selectedContractForPreview && (
                          <p className="text-sm text-muted-foreground">Selecione um contrato para carregar os dados de referência.</p>
                        )}
                        {selectedContractForPreview && xpathPreviewRows.length === 0 && (
                          <p className="text-sm text-muted-foreground">Não foi possível montar os dados desse contrato.</p>
                        )}
                        {selectedContractForPreview && xpathPreviewRows.length > 0 && filteredXPathPreviewRows.length === 0 && (
                          <p className="text-sm text-muted-foreground">Nenhum caminho encontrado para esse filtro.</p>
                        )}
                        {filteredXPathPreviewRows.length > 0 && (
                          <div className="max-h-64 overflow-auto space-y-2">
                            {filteredXPathPreviewRows.map((row) => (
                              <button
                                key={row.path}
                                type="button"
                                className="block w-full rounded border bg-muted/20 px-2 py-1 text-left transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary"
                                onClick={() => setXpathInput(row.path)}
                                onDoubleClick={() => {
                                  setXpathInput(row.path)
                                  handleInsertVariable(`{{${row.path}}}`)
                                }}
                                title="Usar este XPath"
                              >
                                <p className="font-mono text-xs font-semibold break-all">{row.path}</p>
                                <p className="font-mono text-xs text-muted-foreground whitespace-pre-wrap break-all">{row.value || '(vazio)'}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                  </Dialog>
                </div>

                </div>
                <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0 bg-background">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="outline" name="submit-intent" value="continue">
                    Salvar e continuar
                  </Button>
                  <Button type="submit">
                    {editingTemplate ? 'Salvar e fechar' : t.common.create}
                  </Button>
                </div>
              </form>

              <TemplateDocumentImportDialog
                open={isAiImportDialogOpen}
                onOpenChange={setIsAiImportDialogOpen}
                templateContent={formData.content}
                availablePaths={templateAvailablePaths}
                onApply={handleTemplateAiImportApplied}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Buscar templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-48 shrink-0">
          <Select
            value={languageFilter}
            onValueChange={(value) => setLanguageFilter(value as TemplateLanguage | 'all')}
          >
            <SelectTrigger>
              <SelectValue placeholder="Idioma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os idiomas</SelectItem>
              {TEMPLATE_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.nativeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredTemplates.length === 0 && !searchQuery && (
        <Card className="border-dashed">
          <CardHeader className="text-center py-12">
            <CardTitle className="text-muted-foreground font-normal">
              Nenhum template criado
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Clique em "Novo Template" para criar um modelo de contrato
            </p>
          </CardHeader>
        </Card>
      )}

      {filteredTemplates.length === 0 && searchQuery && (
        <Card className="border-dashed">
          <CardHeader className="text-center py-12">
            <CardTitle className="text-muted-foreground font-normal">
              Nenhum resultado encontrado
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Tente buscar com outros termos
            </p>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle className="text-xl">{template.name}</CardTitle>
                    <Badge className={getTypeBadgeClass(template.type)}>
                      {getTypeLabel(template.type)}
                    </Badge>
                    <Badge variant="outline">
                      {getLanguageLabel(template.language)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Criado em {new Date(template.createdAt).toLocaleDateString('pt-BR')}
                    {template.updatedAt !== template.createdAt && 
                      ` • Atualizado em ${new Date(template.updatedAt).toLocaleDateString('pt-BR')}`
                    }
                  </p>
                </div>
                <div className="flex gap-2 ml-4 items-center">
                  {(() => {
                    const usedLanguages = getLanguagesAvailableForGroup(template.translationGroupId)
                    const availableToAdd = TEMPLATE_LANGUAGES.filter((l) => !usedLanguages.includes(l.code))
                    if (availableToAdd.length === 0) return null
                    return (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1 text-xs">
                            + Tradução
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {availableToAdd.map((lang) => (
                            <DropdownMenuItem
                              key={lang.code}
                              onClick={() => setPendingTranslation({ sourceTemplate: template, targetLanguage: lang.code })}
                            >
                              {lang.nativeName}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  })()}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDuplicate(template)}
                    title="Duplicar"
                  >
                    <Copy size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(template)}
                    title="Editar"
                  >
                    <Pencil size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(template.id)}
                    title="Excluir"
                  >
                    <Trash size={18} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mt-3 p-4 bg-white border rounded-md max-h-64 overflow-y-auto text-sm leading-relaxed text-foreground [&_p]:my-1 [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_[style*='text-align:center']]:text-center [&_[style*='text-align:right']]:text-right [&_[style*='text-align:justify']]:text-justify">
                {isHTML(template.content)
                  ? <div dangerouslySetInnerHTML={{ __html: template.content }} />
                  : <pre className="text-xs whitespace-pre-wrap font-mono">{template.content}</pre>
                }
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {pendingTranslation && (
        <Dialog open onOpenChange={(open) => { if (!open && !isTranslating) setPendingTranslation(null) }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                Criar tradução em {getLanguageLabel(pendingTranslation.targetLanguage)}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Como deseja criar a tradução a partir de {getLanguageLabel(pendingTranslation.sourceTemplate.language)}?
            </p>
            <div className="flex flex-col gap-2 mt-2">
              <Button
                variant="outline"
                disabled={isTranslating}
                onClick={() => {
                  handleAddTranslation(pendingTranslation.sourceTemplate, pendingTranslation.targetLanguage)
                  setPendingTranslation(null)
                }}
              >
                Copiar conteúdo
              </Button>
              <Button
                disabled={isTranslating}
                onClick={() => void handleAddTranslationWithAI(pendingTranslation.sourceTemplate, pendingTranslation.targetLanguage)}
              >
                {isTranslating ? 'Traduzindo...' : 'Traduzir com IA'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
