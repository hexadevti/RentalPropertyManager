import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader,
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/LanguageContext'
const DEFAULT_MONTHLY_TEMPLATE = `CONTRATO DE LOCAÇ
LOCADOR(A): [NOME_LOCADOR]
CPF: {{guestDocument}}
Telefone: {{guestPhone}}
IMÓVEL(EIS):


PERÍODO: {{startDate}} até {{endDate}}


O prazo de locação é de {{s
CLÁUSULA 3ª - DO ALUGU

São obrigações do locatá


São obrigações

{{notes}}
Data: {{currentDate}}



LOCATÁRIO(A): {{guestNa
E-mail: {{guestEmail}}

CLÁUSULA 2ª - DO PRAZO
O prazo de locação é de {{startDate}} até {{endDate}}, podendo ser prorrogado mediante acordo entre as partes.

CLÁUSULA 3ª - DO ALUGUEL
O valor mensal do aluguel é de {{monthlyAmount}}, devendo ser pago até o dia {{paymentDueDay}} de cada mês.

CLÁUSULA 4ª - DAS OBRIGAÇÕES DO LOCATÁRIO
São obrigações do locatário:
a) Pagar pontualmente o aluguel;
b) Manter o imóvel em bom estado de conservação;
c) Restituir o imóvel nas mesmas condições em que o recebeu.

CLÁUSULA 5ª - DAS OBRIGAÇÕES DO LOCADOR
São obrigações do locador:
a) Entregar o imóvel em condições de uso;
b) Garantir o uso pacífico do imóvel.

{{notes}}

Data: {{currentDate}}

_________________________          _________________________
    Locador(a)                         Locatário(a)`

