# Logs de Auditoria

## O que é esta tela?

Registra e exibe o histórico de todas as ações realizadas no sistema — criações, edições, exclusões, logins e logouts. Essencial para rastreabilidade, conformidade e investigação de incidentes.

## Tipos de ações registradas

| Ação | Quando ocorre |
|---|---|
| **Login** | Usuário entrou no sistema |
| **Logout** | Usuário saiu do sistema |
| **Criar** | Novo registro foi criado em qualquer módulo |
| **Atualizar** | Registro existente foi editado |
| **Excluir** | Registro foi removido do sistema |

## Informações por registro de log

- **Data e hora** — timestamp exato da ação (UTC)
- **Usuário** — login de quem executou a ação
- **Ação** — tipo de operação realizada
- **Entidade** — módulo afetado (ex: contrato, propriedade, transação)
- **ID do registro** — identificador do registro alterado

## Filtros disponíveis

- **Período** — Últimas 24h, 7 dias, 30 dias ou intervalo personalizado
- **Ação** — filtrar por tipo (login, criar, atualizar, excluir)
- **Entidade** — filtrar por módulo do sistema
- **Usuário** — filtrar ações de um usuário específico
- **ID do registro** — rastrear o histórico completo de um registro específico

## Casos de uso

- **Investigar exclusão indevida** — filtre por "Excluir" e o módulo afetado
- **Auditar alterações em contrato** — filtre pelo ID do contrato
- **Verificar acessos suspeitos** — filtre por "Login" e ordene por data
- **Conformidade** — exporte o histórico de ações para relatório de auditoria

## Dicas

> Os logs são imutáveis — não podem ser editados ou excluídos por nenhum usuário, incluindo administradores.

> Use o filtro de **ID do registro** para ver o histórico completo de um contrato ou propriedade específica.

> Os logs dos últimos 30 dias são carregados por padrão. Para períodos anteriores, use o filtro de data personalizado.
