# Planning Guide

Uma plataforma abrangente de gestão de propriedades para ajudar gestores a rastrear aluguéis, finanças, hóspedes, contratos e manutenção com autenticação de usuário via GitHub.

**Experience Qualities**: 
1. **Profissional e Confiável** - Inspira confiança através de design limpo e funcionalidade confiável
2. **Eficiente e Organizado** - Permite acesso rápido à informação com navegação intuitiva
3. **Seguro e Baseado em Funções** - Protege dados sensíveis com autenticação GitHub e controle de acesso baseado em função

**Complexity Level**: Complex Application (funcionalidade avançada com múltiplas visualizações)
Esta é uma plataforma completa de gestão de propriedades com múltiplos módulos interconectados incluindo gestão de propriedades, rastreamento financeiro, calendário/agendamento, gestão de documentos, capacidades de relatórios e gestão de funções de usuário com autenticação GitHub.

## Essential Features

### Autenticação de Usuário e Gestão de Funções
- **Functionality**: Autenticação OAuth GitHub com criação automática de perfil de usuário. Controle de acesso baseado em função com dois perfis: Administrador e Hóspede
- **Purpose**: Controle de acesso seguro e experiência personalizada baseada em funções de usuário
- **Trigger**: Automático ao carregar app via API rpm.user()
- **Progression**: Carregar usuário GitHub → Verificar perfil existente → Criar/recuperar perfil de usuário → Atribuir função (owner=admin, outros=guest) → Exibir info de usuário no cabeçalho
- **Success criteria**: Usuário vê seu avatar GitHub, nome de usuário e distintivo de função no cabeçalho. Admins podem gerenciar funções de usuário em Configurações

### Registro de Propriedades
- **Functionality**: Adicionar, editar e gerenciar propriedades (quartos, apartamentos, casas) com detalhes como nome, tipo, capacidade, preços
- **Purpose**: Registro central de todas as unidades de aluguel disponíveis para gestão
- **Trigger**: Clicar no botão "Adicionar Propriedade" na visualização de Propriedades
- **Progression**: Clicar em Adicionar → Preencher formulário (nome, tipo, capacidade, preços) → Salvar → Propriedade aparece na grade
- **Success criteria**: Propriedade é exibida com cartão visual mostrando todos os detalhes, status e ações disponíveis

### Gestão Financeira
- **Functionality**: Rastrear receitas e despesas, categorizar transações, vincular a propriedades
- **Purpose**: Manter registros financeiros precisos e visibilidade do fluxo de caixa
- **Trigger**: Clicar em "Nova Transação" na aba Finanças
- **Progression**: Selecionar tipo (receita/despesa) → Inserir valor e detalhes → Vincular à propriedade (opcional) → Salvar → Atualizar saldo
- **Success criteria**: Saldo atualiza em tempo real, transações aparecem em lista ordenada, gráficos de resumo financeiro exibem dados

### Calendário de Reservas
- **Functionality**: Visualizar, adicionar e gerenciar reservas com datas de check-in/out
- **Purpose**: Evitar conflitos de agendamento e maximizar ocupação
- **Trigger**: Navegar para aba Calendário, clicar em "Nova Reserva"
- **Progression**: Selecionar propriedade → Inserir detalhes do hóspede → Escolher datas → Definir valor → Salvar → Reserva aparece no calendário
- **Success criteria**: Calendário visual mostra todas as reservas, impede sobreposições, exibe indicadores de ocupação

### Gestão de Tarefas
- **Functionality**: Agendar manutenção, inspeções e tarefas administrativas com datas de vencimento
- **Purpose**: Garantir que propriedades sejam mantidas e tarefas não sejam esquecidas
- **Trigger**: Navegar para aba Tarefas, clicar em "Adicionar Tarefa"
- **Progression**: Inserir título e descrição → Definir prioridade e data de vencimento → Atribuir responsável → Vincular à propriedade → Salvar
- **Success criteria**: Tarefas aparecem organizadas por status e prioridade, avisos de vencimento funcionam

