import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/LanguageContext'
import { useCurrency, currencies, Currency } from '@/lib/CurrencyContext'
import { useKV } from '@github/spark/hooks'
import { ContractTemplate } from '@/types'
import { toast } from 'sonner'
import { Globe, CurrencyCircleDollar, FileText } from '@phosphor-icons/react'
import { UserManagement } from '@/components/UserManagement'

export default function SettingsView() {
  const { t, language, setLanguage } = useLanguage()
  const { currency, setCurrency } = useCurrency()
  const [templates, setTemplates] = useKV<ContractTemplate[]>('contract-templates', [])

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang as 'pt' | 'en')
    toast.success(t.settings_view.language_updated)
  }

  const handleCurrencyChange = (newCurrency: string) => {
    setCurrency(newCurrency as Currency)
    toast.success(t.settings_view.currency_updated)
  }

  const initializeDefaultTemplates = () => {
    const monthlyTemplate: ContractTemplate = {
      id: Date.now().toString(),
      name: 'Contrato Padrão - Locação Mensal',
      type: 'monthly',
      content: `CONTRATO DE LOCAÇÃO MENSAL

LOCADOR(A): [NOME_LOCADOR]
LOCATÁRIO(A): {{guestName}}
CPF: {{guestDocument}}
E-mail: {{guestEmail}}
Telefone: {{guestPhone}}

IMÓVEL(EIS):
{{properties}}

VALOR DA LOCAÇÃO: {{monthlyAmount}}
VENCIMENTO: Todo dia {{paymentDueDay}} de cada mês

PERÍODO: {{startDate}} até {{endDate}}

CLÁUSULA 1ª - DO OBJETO
O presente contrato tem por objeto a locação do(s) imóvel(is) acima identificado(s), para fins residenciais.

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
    Locador(a)                         Locatário(a)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const shortTermTemplate: ContractTemplate = {
      id: (Date.now() + 1).toString(),
      name: 'Contrato Padrão - Curta Temporada',
      type: 'short-term',
      content: `CONTRATO DE LOCAÇÃO DE CURTA TEMPORADA

LOCADOR(A): [NOME_LOCADOR]
LOCATÁRIO(A): {{guestName}}
CPF: {{guestDocument}}
E-mail: {{guestEmail}}
Telefone: {{guestPhone}}
Endereço: {{guestAddress}}
Nacionalidade: {{guestNationality}}

IMÓVEL(EIS):
{{properties}}

VALOR TOTAL: {{monthlyAmount}}
PERÍODO: {{startDate}} até {{endDate}}

CLÁUSULA 1ª - DO OBJETO
O presente contrato tem por objeto a locação por temporada do(s) imóvel(is) acima identificado(s), nos termos da Lei 8.245/91.

CLÁUSULA 2ª - DO PRAZO
A locação é por prazo determinado de {{startDate}} até {{endDate}}, sem possibilidade de renovação automática.

CLÁUSULA 3ª - DO VALOR
O valor total da locação é de {{monthlyAmount}}, já incluindo todas as despesas.

CLÁUSULA 4ª - DO PAGAMENTO
O pagamento deverá ser efetuado até o dia {{paymentDueDay}}.

CLÁUSULA 5ª - DAS OBRIGAÇÕES DO LOCATÁRIO
São obrigações do locatário:
a) Utilizar o imóvel exclusivamente para fins residenciais;
b) Manter o imóvel limpo e em bom estado;
c) Não sublocar ou ceder o imóvel a terceiros;
d) Restituir o imóvel no prazo acordado.

CLÁUSULA 6ª - DAS OBRIGAÇÕES DO LOCADOR
São obrigações do locador:
a) Entregar o imóvel limpo e em perfeitas condições de uso;
b) Garantir o uso pacífico durante o período contratado.

CLÁUSULA 7ª - DO CHECK-IN E CHECK-OUT
Check-in: A partir das 14h do dia {{startDate}}
Check-out: Até às 12h do dia {{endDate}}

{{notes}}

Data: {{currentDate}}

_________________________          _________________________
    Locador(a)                         Locatário(a)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setTemplates((current) => [...(current || []), monthlyTemplate, shortTermTemplate])
    toast.success('Templates padrão criados com sucesso')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{t.settings_view.title}</h2>
        <p className="text-muted-foreground mt-1">{t.settings_view.subtitle}</p>
      </div>

      <UserManagement />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe size={24} weight="duotone" className="text-primary" />
            </div>
            <div>
              <CardTitle>{t.settings_view.language_section}</CardTitle>
              <CardDescription>{t.settings_view.language_description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="language">{t.settings_view.language_label}</Label>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger id="language" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt">{t.settings_view.languages.pt}</SelectItem>
                <SelectItem value="en">{t.settings_view.languages.en}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <CurrencyCircleDollar size={24} weight="duotone" className="text-accent" />
            </div>
            <div>
              <CardTitle>{t.settings_view.currency_section}</CardTitle>
              <CardDescription>{t.settings_view.currency_description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="currency">{t.settings_view.currency_label}</Label>
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger id="currency" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(currencies).map(([code, config]) => (
                  <SelectItem key={code} value={code}>
                    {config.symbol} - {config.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText size={24} weight="duotone" className="text-primary" />
            </div>
            <div>
              <CardTitle>Templates de Contratos</CardTitle>
              <CardDescription>Inicialize templates padrão para contratos de locação</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Clique no botão abaixo para criar templates padrão de contratos de locação mensal e curta temporada. 
              Você poderá editá-los posteriormente na aba Templates.
            </p>
            <Button onClick={initializeDefaultTemplates} className="gap-2">
              <FileText size={18} weight="duotone" />
              Criar Templates Padrão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
