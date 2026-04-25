# RPM - Rental Property Manager

## O que é o sistema?

O **RPM - Rental Property Manager** é uma plataforma SaaS multi-tenant para gestão de imóveis para locação. Centraliza em um só lugar o controle de propriedades, inquilinos, contratos/reservas, finanças, tarefas, documentos, vistorias e notificações automáticas.

## Módulos disponíveis

| Módulo | Descrição |
|---|---|
| **Propriedades** | Cadastro e configuração do portfólio de imóveis |
| **Contratos/Reservas** | Gestão de locações mensais e temporadas — inclui sync com plataformas (Airbnb, Booking) |
| **Hóspedes** | Cadastro de inquilinos, fiadores e dependentes |
| **Proprietários** | Cadastro dos donos dos imóveis |
| **Finanças** | Controle de receitas e despesas |
| **Tarefas** | Gestão de manutenções e atividades |
| **Agenda** | Agendamento de visitas e serviços |
| **Documentos** | Armazenamento de arquivos e contratos |
| **Prestadores** | Cadastro de fornecedores e prestadores de serviço |
| **Vistorias** | Checklist digital de entrada e saída |
| **Relatórios** | Análises financeiras e operacionais |
| **Calendário** | Visão consolidada de eventos e vencimentos |
| **Templates** | Modelos de contrato/reserva para geração de PDF |
| **Notificações** | Regras automáticas de alerta via e-mail, SMS e WhatsApp |
| **Assistente IA** | Chat inteligente para consultas dinâmicas sobre os dados |
| **Usuários** | Gestão de permissões e controle de acesso |
| **Auditoria** | Rastreamento de ações no sistema |

## Importação em lote via CSV

Todos os módulos de cadastro suportam importação via CSV. Use o botão **Importar CSV** em cada tela:

| Módulo | Template gerado |
|---|---|
| Propriedades | `template-propriedades.csv` |
| Hóspedes | `template-hospedes.csv` |
| Proprietários | `template-proprietarios.csv` |
| Contratos/Reservas | `template-contratos.csv` |
| Finanças (transações) | `template-transacoes.csv` |
| Prestadores | `template-prestadores.csv` |

## Integração com plataformas de reservas

As propriedades suportam links iCal de plataformas externas (Airbnb, Booking.com, VRBO):
- Cadastre os feeds na seção **Calendários iCal** de cada propriedade
- Use **Sincronizar Plataformas** na tela de Contratos/Reservas para importar reservas automaticamente
- Cada propriedade gera um link iCal público para exportar reservas cadastradas

## Notificações automáticas

Configure regras em **Notificações** para receber alertas via:
- **E-mail** — via Resend
- **WhatsApp** — via Twilio (requer telefone no perfil do usuário)
- **SMS** — via webhook configurável

## Fluxo de trabalho típico

1. **Cadastre as propriedades** — defina tipo, preço, capacidade e ambientes
2. **Cadastre proprietários e hóspedes** — dados pessoais e documentação
3. **Crie contratos/reservas** — vincule hóspede, propriedade, datas e valores
4. **Registre transações financeiras** — receitas e despesas vinculadas aos contratos
5. **Realize vistorias** — checklist na entrada e saída de cada locatário
6. **Acompanhe tarefas e agenda** — manutenções, visitas e compromissos
7. **Gere relatórios** — análise financeira e operacional do portfólio

## Perfis de acesso

- **Admin** — acesso completo ao tenant
- **Usuário comum** — acesso restrito conforme configuração do admin
- **Admin da plataforma** — visualiza e gerencia todos os tenants

## Dicas gerais

> Use os filtros de busca em cada tela para encontrar registros rapidamente.

> Todos os dados são salvos automaticamente na nuvem após cada operação.

> O Assistente IA consulta o banco dinamicamente — faça perguntas específicas para melhores resultados.