### Cadastro de Hóspedes
- **Functionality**: Manter banco de dados de informações de hóspedes para referência rápida
- **Purpose**: Centralizar informações de contato e histórico de hóspedes
- **Trigger**: Clicar em "Adicionar Hóspede" na aba Hóspedes
- **Progression**: Inserir detalhes completos do hóspede → Salvar → Perfil do hóspede criado
- **Success criteria**: Hóspedes podem ser pesquisados, editados e visualizados com histórico de reservas

### Gestão de Contratos
- **Functionality**: Criar e gerenciar contratos de aluguel vinculados a hóspedes e propriedades
- **Purpose**: Formalizar acordos de aluguel e rastrear termos
- **Trigger**: Clicar em "Novo Contrato" na aba Contratos
- **Progression**: Selecionar hóspede → Escolher propriedade(s) → Definir tipo de aluguel e datas → Inserir valor mensal → Salvar
- **Success criteria**: Contratos exibem status (ativo/expirado), podem ser filtrados, mostram propriedades vinculadas

### Gestão de Compromissos
- **Functionality**: Agendar e rastrear compromissos vinculados a prestadores, contratos, hóspedes ou propriedades
- **Purpose**: Coordenar visitas, manutenção e reuniões
- **Trigger**: Clicar em "Novo Compromisso" na aba Compromissos
- **Progression**: Inserir título e descrição → Escolher data e hora → Vincular a entidades relacionadas → Salvar
- **Success criteria**: Compromissos aparecem ordenados por data, podem ser filtrados por status

### Prestadores de Serviço
- **Functionality**: Manter lista de prestadores de serviço com informações de contato
- **Purpose**: Acesso rápido a contatos de manutenção e serviço
- **Trigger**: Adicionar na seção de Finanças ou visualização dedicada
- **Progression**: Inserir nome, serviço e informações de contato → Salvar
- **Success criteria**: Prestadores podem ser vinculados a transações e compromissos

### Relatórios e Análises
- **Functionality**: Gerar resumos financeiros, taxas de ocupação e relatórios de receita
- **Purpose**: Fornecer insights para tomada de decisão
- **Trigger**: Navegar para visualização de Relatórios
- **Progression**: Visualização automática → Gráficos e tabelas exibem dados → Pode filtrar por período
- **Success criteria**: Gráficos visuais mostram tendências, métricas de desempenho são claras e precisas

### Configurações e Preferências
- **Functionality**: Personalizar idioma (PT/EN) e moeda (BRL/USD/EUR/GBP)
- **Purpose**: Adaptar o sistema a preferências regionais
- **Trigger**: Navegar para aba Configurações
- **Progression**: Selecionar idioma → Escolher moeda → Alterações aplicadas imediatamente
- **Success criteria**: Interface atualiza instantaneamente, preferências persistem entre sessões

## Edge Case Handling
- **Reservas Sobrepostas**: Sistema previne dupla reserva verificando disponibilidade no calendário
- **Dados Ausentes**: Validação de formulário garante que campos obrigatórios sejam preenchidos
- **Contratos Expirados**: Status atualiza automaticamente baseado em datas
- **Usuários Não Aprovados**: Sistema mostra tela de aprovação pendente para novos usuários
- **Permissões de Função**: Hóspedes veem visualização limitada (Calendário, Contratos, Compromissos, Configurações)
- **Exclusões**: Diálogos de confirmação previnem exclusões acidentais
- **Sincronização de Dados**: useKV garante persistência de dados entre sessões

## Design Direction
O design deve evocar confiança, eficiência e controle—sentindo-se como uma ferramenta profissional de negócios enquanto permanece acessível e fácil de navegar.

## Color Selection
Esquema de cores profissional com tons azuis profundos para confiança, acentos quentes para ações, e tons neutros para legibilidade.

- **Primary Color**: Azul Profundo (`oklch(0.45 0.15 250)`) - Inspira confiança, usado em ações principais e navegação
- **Secondary Colors**: 
  - Ardósia Suave (`oklch(0.95 0.01 250)`) - Fundos secundários, seções sutis
  - Sálvia Quente (`oklch(0.88 0.05 140)`) - Estados de sucesso, fluxo de caixa positivo
