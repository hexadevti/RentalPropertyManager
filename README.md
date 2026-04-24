# RPM — Rental Property Manager

Sistema SaaS multi-tenant de gestão de propriedades para aluguel de curta e longa temporada, com backend Supabase e deploy no Cloudflare Pages.

## Visão Geral

RPM é uma plataforma completa para gestores e proprietários de imóveis. Cada conta (tenant) opera de forma totalmente isolada. O sistema cobre o ciclo completo: cadastro de imóveis, contratos, hóspedes, finanças, vistorias, tarefas, documentos e um assistente de IA com acesso dinâmico ao banco de dados.

---

## Tecnologias

### Frontend
| Camada | Tecnologia |
|---|---|
| Framework | React 19 + TypeScript 5 |
| Build | Vite |
| Estilo | Tailwind CSS v4 |
| Componentes | shadcn/ui (Radix UI) |
| Ícones | Phosphor Icons |
| Gráficos | Recharts + D3.js |
| Notificações | Sonner |
| Datas | date-fns |

### Backend
| Camada | Tecnologia |
|---|---|
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth (GitHub OAuth + email/senha) |
| Edge Functions | Deno (Supabase Functions) |
| Storage | Supabase Storage |
| IA | Anthropic Claude API (claude-sonnet-4-6) |

### Deploy
- **Frontend**: Cloudflare Pages
- **Backend**: Supabase (self-hosted ou cloud)

---

## Funcionalidades

### Módulos principais

| Módulo | Descrição |
|---|---|
| **Propriedades** | Cadastro de quartos, apartamentos e casas com preços, ambientes, mobília e itens de vistoria |
| **Proprietários** | Cadastro de proprietários com vínculos às propriedades |
| **Hóspedes / Inquilinos** | Cadastro completo com documentos, dependentes e sponsors |
| **Contratos** | Contratos de curta temporada e mensais, geração de PDF via templates |
| **Financeiro** | Receitas e despesas categorizadas, fluxo de caixa mensal |
| **Tarefas** | Gestão de tarefas com prioridade, status e atribuição |
| **Agenda** | Compromissos vinculados a hóspedes, prestadores e contratos |
| **Prestadores** | Cadastro de prestadores de serviço |
| **Documentos** | Upload e organização de documentos por categoria e entidade |
| **Vistorias** | Checklist digital por ambiente (entrada, saída, manutenção, periódica) |
| **Calendário** | Visualização de ocupação, contratos e compromissos |
| **Relatórios** | Receita por propriedade, taxa de ocupação, tendência financeira |
| **Templates** | Templates de contrato em HTML com tokens e suporte multilíngue |
| **Notificações** | Regras de notificação por email/SMS/WhatsApp com templates |
| **Assistente IA** | Chat com Claude que consulta o banco dinamicamente via tool use |

### Importação via CSV

Todos os cadastros principais suportam importação em lote via CSV:

| Entidade | Template gerado | Campos principais |
|---|---|---|
| Propriedades | `template-propriedades.csv` | name, type, capacity, pricePerNight, pricePerMonth, address, city... |
| Hóspedes | `template-hospedes.csv` | name, email, phone, nationality, documentType, documentNumber... |
| Proprietários | `template-proprietarios.csv` | name, email, phone, nationality, documentType, documentNumber... |
| Transações | `template-transacoes.csv` | type, amount, category, description, date |
| Contratos | `template-contratos.csv` | guestName, propertyNames, rentalType, startDate, endDate, monthlyAmount... |
| Prestadores | `template-prestadores.csv` | name, service, phone, email, document, address... |

- Suporta separadores `,` e `;`
- Suporta campos entre aspas com vírgulas internas
- Datas aceitas: `YYYY-MM-DD` e `DD/MM/YYYY`
- Preview com tabela antes de confirmar a importação

### Assistente de IA

O assistente usa **Claude** (Anthropic) via Supabase Edge Function com **tool use agentic**:

- Claude decide quais tabelas consultar para cada pergunta
- Executa múltiplas queries dinamicamente (até 10 iterações)
- Todas as consultas são filtradas por `tenant_id` automaticamente
- Sem limite de linhas pré-carregadas — busca apenas o necessário
- Modelos disponíveis: Claude Sonnet 4.6 (padrão), Haiku 4.5, Opus 4.7

### Controle de Acesso

- **Platform Admins**: Acesso a todos os tenants
- **Tenant Admins**: Acesso total ao próprio tenant
- **Perfis de acesso customizados**: Permissões por módulo (none / read / write)
- **Usuários convidados**: Convite por email com link de acesso
- **Status de usuário**: pending → approved / blocked

### Internacionalização

- Idiomas: Português (PT), English (EN)
- Moedas: BRL, USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, MXN e outras
- Formatos de data e telefone configuráveis por região

