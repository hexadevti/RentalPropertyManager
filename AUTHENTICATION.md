# RentFlow - Sistema de Autenticação

## Visão Geral

O RentFlow agora inclui um sistema completo de autenticação baseado no GitHub, com controle de acesso por perfis (roles).

## Perfis de Usuário

### 👑 Administrador
- Acesso completo a todas as funcionalidades
- Pode gerenciar perfis de outros usuários
- Automaticamente atribuído ao proprietário (owner) do Spark
- Pode adicionar/editar/excluir todos os recursos

### 👤 Hóspede
- Acesso limitado às funcionalidades
- Não pode gerenciar outros usuários
- Atribuído automaticamente a usuários não-owners
- Acesso de visualização e funcionalidades básicas

## Como Funciona

### Autenticação Automática
1. O usuário acessa o aplicativo
2. Sistema busca informações do usuário logado via `spark.user()`
3. Cria ou recupera perfil do usuário no banco de dados local
4. Atribui role baseado no status de owner (owner = admin, outros = guest)

### Gerenciamento de Perfis
- Administradores podem alterar roles de outros usuários na aba "Configurações"
- Usuários não podem alterar seus próprios perfis
- Todas as alterações são persistidas localmente usando `spark.kv`

## Componentes Principais

### `AuthContext.tsx`
Provider que gerencia:
- Estado do usuário atual
- Perfil do usuário (role)
- Funções de verificação de permissões (`hasRole`, `isAdmin`, `isGuest`)
- Atualização de roles

### `UserInfo.tsx`
Componente que exibe no header:
- Avatar do GitHub
- Nome de usuário
- Badge com o perfil atual

### `UserManagement.tsx`
Interface para administradores:
- Lista todos os usuários cadastrados
- Permite alterar roles
- Exibe informações do GitHub de cada usuário

### `Restricted.tsx`
Componente wrapper para proteger conteúdo:
```tsx
<Restricted allowedRoles={['admin']}>
  <AdminOnlyContent />
</Restricted>
```

## Uso no Código

### Verificar Permissões
```tsx
import { useAuth } from '@/lib/AuthContext'

function MyComponent() {
  const { isAdmin, userProfile } = useAuth()
  
  if (isAdmin) {
    // Mostrar funcionalidades de admin
  }
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
  githubLogin: string      // Login do GitHub
  role: 'admin' | 'guest'  // Perfil do usuário
  email: string            // Email do GitHub
  avatarUrl: string        // URL do avatar
  createdAt: string        // Data de criação
  updatedAt: string        // Última atualização
}
```

## Persistência
- Perfis são armazenados em `user-profiles` usando `spark.kv`
- Dados persistem entre sessões
- Sincronização automática entre abas

## Segurança
- Autenticação baseada na API oficial do Spark
- Validações no frontend para UX
- Role-based access control (RBAC)
- Proteção contra auto-modificação de perfil
