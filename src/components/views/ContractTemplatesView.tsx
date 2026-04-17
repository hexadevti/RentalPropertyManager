import { useRef, useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash, Copy, MagnifyingGlass, Question } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { ContractTemplate, TemplateType } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import RichTextEditor, { plainTextToHTML, RichTextEditorHandle } from '@/components/RichTextEditor'

const TEMPLATE_VARIABLES = [
  { token: '{{ownerName}}', meaning: 'Nome(s) do(s) proprietário(s)', sample: 'João Silva, Maria Santos' },
  { token: '{{ownerEmail}}', meaning: 'E-mail(s) do(s) proprietário(s)', sample: 'joao@email.com, maria@email.com' },
  { token: '{{ownerPhone}}', meaning: 'Telefone(s) do(s) proprietário(s)', sample: '(11) 99999-0000, (11) 98888-1111' },
  { token: '{{ownerDocument}}', meaning: 'Documento(s) do(s) proprietário(s)', sample: '123.456.789-00, 987.654.321-00' },
  { token: '{{ownerAddress}}', meaning: 'Endereço(s) do(s) proprietário(s)', sample: 'Rua A, 100 - Centro - Sao Paulo/SP' },
  { token: '{{ownerDetails}}', meaning: 'Bloco completo com dados do(s) proprietário(s)', sample: 'João Silva\nDocumento: 123.456.789-00\nE-mail: joao@email.com\nTelefone: (11) 99999-0000' },
  { token: '{{guestName}}', meaning: 'Nome do hóspede/locatário', sample: 'Carlos Pereira' },
  { token: '{{guestEmail}}', meaning: 'E-mail do hóspede/locatário', sample: 'carlos@email.com' },
  { token: '{{guestPhone}}', meaning: 'Telefone do hóspede/locatário', sample: '(11) 97777-2222' },
  { token: '{{guestDocument}}', meaning: 'Documento do hóspede/locatário', sample: '111.222.333-44' },
  { token: '{{guestAddress}}', meaning: 'Endereço do hóspede/locatário', sample: 'Av. Principal, 250 - Rio de Janeiro/RJ' },
  { token: '{{guestNationality}}', meaning: 'Nacionalidade do hóspede/locatário', sample: 'Brasileiro(a)' },
  { token: '{{properties}}', meaning: 'Lista de imóveis vinculados ao contrato', sample: '- Apartamento 101\n- Casa de Praia' },
  { token: '{{startDate}}', meaning: 'Data de início do contrato', sample: '01/05/2026' },
  { token: '{{endDate}}', meaning: 'Data de fim do contrato', sample: '30/04/2027' },
  { token: '{{monthlyAmount}}', meaning: 'Valor da locação formatado em moeda', sample: 'R$ 2.500,00' },
  { token: '{{paymentDueDay}}', meaning: 'Dia do vencimento do pagamento', sample: '10' },
  { token: '{{notes}}', meaning: 'Observações do contrato', sample: 'OBSERVAÇÕES:\nSem pets. Visitas mediante aviso prévio.' },
  { token: '{{currentDate}}', meaning: 'Data atual no momento da geração do PDF', sample: '17/04/2026' },
] as const

export default function ContractTemplatesView() {
  const { t } = useLanguage()
  const [templates, setTemplates] = useKV<ContractTemplate[]>('contract-templates', [])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const editorRef = useRef<RichTextEditorHandle | null>(null)
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
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

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
      toast.success('Template atualizado com sucesso')
    } else {
      const newTemplate: ContractTemplate = {
        id: Date.now().toString(),
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setTemplates((currentTemplates) => [...(currentTemplates || []), newTemplate])
      toast.success('Template criado com sucesso')
    }

    setDialogOpen(false)
    resetForm()
  }

  const handleEdit = (template: ContractTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      type: template.type,
      content: plainTextToHTML(template.content),
    })
    setDialogOpen(true)
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

  const handleCopyVariable = async (token: string) => {
    setHelpDialogOpen(false)

    try {
      await navigator.clipboard.writeText(token)
    } catch {
      // No notification here to avoid stealing editor focus/cursor.
    } finally {
      restoreEditorFocus()
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

  const isHTML = (content: string) => /<[a-z][\s\S]*>/i.test(content)

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
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus weight="bold" size={18} className="mr-2" />
                Novo Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Conteúdo do Contrato</Label>
                    <Dialog open={helpDialogOpen} onOpenChange={(open) => {
                      if (open) {
                        editorRef.current?.captureCurrentSelection()
                      }
                      setHelpDialogOpen(open)
                      if (!open) {
                        restoreEditorFocus()
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onMouseDown={() => editorRef.current?.captureCurrentSelection()}
                        >
                          <Question size={16} className="mr-2" />
                          Ajuda: Variáveis
                        </Button>
                      </DialogTrigger>
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
                          {TEMPLATE_VARIABLES.map((variable) => (
                            <div key={variable.token} className="border rounded-md p-3">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                  <p className="font-mono text-sm font-semibold">{variable.token}</p>
                                  <p className="text-sm text-muted-foreground mt-1">{variable.meaning}</p>
                                  <div className="mt-2">
                                    <p className="text-xs text-muted-foreground mb-1">Conteúdo gerado (exemplo)</p>
                                    <div className="max-w-full overflow-x-auto rounded border bg-muted/40 px-2 py-1">
                                      <p className="font-mono text-xs whitespace-pre min-w-max">{variable.sample}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void handleCopyVariable(variable.token)}
                                  >
                                    Copiar
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleInsertVariable(variable.token)}
                                  >
                                    Inserir no texto
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <RichTextEditor
                    ref={editorRef}
                    content={formData.content}
                    onChange={(html) => setFormData({ ...formData, content: html })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingTemplate ? t.common.update : t.common.create}
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
