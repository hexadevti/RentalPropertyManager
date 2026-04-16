import { useState } from 'react'
import { Button } from '@/components/ui/but
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContractTemplate, TemplateType } fro
import { Plus, Pencil, Trash, Copy, MagnifyingGlass, FileText } from '@phosphor-icons/react'

import { ContractTemplate, TemplateType } from '@/types'

const DEFAULT_MONTHLY_TEMPLATE = `CONTRATO DE LOCAÇÃO MENSAL


LOCATÁRIO(A): {{guestName}}

E-mail: {{guestEmail}}
CLÁUSULA 1ª - DO OBJETO
Endereço: {{guestAddress}}
Nacionalidade: {{guestNationality}}


{{properties}}

a) Pagar pontualmente o aluguel;

CLÁUSULA 1ª - DO OBJETO
O locador cede ao locatário, em caráter de locação, o(s) imóvel(eis) descrito(s) acima.

Nacionalidade: {{guest
IMÓVEL(EIS):


O locador cede ao locatário, em caráter de locação temporária, o(s) imóvel(eis) descrito(s) acima.


O valor total da locação é d
{{notes}}
Data: {{currentDate}}
_________________________          _________________________

  const [templates, setTemplates] = use
  const [editingTemplate, 
  const [formData, setFormData] = useStat
    type: 'monthly' as TemplateType,

  const r

      content: '',


    e.preventDefault()

        (currentTemplates || []).map((t) =>

                ...formDat
              }
        )
      toast.success('T
      const newTemplate:
        ...formData,
        updatedAt: new Date().toISO

IMÓVEL(EIS):
{{properties}}

PERÍODO: {{startDate}} até {{endDate}}

CLÁUSULA 1ª - DO OBJETO
O locador cede ao locatário, em caráter de locação temporária, o(s) imóvel(eis) descrito(s) acima.

CLÁUSULA 2ª - DO PERÍODO
A locação terá início em {{startDate}} e término em {{endDate}}.

CLÁUSULA 3ª - DO VALOR
O valor total da locação é de {{monthlyAmount}}, devendo ser pago até o dia {{paymentDueDay}}.

{{notes}}

Data: {{currentDate}}

_________________________          _________________________
    Locador(a)                         Locatário(a)`

export default function ContractTemplatesView() {
  const [templates, setTemplates] = useKV<ContractTemplate[]>('contract-templates', [])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    type: 'monthly' as TemplateType,
    toast.succes
  })

  const resetForm = () => {
    setFormData({
      name: '',
    return type === 'm
      content: '',
  cons
    setEditingTemplate(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingTemplate) {
      setTemplates((currentTemplates) =>
        (currentTemplates || []).map((t) =>
          if (!open) resetForm()
            ? {
                ...t,
              <Plus weight="
                updatedAt: new Date().toISOString(),
          <Dial
            : t
         
      )
      toast.success('Template atualizado com sucesso')
    } else {
      const newTemplate: ContractTemplate = {
                    onChange={(e) 
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setTemplates((currentTemplates) => [...(currentTemplates || []), newTemplate])
      toast.success('Template criado com sucesso')
     

    setDialogOpen(false)
    resetForm()
   

  const handleEdit = (template: ContractTemplate) => {
    setEditingTemplate(template)

      name: template.name,
      type: template.type,
      content: template.content,
      
            {!searchQue
   

        </Card>
        <div className="grid gap-4">
            <Card key={template.id} className="hov
   

                      <Badge className={getTypeBadgeClass(t
                      </Badge>
                  
                      {template.
                      }
                    <div className="mt-3 p
                        {template.content}
     
                  <div className="flex gap-2 ml-4">
                      size="icon"
   

                    </Button>
                      size
              
                      <Pencil size={18} />
       
                      variant="ghost"
   

                </div>
            </Card>
        </div>
    <









































































































































































































