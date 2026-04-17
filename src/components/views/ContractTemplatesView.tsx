import { useState } from 'react'
import { useKV } from '@/lib/useSupabaseKV'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash, Copy, MagnifyingGlass, FileText } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { ContractTemplate, TemplateType } from '@/types'
import { useLanguage } from '@/lib/LanguageContext'
import RichTextEditor, { plainTextToHTML } from '@/components/RichTextEditor'

const DEFAULT_MONTHLY_TEMPLATE = `CONTRATO DE LOCAÇÃO MENSAL

LOCADOR(A): {{ownerName}}
Documento: {{ownerDocument}}
E-mail: {{ownerEmail}}
Telefone: {{ownerPhone}}
Endereço: {{ownerAddress}}

LOCATÁRIO(A): {{guestName}}
E-mail: {{guestEmail}}
Telefone: {{guestPhone}}
Documento: {{guestDocument}}
Endereço: {{guestAddress}}
Nacionalidade: {{guestNationality}}

IMÓVEL(EIS):
{{properties}}

PERÍODO: {{startDate}} até {{endDate}}

CLÁUSULA 1ª - DO OBJETO
O locador cede ao locatário, em caráter de locação mensal, o(s) imóvel(eis) descrito(s) acima.

CLÁUSULA 2ª - DO PERÍODO
A locação terá início em {{startDate}}, com pagamentos mensais devidos até o dia {{paymentDueDay}} de cada mês.

CLÁUSULA 3ª - DO VALOR
O valor mensal da locação é de {{monthlyAmount}}, devendo ser pago até o dia {{paymentDueDay}} de cada mês.

CLÁUSULA 4ª - DAS OBRIGAÇÕES DO LOCATÁRIO
São obrigações do locatário:
a) Pagar pontualmente o aluguel;
b) Manter o imóvel em bom estado de conservação;
c) Comunicar imediatamente ao locador qualquer dano ou necessidade de reparo;
d) Não sublocar o imóvel sem autorização prévia e por escrito do locador.

CLÁUSULA 5ª - DAS OBRIGAÇÕES DO LOCADOR
São obrigações do locador:
a) Entregar o imóvel em perfeitas condições de uso;
b) Realizar reparos estruturais necessários;
c) Garantir o uso pacífico do imóvel.

CLÁUSULA 6ª - DA RESCISÃO
Qualquer das partes poderá rescindir o presente contrato mediante aviso prévio de 30 (trinta) dias.

CLÁUSULA 7ª - OBSERVAÇÕES
{{notes}}

Data: {{currentDate}}

_________________________          _________________________
    Locador(a)                         Locatário(a)`

const DEFAULT_SHORT_TERM_TEMPLATE = `CONTRATO DE LOCAÇÃO TEMPORÁRIA

LOCADOR(A): {{ownerName}}
Documento: {{ownerDocument}}
E-mail: {{ownerEmail}}
Telefone: {{ownerPhone}}
Endereço: {{ownerAddress}}

LOCATÁRIO(A): {{guestName}}
E-mail: {{guestEmail}}
Telefone: {{guestPhone}}
Documento: {{guestDocument}}
Endereço: {{guestAddress}}
Nacionalidade: {{guestNationality}}

IMÓVEL(EIS):
{{properties}}

PERÍODO: {{startDate}} até {{endDate}}

CLÁUSULA 1ª - DO OBJETO
O locador cede ao locatário, em caráter de locação temporária, o(s) imóvel(eis) descrito(s) acima.

CLÁUSULA 2ª - DO PERÍODO
A locação terá início em {{startDate}} e término em {{endDate}}.

CLÁUSULA 3ª - DO VALOR
O valor total da locação é de {{monthlyAmount}}, devendo ser pago até o dia {{paymentDueDay}}.

CLÁUSULA 4ª - DAS OBRIGAÇÕES DO LOCATÁRIO
São obrigações do locatário:
a) Pagar pontualmente o valor acordado;
b) Manter o imóvel em bom estado de conservação;
c) Devolver o imóvel nas mesmas condições em que o recebeu;
d) Não sublocar o imóvel sem autorização prévia e por escrito do locador.

CLÁUSULA 5ª - DAS OBRIGAÇÕES DO LOCADOR
São obrigações do locador:
a) Entregar o imóvel em perfeitas condições de uso;
b) Realizar reparos estruturais necessários;
c) Garantir o uso pacífico do imóvel durante todo o período contratado.

CLÁUSULA 6ª - DA RESCISÃO ANTECIPADA
Em caso de rescisão antecipada por parte do locatário, este deverá arcar com multa correspondente a 50% do valor restante do contrato.

CLÁUSULA 7ª - OBSERVAÇÕES
{{notes}}

Data: {{currentDate}}

_________________________          _________________________
    Locador(a)                         Locatário(a)`

