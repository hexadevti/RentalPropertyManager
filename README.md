# 🏠 RentFlow - Sistema de Gestão de Propriedades

Sistema completo de gestão de aluguéis de curta e longa temporada, desenvolvido para proprietários e administradores de imóveis.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Guia de Uso](#guia-de-uso)
- [Modelo de Dados](#modelo-de-dados)
- [Configurações](#configurações)
- [Relatórios e Análises](#relatórios-e-análises)

## 🎯 Visão Geral

RentFlow é uma aplicação web moderna e completa para gestão de propriedades para aluguel. O sistema permite controlar todas as operações relacionadas à administração de imóveis, desde o cadastro de propriedades até a gestão financeira, contratos, agendamentos e relatórios detalhados.

### Principais Características

- ✅ **Gestão Completa de Propriedades** - Cadastro de quartos, apartamentos e casas
- 💰 **Controle Financeiro** - Receitas, despesas e fluxo de caixa detalhado
- 📅 **Calendário Inteligente** - Visualização de disponibilidade e ocupação
- 📝 **Gestão de Contratos** - Contratos de curta e longa temporada
- 👥 **Cadastro de Hóspedes** - Histórico completo de cada hóspede
- 🔧 **Prestadores de Serviço** - Gestão de fornecedores e manutenções
- ⏰ **Compromissos** - Agenda de atividades e tarefas
- 📊 **Relatórios Avançados** - Análises financeiras e de desempenho
- 🌐 **Multilíngue** - Suporte para Português e Inglês
- 💱 **Múltiplas Moedas** - Suporte para diversas moedas globais

## 🚀 Funcionalidades

### 1. Propriedades

Gerencie seu portfólio de imóveis com informações detalhadas:

- **Tipos suportados**: Quarto, Apartamento, Casa
- **Informações**: Nome, capacidade, descrição
- **Precificação**: Valor por noite e por mês
- **Status automático**: Baseado em contratos ativos
- **Geração rápida de contratos** diretamente da propriedade

**Como usar:**
1. Acesse a aba "Propriedades"
2. Clique em "Adicionar Propriedade"
3. Preencha os dados do imóvel
4. Use "Gerar Contrato" para criar contratos rapidamente

### 2. Finanças

Controle completo do fluxo de caixa:

- **Receitas**: Vinculadas a contratos específicos
- **Despesas**: Vinculadas a prestadores de serviço
- **Visualização mensal**: Fluxo de caixa segmentado por mês
- **Saldo em tempo real**: Atualizado automaticamente
- **Categorização**: Organize transações por categoria
- **Edição completa**: Edite transações existentes

**Fluxo de trabalho:**
1. Acesse "Finanças"
2. Clique em "Nova Transação"
3. Selecione o tipo (Receita/Despesa)
4. Para receitas: vincule a um contrato
5. Para despesas: vincule a um prestador de serviço
6. Visualize o resumo mensal e saldo total

### 3. Calendário

Visualização completa de ocupação e compromissos:

- **Calendário geral**: Compromissos, tarefas e eventos importantes
- **Calendário por propriedade**: Ocupação de cada imóvel
- **Visão de 3 meses**: Mês anterior, atual e próximo
- **Contratos vigentes**: Visualização direta no calendário
- **Vencimentos**: Alertas de pagamentos e fim de contratos
- **Integração com compromissos**: Veja todos os agendamentos

**Recursos:**
- Adicionar novos contratos diretamente do calendário
- Visualizar status de ocupação em tempo real
- Identificar períodos disponíveis para novos contratos

### 4. Tarefas

Gestão de atividades e manutenções:

- **Prioridades**: Baixa, Média, Alta
- **Status**: Pendente, Em Andamento, Concluída
- **Atribuição**: Defina responsáveis
- **Vinculação**: Conecte tarefas a propriedades específicas
- **Datas de vencimento**: Controle de prazos

### 5. Hóspedes

Cadastro completo de clientes:

- **Dados pessoais**: Nome, email, telefone
- **Documentos**: CPF/Passaporte
- **Informações adicionais**: Endereço, nacionalidade, data de nascimento
- **Observações**: Notas personalizadas
- **Histórico**: Veja todos os contratos do hóspede

**Integração:**
- Crie novos hóspedes diretamente do formulário de contrato
- Lista atualizada automaticamente após cadastro
- Busca rápida por nome ou documento

### 6. Contratos

Gestão completa de acordos de aluguel:

- **Tipos**: Temporada curta ou Mensal
- **Múltiplas propriedades**: Um contrato pode incluir vários imóveis
- **Período definido**: Data de início e término
- **Vencimento**: Dia de pagamento mensal
- **Status automático**: Ativo, Expirado, Cancelado
- **Vinculação**: Conectado a hóspedes específicos

**Fluxo de criação:**
1. Selecione o hóspede (ou crie um novo)
2. Escolha uma ou mais propriedades
3. Defina o tipo de aluguel e período
4. Configure o dia de vencimento do pagamento
5. Adicione o valor mensal
6. Salve o contrato

**Recursos especiais:**
- Crie hóspedes sem fechar o formulário de contrato
- Atualize a lista de hóspedes com um clique
- Gere contratos diretamente das propriedades

### 7. Prestadores de Serviço

Cadastro de fornecedores e profissionais:

- **Informações**: Nome, serviço prestado
- **Contato**: Telefone e email
- **Vinculação financeira**: Conecte despesas a prestadores
- **Histórico**: Veja todas as transações relacionadas

**Serviços comuns:**
- Encanador
- Eletricista
- Faxineiro
- Jardineiro
- Pintor
- Manutenção geral

### 8. Compromissos

Agenda de atividades administrativas:

- **Título e descrição**: Detalhes do compromisso
- **Data e horário**: Agendamento preciso
- **Status**: Agendado, Concluído, Cancelado
- **Múltiplas vinculações**:
  - Prestador de serviço
  - Contrato
  - Hóspede
  - Propriedade

**Funcionalidades:**
- **Conclusão de compromissos**: Marque como concluído com observações finais
- **Visualização no calendário**: Integrado ao calendário geral
- **Cores diferenciadas**: Concluídos aparecem com cor suave
- **Detalhes ao clicar**: Visualize todas as informações
- **Tooltips informativos**: Status ao passar o mouse

### 9. Relatórios

Análises completas com gráficos visuais:

#### Visão Geral Financeira
- Receita total
- Despesas totais
- Lucro líquido
- Filtros por período personalizado

#### Desempenho por Propriedade
- Receita por propriedade (baseada em transações vinculadas)
- Número de contratos
- Cálculo proporcional para contratos com múltiplas propriedades

#### Taxa de Ocupação
- Baseada em contratos vigentes
- Cálculo por dias ocupados vs. disponíveis
- Percentual de ocupação atual

#### Tendência Financeira
- Gráfico de linha dos últimos 6 meses
- Comparação entre receitas e despesas
- Evolução temporal do fluxo de caixa

#### Próximas Tarefas
- Tarefas pendentes ordenadas por prioridade
- Indicação de atrasos
- Vencimentos próximos

#### Contratos Recentes
- Últimos contratos criados
- Informações do hóspede e período
- Valores mensais

## 🛠️ Tecnologias Utilizadas

### Frontend
- **React 19.2.0** - Biblioteca JavaScript para interfaces
- **TypeScript 5.7.3** - Tipagem estática
- **Vite 7.2.6** - Build tool e dev server
- **Tailwind CSS 4.1.17** - Framework CSS utilitário

### UI Components
- **shadcn/ui v4** - Componentes React pré-construídos
- **Radix UI** - Primitivos de UI acessíveis
- **Phosphor Icons** - Biblioteca de ícones
- **Framer Motion** - Animações suaves

### Gráficos e Visualizações
- **Recharts 2.15.4** - Biblioteca de gráficos React
- **D3.js 7.9.0** - Visualizações de dados

### Formulários e Validação
- **React Hook Form 7.67.0** - Gerenciamento de formulários
- **Zod 3.25.76** - Validação de schemas

### Utilitários
- **date-fns 3.6.0** - Manipulação de datas
- **Sonner 2.0.7** - Notificações toast
- **class-variance-authority** - Variantes de componentes
- **clsx + tailwind-merge** - Gerenciamento de classes CSS

### Persistência
- **Spark KV API** - Armazenamento key-value persistente
- **useKV Hook** - Hook React para dados persistentes

## 📁 Estrutura do Projeto

```
/workspaces/spark-template
├── src/
│   ├── components/
│   │   ├── ui/                        # Componentes shadcn/ui
│   │   ├── views/                     # Views principais
│   │   │   ├── PropertiesView.tsx     # Gestão de propriedades
│   │   │   ├── FinancesView.tsx       # Gestão financeira
│   │   │   ├── CalendarView.tsx       # Calendário
│   │   │   ├── TasksView.tsx          # Tarefas
│   │   │   ├── GuestsView.tsx         # Hóspedes
│   │   │   ├── ContractsView.tsx      # Contratos
│   │   │   ├── ServiceProvidersView.tsx # Prestadores
│   │   │   ├── AppointmentsView.tsx   # Compromissos
│   │   │   ├── ReportsView.tsx        # Relatórios
│   │   │   └── SettingsView.tsx       # Configurações
│   │   ├── PropertyDialogForm.tsx     # Formulário de propriedade
│   │   ├── GuestDialogForm.tsx        # Formulário de hóspede
│   │   ├── ContractDialogForm.tsx     # Formulário de contrato
│   │   └── AppointmentDialogForm.tsx  # Formulário de compromisso
│   ├── lib/
│   │   ├── utils.ts                   # Utilitários gerais
│   │   ├── i18n.ts                    # Traduções PT/EN
│   │   ├── LanguageContext.tsx        # Contexto de idioma
│   │   └── CurrencyContext.tsx        # Contexto de moeda
│   ├── types/
│   │   └── index.ts                   # Definições TypeScript
│   ├── hooks/
│   │   └── use-mobile.ts              # Hook de detecção mobile
│   ├── App.tsx                        # Componente principal
│   ├── index.css                      # Estilos e tema
│   └── main.tsx                       # Entry point
├── index.html                         # HTML base
├── package.json                       # Dependências
├── tailwind.config.js                 # Configuração Tailwind
├── tsconfig.json                      # Configuração TypeScript
└── vite.config.ts                     # Configuração Vite
```

## 📊 Modelo de Dados

### Property (Propriedade)
```typescript
{
  id: string
  name: string
  type: 'room' | 'apartment' | 'house'
  capacity: number
  pricePerNight: number
  pricePerMonth: number
  status: 'available' | 'occupied' | 'maintenance'
  description: string
  createdAt: string
}
```

### Transaction (Transação)
```typescript
{
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  description: string
  date: string
  propertyId?: string
  contractId?: string          // Para receitas
  serviceProviderId?: string   // Para despesas
  createdAt: string
}
```

### Guest (Hóspede)
```typescript
{
  id: string
  name: string
  email: string
  phone: string
  document: string
  address?: string
  nationality?: string
  dateOfBirth?: string
  notes?: string
  createdAt: string
}
```

### Contract (Contrato)
```typescript
{
  id: string
  guestId: string
  propertyIds: string[]        // Múltiplas propriedades
  rentalType: 'short-term' | 'monthly'
  startDate: string
  endDate: string
  paymentDueDay: number        // Dia do mês (1-31)
  monthlyAmount: number
  status: 'active' | 'expired' | 'cancelled'
  notes?: string
  createdAt: string
}
```

### ServiceProvider (Prestador de Serviço)
```typescript
{
  id: string
  name: string
  service: string
  contact: string
  email?: string
}
```

### Appointment (Compromisso)
```typescript
{
  id: string
  title: string
  description?: string
  date: string
  time: string
  status: 'scheduled' | 'completed' | 'cancelled'
  serviceProviderId?: string
  contractId?: string
  guestId?: string
  propertyId?: string
  notes?: string
  completionNotes?: string     // Observações ao concluir
  completedAt?: string
  createdAt: string
}
```

### Task (Tarefa)
```typescript
{
  id: string
  title: string
  description: string
  dueDate: string
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'in-progress' | 'completed'
  assignee?: string
  propertyId?: string
  createdAt: string
}
```

## ⚙️ Configurações

### Idioma

O sistema suporta dois idiomas:
- **Português (PT)** - Padrão
- **English (EN)**

**Como alterar:**
1. Acesse a aba "Configurações"
2. Seção "Idioma"
3. Selecione o idioma desejado
4. A interface é atualizada instantaneamente

### Moeda

Suporte para múltiplas moedas globais:
- BRL (R$) - Real Brasileiro
- USD ($) - Dólar Americano
- EUR (€) - Euro
- GBP (£) - Libra Esterlina
- JPY (¥) - Iene Japonês
- CAD (C$) - Dólar Canadense
- AUD (A$) - Dólar Australiano
- CHF (Fr) - Franco Suíço
- CNY (¥) - Yuan Chinês
- MXN ($) - Peso Mexicano

**Como alterar:**
1. Acesse "Configurações"
2. Seção "Moeda"
3. Selecione a moeda corrente
4. Todos os valores do sistema são atualizados automaticamente

## 📈 Relatórios e Análises

### Métricas Financeiras

O sistema calcula automaticamente:

- **Receita Total**: Soma de todas as transações de entrada
- **Despesas Totais**: Soma de todas as transações de saída
- **Lucro Líquido**: Receita - Despesas
- **Saldo**: Disponível no cabeçalho principal

### Gráficos Disponíveis

1. **Receita por Propriedade** (Gráfico de Barras)
   - Baseado em transações vinculadas a contratos
   - Cálculo proporcional para contratos com múltiplas propriedades
   - Filtro por período personalizável

2. **Taxa de Ocupação** (Indicador Percentual)
   - Calcula dias ocupados vs. dias disponíveis
   - Baseado em contratos vigentes
   - Exibido por propriedade

3. **Tendência Financeira** (Gráfico de Linha)
   - Últimos 6 meses
   - Linhas separadas para receitas e despesas
   - Visualização de evolução temporal

4. **Fluxo de Caixa Mensal** (Gráfico de Barras)
   - Segmentação mês a mês
   - Comparação de entrada vs. saída
   - Saldo líquido por período

### Filtros de Período

Todos os relatórios financeiros suportam:
- **Período personalizado**: Selecione data inicial e final
- **Pré-definidos**: Mês atual, trimestre, ano
- **Atualização em tempo real**: Dados atualizados instantaneamente

## 💾 Persistência de Dados

O sistema utiliza o **Spark KV API** para persistência:

### Armazenamento

Todos os dados são armazenados localmente e persistem entre sessões:
- `properties` - Lista de propriedades
- `transactions` - Transações financeiras
- `guests` - Cadastro de hóspedes
- `contracts` - Contratos
- `service-providers` - Prestadores de serviço
- `appointments` - Compromissos
- `tasks` - Tarefas
- `bookings` - Reservas (legado)
- `language` - Idioma selecionado
- `currency` - Moeda corrente

### Hook useKV

Uso recomendado para dados persistentes:
```typescript
const [data, setData, deleteData] = useKV('key', defaultValue)

// Sempre use functional updates
setData((current) => [...current, newItem])
```

## 🎨 Design e Tema

### Paleta de Cores

- **Primary**: `oklch(0.45 0.15 250)` - Azul profundo para ações principais
- **Accent**: `oklch(0.68 0.19 25)` - Laranja quente para destaques
- **Success**: `oklch(0.88 0.05 140)` - Verde suave para confirmações
- **Destructive**: `oklch(0.577 0.245 27.325)` - Vermelho para ações destrutivas
- **Background**: `oklch(0.98 0.01 85)` - Fundo claro e acolhedor
- **Foreground**: `oklch(0.25 0.02 250)` - Texto principal escuro

### Tipografia

- **Heading**: Space Grotesk (400, 500, 600, 700)
- **Body**: Inter (400, 500, 600)

### Raio de Borda

- Base: `0.5rem`
- Variações automáticas: sm, md, lg, xl, 2xl, full

## 🔄 Funcionalidades em Desenvolvimento

### Integrações Futuras

- **Airbnb API**: Sincronização automática de reservas
- **Booking.com API**: Importação de reservas
- **Redes Sociais**: Divulgação automática de propriedades disponíveis
- **WhatsApp Business**: Notificações e lembretes

### Melhorias Planejadas

- **Dashboard Avançado**: Mais KPIs e métricas
- **Exportação de Relatórios**: PDF e Excel
- **Notificações Push**: Lembretes de vencimentos
- **App Mobile**: Versão nativa para iOS e Android
- **Multi-usuário**: Compartilhamento com equipe
- **Backup Automático**: Sincronização em nuvem

## 📱 Responsividade

A aplicação é totalmente responsiva e se adapta a diferentes tamanhos de tela:

- **Desktop**: Layout completo com todas as funcionalidades
- **Tablet**: Interface adaptada com navegação otimizada
- **Mobile**: Design mobile-first com navegação simplificada
- **Breakpoint**: 768px (definido em `use-mobile.ts`)

## 🔒 Segurança

- Dados armazenados localmente no navegador
- Sem exposição de informações sensíveis
- Validação de formulários com Zod
- TypeScript para type safety

## 📄 Licença

Este projeto utiliza componentes e recursos do Spark Template licenciados sob MIT License, Copyright GitHub, Inc.

## 🤝 Suporte

Para questões, sugestões ou reportar problemas, utilize os recursos disponíveis na plataforma Spark.

---

**RentFlow** - Simplifique a gestão das suas propriedades 🏠✨