- **Accent Color**: Laranja Quente (`oklch(0.68 0.19 25)`) - Chamadas para ação, elementos importantes
- **Foreground/Background Pairings**: 
  - Background (Bege Claro `oklch(0.98 0.01 85)`): Foreground (`oklch(0.25 0.02 250)`) - Ratio 13.1:1 ✓
  - Card (Branco `oklch(1 0 0)`): Card foreground (`oklch(0.25 0.02 250)`) - Ratio 14.2:1 ✓
  - Primary (Azul Profundo): White (`oklch(1 0 0)`) - Ratio 8.9:1 ✓
  - Accent (Laranja Quente): White (`oklch(1 0 0)`) - Ratio 4.6:1 ✓
  - Muted (Ardósia Suave): Muted foreground (`oklch(0.50 0.02 250)`) - Ratio 7.1:1 ✓

## Font Selection
Combinar Space Grotesk (moderno, técnico, confiável) para títulos com Inter (limpo, legível) para corpo de texto.

- **Typographic Hierarchy**: 
  - H1 (Título do App): Space Grotesk Bold / 28px / -0.02em letter spacing
  - H2 (Cabeçalhos de Seção): Space Grotesk SemiBold / 24px / -0.01em letter spacing
  - H3 (Títulos de Card): Space Grotesk Medium / 18px / normal letter spacing
  - Body (Conteúdo): Inter Regular / 15px / 1.5 line height
  - Labels: Inter Medium / 14px / 0.01em letter spacing
  - Buttons: Inter SemiBold / 15px / 0.005em letter spacing
  - Small Text: Inter Regular / 13px / 1.4 line height

## Animations
Animações devem melhorar a usabilidade sem atrasar interações—transições sutis ao abrir diálogos, hover suave em cards, e feedback tátil em botões.

- Diálogos/Modais: Fade in com escala sutil (0.95 → 1.0) em 200ms
- Cards: Hover eleva com transição de sombra
- Botões: Hover escurece ligeiramente, active pressiona com escala
- Transições de Tab: Fade entre conteúdos em 150ms
- Toast notifications: Slide in da direita com spring animation

## Component Selection

- **Components**: 
  - Tabs (navegação principal, shadcn/ui)
  - Dialog (modais de formulário, shadcn/ui)
  - Card (containers de propriedade/transação, shadcn/ui)
  - Calendar (date picker e grade de disponibilidade de react-day-picker)
  - Input, Textarea, Select (controles de formulário)
  - Badge (indicadores de status e função)
  - Button (ações primárias e secundárias)
  - Alert Dialog (confirmações de exclusão)
  - Toast (sonner para notificações de feedback)
  - Avatar (exibição de usuário com imagens GitHub)
  - Sheet (painéis deslizantes móveis para formulários)

- **Customizations**: 
  - Componentes de card de propriedade personalizados com gradientes de fundo
  - Navegação por tabs responsiva que colapsa em telas menores
  - Layout de grade de calendário personalizado para reservas

- **States**: 
  - Botões: Primário sólido com texto branco, secundário outline, ghost para ícones; hover eleva com sombra, active pressiona
  - Inputs: Border azul sutil no foco com transição de ring, erro mostra borda vermelha
  - Cards: Hover eleva com transição de sombra, cards clicáveis escalam ligeiramente
  - Badges: Cores baseadas em contexto (azul para primário, verde para sucesso, vermelho para destrutivo)

- **Icon Selection**: 
  - Phosphor Icons (duotone weight para consistência visual)
  - Plus (ações de adicionar), Pencil (editar), Trash (excluir), Calendar (agendamento), Wallet (finanças)
  - House (propriedades), User (hóspedes), Files (contratos), Wrench (prestadores), CalendarCheck (compromissos)
  - CheckSquare (tarefas), ChartBar (relatórios), Gear (configurações)

- **Spacing**: 
  - Container: px-6 (24px horizontal padding)
  - Section gaps: gap-6 (24px between major sections)
  - Card padding: p-6 (24px internal padding)
  - Form spacing: gap-4 entre campos (16px)
  - Button padding: px-4 py-2 (16px × 8px)

- **Mobile**: 
  - Tabs mostram apenas ícones em telas pequenas (ocultar texto com `hidden sm:inline`)
  - Formulários usam inputs de largura total com alvos de toque maiores (min 44px)
  - Cards empilham verticalmente em mobile
  - Grids responsivas usam breakpoints Tailwind (sm, md, lg)
  - Saldo e contadores do cabeçalho ocultam em telas muito pequenas