export default function ContractTemplatesView() {
  const { t } = useLanguage()
  const [templates, setTemplates] = useKV<ContractTemplate[]>('contract-templates', [])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
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

  const handleCreateDefaultTemplate = (type: TemplateType) => {
    const defaultContent = type === 'monthly' ? DEFAULT_MONTHLY_TEMPLATE : DEFAULT_SHORT_TERM_TEMPLATE
    const templateName = type === 'monthly' ? 'Contrato Mensal Padrão' : 'Contrato Temporário Padrão'
    
    const newTemplate: ContractTemplate = {
      id: Date.now().toString(),
      name: templateName,
      type: type,
      content: plainTextToHTML(defaultContent),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    setTemplates((currentTemplates) => [...(currentTemplates || []), newTemplate])
    toast.success(`Template "${templateName}" criado com sucesso`)
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
                  <Label>Conteúdo do Contrato</Label>
                  <RichTextEditor
                    content={formData.content}
                    onChange={(html) => setFormData({ ...formData, content: html })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Variáveis disponíveis: {'{'}{'{'} ownerName {'}'}{'}'},  {'{'}{'{'} ownerEmail {'}'}{'}'},  {'{'}{'{'} ownerPhone {'}'}{'}'},  {'{'}{'{'} ownerDocument {'}'}{'}'},  {'{'}{'{'} ownerAddress {'}'}{'}'},  {'{'}{'{'} ownerDetails {'}'}{'}'},  {'{'}{'{'} guestName {'}'}{'}'},  {'{'}{'{'} guestEmail {'}'}{'}'},  {'{'}{'{'} guestPhone {'}'}{'}'},  {'{'}{'{'} guestDocument {'}'}{'}'},  {'{'}{'{'} guestAddress {'}'}{'}'},  {'{'}{'{'} guestNationality {'}'}{'}'},  {'{'}{'{'} properties {'}'}{'}'},  {'{'}{'{'} startDate {'}'}{'}'},  {'{'}{'{'} endDate {'}'}{'}'},  {'{'}{'{'} monthlyAmount {'}'}{'}'},  {'{'}{'{'} paymentDueDay {'}'}{'}'},  {'{'}{'{'} notes {'}'}{'}'},  {'{'}{'{'} currentDate {'}'}{'}'} 
                  </p>
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleCreateDefaultTemplate('monthly')}
          >
            <FileText weight="duotone" size={18} className="mr-2" />
            Template Mensal
          </Button>
          <Button
            variant="outline"
            onClick={() => handleCreateDefaultTemplate('short-term')}
          >
            <FileText weight="duotone" size={18} className="mr-2" />
            Template Temporário
          </Button>
        </div>
      </div>

      {filteredTemplates.length === 0 && !searchQuery && (
        <Card className="border-dashed">
          <CardHeader className="text-center py-12">
            <CardTitle className="text-muted-foreground font-normal">
              Nenhum template criado
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Clique em "Novo Template" para criar um modelo de contrato ou use os botões acima para gerar templates padrão
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
