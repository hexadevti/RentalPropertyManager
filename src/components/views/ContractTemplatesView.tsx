import { useMemo, useRef, useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Pencil, Trash, Copy, MagnifyingGlass, Question } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Contract, ContractTemplate, Guest, Owner, Property, TemplateType } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import { useCurrency } from '@/lib/CurrencyContext'
import { useDateFormat } from '@/lib/DateFormatContext'
import RichTextEditor, { plainTextToHTML, RichTextEditorHandle } from '@/components/RichTextEditor'
import { buildTemplateXPathContext, renderContractTemplateContent, resolveTemplateXPath, TemplateXPathContext } from '@/lib/contractPDF'

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
  const { t } = useLanguage()
  const { formatCurrency } = useCurrency()
  const { formatDate } = useDateFormat()
  const [templates, setTemplates] = useKV<ContractTemplate[]>('contract-templates', [])
  const [contracts] = useKV<Contract[]>('contracts', [])
  const [guests] = useKV<Guest[]>('guests', [])
  const [properties] = useKV<Property[]>('properties', [])
  const [owners] = useKV<Owner[]>('owners', [])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPreviewContractId, setSelectedPreviewContractId] = useState(NO_PREVIEW_CONTRACT_VALUE)
  const [editorTab, setEditorTab] = useState<'template' | 'preview'>('template')
  const [xpathInput, setXpathInput] = useState('')
  const [xpathTableFilter, setXpathTableFilter] = useState('')
  const editorRef = useRef<RichTextEditorHandle | null>(null)
  const xpathTableFilterInputRef = useRef<HTMLInputElement | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'monthly' as TemplateType,
    content: '',
  })

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'monthly' as TemplateType,
      content: '',
    })
    setEditingTemplate(null)
    setEditorTab('template')
    setXpathTableFilter('')
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
      content: plainTextToHTML(template.content),
    })
    setDialogOpen(true)
    setEditorTab('template')
  }

  const handleDelete = (id: string) => {
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

  const filteredTemplates = (templates || []).filter((template) =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.type.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const helpContractOptions = useMemo(
    () => (contracts || []).map((contract) => {
      const contractGuest = (guests || []).find((guest) => guest.id === contract.guestId)
      return {
        id: contract.id,
        label: `${contractGuest?.name || 'Hóspede não encontrado'} • ${contract.id.slice(0, 8)}`,
      }
    }),
    [contracts, guests]
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
          <h2 className="text-2xl font-bold">Templates de Contrato</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie modelos de contratos reutilizáveis
          </p>
        </div>
        <div className="flex gap-2">
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
            <DialogContent className="w-[min(96vw,1300px)] max-w-none max-h-[96vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? 'Editar Template' : 'Novo Template'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                      <div className="flex items-end justify-between gap-3">
                        <div className="flex items-end gap-2 min-w-0">
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

                        <div className="ml-auto flex items-end gap-2 shrink-0">
                          <div className="space-y-1">
                            <Label>Conteúdo do Contrato</Label>
                            <TabsList className="shrink-0">
                              <TabsTrigger value="template">Template</TabsTrigger>
                              <TabsTrigger value="preview">Preview</TabsTrigger>
                            </TabsList>
                          </div>
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
                        {'Os templates agora aceitam XPath baseado nos objetos do contrato no formato: tabela{indice}.coluna{indice}.subcoluna. Exemplo: owners{1}.documents{1}.number.'}
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
                        <p className="text-sm font-medium mb-2">Tabelas e propriedades com valores do contrato selecionado</p>
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

                <div className="flex justify-end gap-2">
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
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-xl">{template.name}</CardTitle>
                    <Badge className={getTypeBadgeClass(template.type)}>
                      {getTypeLabel(template.type)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Criado em {new Date(template.createdAt).toLocaleDateString('pt-BR')}
                    {template.updatedAt !== template.createdAt && 
                      ` • Atualizado em ${new Date(template.updatedAt).toLocaleDateString('pt-BR')}`
                    }
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
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
    </div>
  )
}