---

## Arquitetura Multi-Tenant

Todos os dados são particionados por `tenant_id`. A isolação é garantida por:

1. RLS (Row Level Security) no Supabase
2. Filtro `tenant_id` obrigatório em todas as queries do Edge Function
3. Resolução de tenant via JWT + `user_profiles` no servidor

```
User JWT → Edge Function → resolve tenant_id → queries filtradas por tenant
```

---

## Estrutura do Projeto

```
/
├── src/
│   ├── components/
│   │   ├── ui/                        # shadcn/ui base components
│   │   ├── views/                     # Telas principais
│   │   │   ├── PropertiesView.tsx     # + importação CSV
│   │   │   ├── OwnersView.tsx         # + importação CSV
│   │   │   ├── GuestsView.tsx         # + importação CSV
│   │   │   ├── ContractsView.tsx      # + importação CSV + PDF
│   │   │   ├── FinancesView.tsx       # + importação CSV
│   │   │   ├── ServiceProvidersView.tsx # + importação CSV
│   │   │   ├── AiAssistantView.tsx    # Claude tool use
│   │   │   ├── InspectionsView.tsx
│   │   │   ├── TasksView.tsx
│   │   │   ├── AppointmentsView.tsx
│   │   │   ├── CalendarView.tsx
│   │   │   ├── ReportsView.tsx
│   │   │   ├── DocumentsView.tsx
│   │   │   ├── ContractTemplatesView.tsx
│   │   │   ├── NotificationsView.tsx
│   │   │   ├── UsersPermissionsView.tsx
│   │   │   ├── AccessProfilesView.tsx
│   │   │   └── TenantManagementView.tsx
│   │   └── ...                        # Formulários e componentes compartilhados
│   ├── lib/
│   │   ├── i18n.ts                    # Traduções PT/EN
│   │   ├── useSupabaseKV.ts           # Hook de persistência Supabase
│   │   ├── AuthContext.tsx            # Contexto de autenticação
│   │   ├── LanguageContext.tsx
│   │   ├── CurrencyContext.tsx
│   │   ├── DateFormatContext.tsx
│   │   └── PhoneFormatContext.tsx
│   └── types/index.ts                 # Tipos TypeScript globais
├── supabase/
│   ├── functions/
│   │   ├── ai-assistant/              # Edge Function — Claude tool use
│   │   │   ├── index.ts
│   │   │   └── helpers.ts
│   │   └── tenant-user-invitations/   # Edge Function — convites
│   └── *.sql                          # Migrações do banco
└── docs/                              # Arquivos de ajuda contextual (Markdown)
```

---

## Variáveis de Ambiente

### Frontend (`.env.local`)

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Edge Functions (Supabase Secrets)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ANTHROPIC_MODEL=claude-sonnet-4-6   # opcional
supabase secrets set OPENAI_API_KEY=sk-...               # legado, não necessário
```

---

## Modelo de Dados (resumido)

```typescript
Property      { id, name, type, capacity, pricePerNight, pricePerMonth, address, city, ownerIds[], environments[], furnitureItems[], inspectionItems[] }
Owner         { id, name, email, phone, documents[], nationality, maritalStatus, profession, address }
Guest         { id, name, email, phone, documents[], sponsors[], dependents[], nationality, dateOfBirth }
Contract      { id, guestId, propertyIds[], rentalType, startDate, endDate, monthlyAmount, paymentDueDay, status, templateId }
Transaction   { id, type: 'income'|'expense', amount, category, description, date, propertyId, contractId, serviceProviderId }
ServiceProvider { id, name, service, phone, email, document, address }
Task          { id, title, dueDate, priority, status, assigneeName, propertyId }
Appointment   { id, title, date, time, status, serviceProviderId, contractId, guestId, propertyId }
Inspection    { id, propertyId, contractId, type, status, scheduledDate, areas[{ name, items[{ label, condition }] }] }
Document      { id, name, category, relationType, relationId, filePath }
ContractTemplate { id, name, type, language, content }
```

---

## Deploy

### Cloudflare Pages

```bash
npm run build
# Output: dist/
# Build command: npm run build
# Build output directory: dist
```

### Supabase Migrations

```bash
supabase db push
supabase functions deploy ai-assistant
supabase functions deploy tenant-user-invitations
```

---

## Segurança

- Autenticação via Supabase Auth (GitHub OAuth + email/senha)
- RLS ativo em todas as tabelas com isolação por `tenant_id`
- Edge Functions validam JWT e resolvem `tenant_id` server-side
- Assistente IA: somente admins aprovados têm acesso
- Assistente IA: tabelas sensíveis (user_profiles, audit_logs, etc.) são bloqueadas na allowlist
- Convites de usuário com expiração e revogação

---

*RPM — Gestão de imóveis do jeito profissional* 🏠
