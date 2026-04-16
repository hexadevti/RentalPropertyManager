# RentFlow - Sistema de Autenticação

## Visão Geral

O RentFlow inclui um sistema completo de autenticação baseado no GitHub, com controle de acesso por perfis (roles) e sistema de aprovação de usuários.

## Status de Usuário

### ✅ Aprovado (approved)
- Usuário tem acesso ao sistema de acordo com seu perfil
- Pode utilizar todas as funcionalidades permitidas pelo seu role

### ⏳ Pendente (pending)
- Aguardando aprovação de um administrador
- Não tem acesso ao sistema até ser aprovado
- Vê tela de "Aguardando Aprovação"

### ❌ Rejeitado (rejected)
- Acesso negado ao sistema
- Vê tela de "Acesso Negado"
- Pode ser reativado por um administrador alterando o status

## Perfis de Usuário

### 👑 Administrador
- Acesso completo a todas as funcionalidades
- Pode gerenciar perfis de outros usuários
- Pode aprovar/rejeitar novos usuários
- Pode criar usuários manualmente
- Automaticamente aprovado se for o owner do Spark
- Pode adicionar/editar/excluir todos os recursos

### 👤 Hóspede
- Acesso limitado às funcionalidades
- Não pode gerenciar outros usuários
- Precisa aguardar aprovação de administrador
- Acesso apenas a: Calendário, Contratos, Agendamentos e Configurações
- Acesso de visualização e funcionalidades básicas

## Como Funciona

### Autenticação Automática
1. O usuário acessa o aplicativo
2. Sistema busca informações do usuário logado via `spark.user()`
3. Cria ou recupera perfil do usuário no banco de dados local
4. Se for o owner: atribui role `admin` com status `approved`
5. Se não for owner: atribui role `guest` com status `pending`
6. Verifica o status de aprovação antes de liberar acesso

### Criação de Usuários
Administradores podem criar usuários manualmente:
1. Na aba "Configurações", acessar "Gerenciamento de Usuários"
2. Clicar em "Criar Usuário"
3. Informar o email do GitHub do usuário
4. Selecionar o perfil (Admin ou Hóspede)
5. Usuário é criado com status `approved` automaticamente

### Aprovação de Usuários
1. Novo usuário acessa o sistema e vê tela de "Aguardando Aprovação"
2. Administrador acessa "Gerenciamento de Usuários"
3. Vê lista de usuários pendentes
4. Pode aprovar ou rejeitar cada usuário
5. Usuário aprovado ganha acesso imediato ao sistema

### Gerenciamento de Perfis
- Administradores podem alterar roles de outros usuários
- Administradores podem alterar status (aprovar/rejeitar)
- Administradores podem excluir usuários
- Usuários não podem alterar seus próprios perfis
- Todas as alterações são persistidas localmente usando `spark.kv`

## Componentes Principais

### `AuthContext.tsx`
Provider que gerencia:
- Estado do usuário atual
- Perfil do usuário (role e status)
- Funções de verificação de permissões (`hasRole`, `isAdmin`, `isGuest`)
- Funções de verificação de status (`isApproved`, `isPending`, `isRejected`)
- Atualização de roles e status
- Criação e exclusão de usuários
- Lista de todos os perfis

### `UserInfo.tsx`
Componente que exibe no header:
- Avatar do GitHub
- Nome de usuário
- Badge com o perfil atual

### `UserManagement.tsx`
Interface para administradores:
- Lista todos os usuários cadastrados
- Tabs separadas para: Pendentes, Aprovados, Rejeitados
- Permite aprovar/rejeitar usuários pendentes
- Permite alterar roles de usuários aprovados
- Permite excluir usuários (exceto próprio usuário)
- Botão para criar novos usuários manualmente
- Exibe informações do GitHub de cada usuário

### `PendingApproval.tsx`
Tela exibida para usuários com status `pending`:
- Mensagem informando que aguarda aprovação
- Informações de contato do administrador

### `Rejected.tsx`
Tela exibida para usuários com status `rejected`:
- Mensagem informando que acesso foi negado
- Instruções para contatar administrador

### `Restricted.tsx`
Componente wrapper para proteger conteúdo:
```tsx
<Restricted allowedRoles={['admin']}>
  <AdminOnlyContent />
</Restricted>
```

## Uso no Código

### Verificar Permissões e Status
```tsx
import { useAuth } from '@/lib/AuthContext'

function MyComponent() {
  const { isAdmin, isGuest, isApproved, isPending, isRejected, userProfile } = useAuth()
  
  if (!isApproved) {
    return <div>Aguardando aprovação</div>
  }
  
  if (isAdmin) {
    // Mostrar funcionalidades de admin
  }
  
  if (isGuest) {
    // Mostrar funcionalidades limitadas para hóspede
  }
}
```

### Gerenciar Usuários (Admin)
```tsx
import { useAuth } from '@/lib/AuthContext'

function AdminPanel() {
  const { updateUserStatus, updateUserRole, createUser, deleteUser, getAllProfiles } = useAuth()
  
  // Aprovar usuário
  updateUserStatus('username', 'approved')
  
  // Rejeitar usuário
  updateUserStatus('username', 'rejected')
  
  // Alterar role
  updateUserRole('username', 'admin')
  
  // Criar usuário
  createUser('username', 'user@github.com', 'guest')
  
  // Excluir usuário
  deleteUser('username')
  
  // Listar todos
  const allUsers = getAllProfiles()
}
```

### Restringir Acesso a Componentes
```tsx
import { Restricted } from '@/components/Restricted'

<Restricted allowedRoles={['admin']}>
  <SensitiveContent />
</Restricted>
```

## Estrutura de Dados

### UserProfile
```typescript
{
  githubLogin: string           // Login do GitHub
  role: 'admin' | 'guest'       // Perfil do usuário
  status: 'pending' | 'approved' | 'rejected'  // Status de aprovação
  email: string                 // Email do GitHub
  avatarUrl: string             // URL do avatar
  createdAt: string             // Data de criação
  updatedAt: string             // Última atualização
}
```

## Persistência
- Perfis são armazenados em `user-profiles` usando `spark.kv`
- Dados persistem entre sessões
- Sincronização automática entre componentes via context

## Fluxo de Aprovação

### Primeiro Acesso (Owner)
```
Acessa App → spark.user() → isOwner: true → Cria perfil
  ↓
role: 'admin', status: 'approved' → Acesso Total Liberado
```

### Primeiro Acesso (Não-Owner)
```
Acessa App → spark.user() → isOwner: false → Cria perfil
  ↓
role: 'guest', status: 'pending' → Tela "Aguardando Aprovação"
  ↓
Admin aprova → status: 'approved' → Acesso Liberado (Guest)
```

### Criação Manual por Admin
```
Admin cria usuário → Define role e email → status: 'approved'
  ↓
Usuário acessa → Perfil já existe e aprovado → Acesso Liberado
```

## Segurança
- Autenticação baseada na API oficial do Spark
- Validações no frontend para UX
- Role-based access control (RBAC)
- Status-based access control (aprovação necessária)
- Proteção contra auto-modificação de perfil
- Proteção contra auto-exclusão
- Owner sempre tem acesso admin aprovado
