# RentFlow - Armazenamento KV

## KVs Ativos no Sistema

### Autenticação e Configurações
- **`user-profiles`** - Perfis de usuários com roles e status de aprovação
- **`app-language`** - Preferência de idioma do usuário (pt/en)
- **`app-currency`** - Preferência de moeda do usuário (BRL/USD/EUR/GBP)

### Dados do Sistema
- **`properties`** - Propriedades cadastradas (imóveis)
- **`transactions`** - Transações financeiras (receitas e despesas)
- **`contracts`** - Contratos de aluguel
- **`guests`** - Hóspedes cadastrados
- **`service-providers`** - Prestadores de serviço
- **`tasks`** - Tarefas e lembretes
- **`appointments`** - Agendamentos

## KVs Removidos

### ❌ `bookings`
- **Motivo:** Substituído pelo sistema de contratos (`contracts`)
- **Data de remoção:** Atual
- **Migração:** Não necessária, era uma tabela não utilizada do rollback anterior

## Como Limpar KVs Não Utilizados

Se você precisar limpar manualmente o KV `bookings` do navegador:

```javascript
// Execute no console do navegador
await spark.kv.delete('bookings')
console.log('KV bookings removido com sucesso')
```

## Estrutura dos Dados

### user-profiles
```typescript
{
  githubLogin: string
  role: 'admin' | 'guest'
  status: 'pending' | 'approved' | 'rejected'
  email: string
  avatarUrl: string
  createdAt: string
  updatedAt: string
}[]
```

### properties
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
}[]
```

### contracts
```typescript
{
  id: string
  guestId: string
  propertyIds: string[]
  rentalType: 'short-term' | 'monthly'
  startDate: string
  endDate: string
  paymentDueDay: number
  monthlyAmount: number
  status: 'active' | 'expired' | 'cancelled'
  notes?: string
  createdAt: string
}[]
```

### guests
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
}[]
```

### transactions
```typescript
{
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  description: string
  date: string
  propertyId?: string
  contractId?: string
  serviceProviderId?: string
  createdAt: string
}[]
```

### service-providers
```typescript
{
  id: string
  name: string
  service: string
  contact: string
  email?: string
  createdAt: string
}[]
```

### tasks
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
}[]
```

### appointments
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
  completionNotes?: string
  completedAt?: string
  createdAt: string
}[]
```

## Boas Práticas

1. **Sempre use functional updates com useKV**
   ```typescript
   // ❌ ERRADO - pode causar perda de dados
   setData([...data, newItem])
   
   // ✅ CORRETO - sempre use functional update
   setData((currentData) => [...currentData, newItem])
   ```

2. **Inicialize arrays vazios como default**
   ```typescript
   const [items, setItems] = useKV<Item[]>('items', [])
   ```

3. **Sempre valide arrays antes de usar**
   ```typescript
   const validItems = items || []
   ```

4. **Use tipos TypeScript para todos os KVs**
   ```typescript
   const [profiles, setProfiles] = useKV<UserProfile[]>('user-profiles', [])
   ```
