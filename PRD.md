# PRD — RPM: Rental Property Manager

## Visão do Produto

Plataforma SaaS multi-tenant de gestão de propriedades para aluguel, voltada para proprietários e gestores de imóveis residenciais de curta e longa temporada. Cada tenant opera com dados completamente isolados, autenticação própria e configurações independentes.

**Qualidades essenciais:**
1. **Profissional e confiável** — Design limpo, dados consistentes, zero perda de informação
2. **Eficiente** — Fluxos rápidos, importação em lote, atalhos de teclado no chat
3. **Seguro por design** — RLS no banco, validação server-side, tenant isolation em todos os layers

---

## Stack Atual

| Camada | Tecnologia |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| IA | Anthropic Claude API — tool use agentic |
| Deploy | Cloudflare Pages (frontend) + Supabase Cloud (backend) |
| Auth | GitHub OAuth + email/senha via Supabase Auth |

---

## Módulos Implementados

### 1. Propriedades
- Tipos: quarto, apartamento, casa
- Campos: nome, capacidade, preços (diária/mensal), endereço, cidade, estado de conservação, descrição
- Listas: ambientes, mobília, itens de vistoria
- Vínculos: proprietários (N:N via `property_owners`)
- Visualizações: grid de cards + mapa (geocoding)
- Status automático baseado em contratos ativos
- **Importação CSV** com template para download

### 2. Proprietários
- Dados pessoais completos + documentos múltiplos
- Vínculo com propriedades
- **Importação CSV**

### 3. Hóspedes / Inquilinos
- Dados pessoais + documentos + dependentes + sponsors
- Histórico de contratos
- **Importação CSV**

### 4. Contratos
- Tipos: mensal / temporada curta
- Múltiplas propriedades por contrato (via `contract_properties`)
- Status calculado automaticamente (active / expired / cancelled)
- Data de fechamento opcional
- Condição especial de pagamento
- Geração de PDF via templates HTML com tokens `{{variavel}}`
- **Importação CSV** com match por nome de hóspede e propriedade

### 5. Financeiro
- Receitas e despesas categorizadas
- Vínculos: propriedade, contrato, prestador de serviço
- Fluxo de caixa mensal agrupado
- Filtros: mês, período, contrato, hóspede, categoria, prestador, proprietário, propriedade
- **Importação CSV** com suporte a `DD/MM/YYYY` e `YYYY-MM-DD`

### 6. Prestadores de Serviço
- Nome, serviço, telefone, email, documento, endereço
- Vínculo com transações e compromissos
- **Importação CSV**

### 7. Vistorias
- Tipos: entrada, saída, manutenção, periódica
- Status: rascunho, em andamento, avaliado
- Checklist por ambiente com condição de cada item (excelente/bom/atenção/danificado/N/A)
- Vistoria comparativa (check-out referencia check-in)
- Vínculo com contrato e propriedade

### 8. Tarefas
- Prioridade: baixa / média / alta
- Status: pendente / em andamento / concluída
- Atribuição por nome, tipo e ID (hóspede, prestador, etc.)
- Vínculo com propriedade

### 9. Agenda (Compromissos)
- Data, hora, status
- Vínculos múltiplos: prestador, contrato, hóspede, propriedade
- Observações de conclusão
- Integrado ao calendário geral

### 10. Calendário
- Visão de 3 meses (anterior, atual, próximo)
- Eventos: contratos, compromissos, tarefas, vencimentos
- Cores por tipo de evento
- Filtro por propriedade

### 11. Documentos
- Upload via Supabase Storage
- Categorias: contrato, recibo, seguro, imposto, outro
- Relação com: geral, propriedade, contrato, hóspede, proprietário

### 12. Templates de Contrato
- Tipos: mensal / temporada curta
- Suporte multilíngue (PT, EN, ES, FR, DE, IT, NL, AR, ZH, JA, PL, RU)
- Tokens dinâmicos `{{guest_name}}`, `{{property_name}}`, etc.
- Tradução automática via Claude
- Agrupamento por `translation_group_id`

### 13. Notificações
- Canais: email, SMS, WhatsApp
- Triggers: vencimento de contrato, pagamento, tarefas, vistorias, acesso de usuário, bugs
- Templates HTML e texto por idioma
- Destinatários: por role, usuários específicos, responsável pela tarefa, destinatário do evento
- Regras ativas/inativas com dias de antecedência configuráveis

### 14. Relatórios
- Receita por propriedade (gráfico de barras)
- Taxa de ocupação por propriedade
- Tendência financeira (últimos 6 meses)
- Fluxo de caixa mensal
- Próximas tarefas e contratos recentes
- Filtros por período

### 15. Assistente IA (Claude)
- Edge Function Deno chamando Anthropic API (`/v1/messages`)
- Tool `query_supabase`: Claude decide o que buscar, quais filtros, quais tabelas
- Loop agentic: até 10 iterações de tool use por resposta
- Escopo obrigatório: `tenant_id` injetado no system prompt e em todas as queries
- Tabelas restritas bloqueadas na allowlist (user_profiles, audit_logs, etc.)
- Somente leitura: write requests são bloqueados
- Log de uso: tokens consumidos, custo estimado, modelo, por tenant e usuário
- Modelos: Claude Sonnet 4.6 (padrão), Haiku 4.5, Opus 4.7

### 16. Controle de Acesso
- Perfis de acesso customizados com permissões por módulo (none / read / write)
- Convite de usuários por email com link e expiração
- Status de usuário: pending / approved / blocked
- Platform admins com acesso cross-tenant

### 17. Gestão de Tenant
- Nome do tenant configurável
- Preferências regionais: idioma, moeda, formato de data, formato de telefone

### 18. Internacionalização
- Idiomas da interface: PT (padrão), EN
- Moedas: BRL, USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, MXN e outras
- Formato de telefone por país (libphonenumber)
- Formato de data configurável

---

## Arquitetura de Dados

### Particionamento
Todos os dados do tenant são isolados por `tenant_id` (UUID). RLS ativo em todas as tabelas.

### Tabelas principais
```
tenants, user_profiles, platform_admins
properties, property_owners (junction)
owners
guests, guest_documents, guest_related_persons
contracts, contract_properties (junction)
transactions
service_providers
tasks
appointments
inspections, inspection_areas, inspection_area_items
documents
contract_templates, notification_templates, notification_master_templates
notification_rules, notification_deliveries
access_profiles, access_profile_roles
tenant_user_invitations
ai_usage_logs
app_audit_logs
bug_reports, contact_messages
```

---

## Decisões de Arquitetura

| Decisão | Escolha | Motivo |
|---|---|---|
| Persistência frontend | `useSupabaseKV` (Supabase como KV store) | Sync em tempo real, multi-device |
| IA | Claude tool use vs. contexto pré-carregado | Sem limite de linhas, queries dinâmicas, mais preciso |
| Auth | Supabase Auth (GitHub + email) | Flexibilidade, sem servidor próprio |
| Tenant isolation | RLS + filtro server-side | Dupla camada de segurança |
| Deploy | Cloudflare Pages | CDN global, CI/CD simples |
| PDF | Edge Function + Deno | Sem dependências nativas no frontend |

---

## Próximos Passos / Backlog

- [ ] Integração com channel manager (Beds24, Tokeet) via tool do assistente IA
- [ ] Exportação de relatórios em PDF/Excel
- [ ] App mobile (React Native ou PWA)
- [ ] Notificações push (web)
- [ ] Dashboard executivo com KPIs consolidados
- [ ] Bulk actions na listagem de transações
- [ ] Importação de reservas via CSV do Booking.com