const DEFAULT_SHORT_TERM_TEMPLATE = `CONTRATO DE LOCAÇÃO DE CURTA TEMPORADA

LOCADOR(A): [NOME_LOCADOR]
LOCATÁRIO(A): {{guestName}}
CPF: {{guestDocument}}
E-mail: {{guestEmail}}
Telefone: {{guestPhone}}
Endereço: {{guestAddress}}
Nacionalidade: {{guestNationality}}




    Locador(a)                
export default function ContractTempla

  const [dialogOpen, se
  

    content: '',


      type: 'monthly',
    })

  const handleSubmit = (e:
    

          t.id === editingTemplate.id
                ...formData,
                createdAt: t.createdAt,
              }
        )
      toast.success('Template atualizado

        id: Date.now().toString(),
        updatedAt: new Dat
      setTemplates((currentTemplates) => [...(currentTempla
    }

  }
  const handleEdit = (template: ContractTemplat
    setFormData({

    })

  const handleDelete 


    const newTemplate: ContractTemplate = {

      createdAt: new Date().toISOString(),
    }
    toast.success('Template duplicado com sucesso')

    setFormData(prev => ({
      content: type === 'monthly' ? DEFAULT_MONTHLY_TEMPLATE : DEFAULT_SHORT_TERM_TEMPL
  

    .filter(t
    )
  const getTypeL
  }

      ? 'bg-primary/10 text
  }
  return (
      <div className="
          <h2 clas
      
          setDialogOpen(open
   

              Novo Template
          </DialogTrig
    
            </DialogHeader
              <div className="grid grid-
                  <Label htmlFor="templat
                    id="template-name
                
                    required
                </div>
                <div>
                  <Select
               
               
         
       
                      <SelectItem value="short-term">C
            
              </div>
              <div>
                  <Label htmlFor="
                    type="button"
                    size="sm"
       
                    <FileText size={16} weight="duotone" />
                  </Button>
     
    
                  placeh
               
   

                    <div><code className="bg-backgroun
                    <div><code c
                 
                    <div><
                    <div><
                    <div><code c
      
    setDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    setTemplates((currentTemplates) => (currentTemplates || []).filter(t => t.id !== id))
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

  const loadDefaultTemplate = (type: TemplateType) => {
    setFormData(prev => ({
      ...prev,
      content: type === 'monthly' ? DEFAULT_MONTHLY_TEMPLATE : DEFAULT_SHORT_TERM_TEMPLATE
    }))
    toast.success('Template padrão carregado')
  }

  const filteredTemplates = (templates || [])
    .filter(template => 
      template.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

  const getTypeLabel = (type: TemplateType) => {
    return type === 'monthly' ? 'Locação Mensal' : 'Curta Temporada'
  }

  const getTypeBadgeClass = (type: TemplateType) => {
    return type === 'monthly' 
      ? 'bg-primary/10 text-primary border-primary/20'
      : 'bg-accent/10 text-accent-foreground border-accent/20'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Templates de Contratos</h2>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os templates para geração de contratos em PDF</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus weight="bold" />
              Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Editar Template' : 'Novo Template'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="template-name">Nome do Template</Label>
                  <Input
                    id="template-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Contrato Padrão Mensal"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="template-type">Tipo de Contrato</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: TemplateType) => setFormData({ ...formData, type: value })}
                    required
                  >
                    <SelectTrigger id="template-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Locação Mensal</SelectItem>
                      <SelectItem value="short-term">Curta Temporada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="template-content">Conteúdo do Template</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => loadDefaultTemplate(formData.type)}
                    className="gap-2"
                  >
                    <FileText size={16} weight="duotone" />
                    Carregar Template Padrão
                  </Button>
                </div>
                <Textarea
                  id="template-content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Digite o conteúdo do template aqui..."
                  rows={20}
                  className="font-mono text-sm"
                  required
                />
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Variáveis disponíveis:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div><code className="bg-background px-1 py-0.5 rounded">{'{{guestName}}'}</code> - Nome do hóspede</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{'{{guestEmail}}'}</code> - Email do hóspede</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{'{{guestPhone}}'}</code> - Telefone do hóspede</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{'{{guestDocument}}'}</code> - CPF do hóspede</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{'{{guestAddress}}'}</code> - Endereço do hóspede</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{'{{guestNationality}}'}</code> - Nacionalidade</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{'{{properties}}'}</code> - Lista de imóveis</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{'{{startDate}}'}</code> - Data início</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{'{{endDate}}'}</code> - Data fim</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{'{{monthlyAmount}}'}</code> - Valor mensal</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{'{{paymentDueDay}}'}</code> - Dia vencimento</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{'{{notes}}'}</code> - Observações</div>
                    <div><code className="bg-background px-1 py-0.5 rounded">{'{{currentDate}}'}</code> - Data atual</div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setDialogOpen(false)
                  resetForm()
                }}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar Template</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <Input
          placeholder="Buscar templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText size={64} weight="duotone" className="text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {searchQuery ? 'Nenhum template encontrado' : 'Nenhum template cadastrado'}
            </h3>
            {!searchQuery && (
              <p className="text-muted-foreground text-center max-w-md">
                Crie seu primeiro template de contrato para começar a gerar PDFs automaticamente
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-xl">{template.name}</CardTitle>
                      <Badge className={getTypeBadgeClass(template.type)}>
                        {getTypeLabel(template.type)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Criado em {new Date(template.createdAt).toLocaleDateString('pt-BR')}
                      {template.updatedAt !== template.createdAt && 
                        ` • Atualizado em ${new Date(template.updatedAt).toLocaleDateString('pt-BR')}`
                      }
                    </p>
                    <div className="mt-3 p-3 bg-muted rounded-md">
                      <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {template.content}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDuplicate(template)}
                      title="Duplicar template"
                    >
                      <Copy size={18} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(template)}
                    >
                      <Pencil size={18} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash size={18} className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setDialogOpen(false)
                  resetForm()
                }}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar Template</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
        <Input
          placeholder="Buscar templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText size={64} weight="duotone" className="text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              {searchQuery ? 'Nenhum template encontrado' : 'Nenhum template cadastrado'}
            </h3>
            {!searchQuery && (
              <p className="text-muted-foreground text-center max-w-md">
                Crie seu primeiro template de contrato para começar a gerar PDFs automaticamente
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-xl">{template.name}</CardTitle>
                      <Badge className={getTypeBadgeClass(template.type)}>
                        {getTypeLabel(template.type)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Criado em {new Date(template.createdAt).toLocaleDateString('pt-BR')}
                      {template.updatedAt !== template.createdAt && 
                        ` • Atualizado em ${new Date(template.updatedAt).toLocaleDateString('pt-BR')}`
                      }
                    </p>
                    <div className="mt-3 p-3 bg-muted rounded-md">
                      <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {template.content}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDuplicate(template)}
                      title="Duplicar template"
                    >
                      <Copy size={18} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(template)}
                    >
                      <Pencil size={18} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash size={18} className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
