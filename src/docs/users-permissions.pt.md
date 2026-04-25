# Usuários e Permissões

## O que é esta tela?

Painel administrativo para gestão de usuários, controle de acesso por perfil, envio de convites e monitoramento de atividade do sistema.

## Perfis de acesso

O acesso de cada usuário é controlado por **perfis de acesso** configuráveis. Cada perfil define, módulo a módulo, o nível de permissão:

| Nível | O que o usuário pode fazer |
|---|---|
| **Nenhum** | Módulo não aparece no menu |
| **Leitura** | Pode visualizar, sem poder criar/editar/excluir |
| **Escrita** | Acesso completo ao módulo |

Usuários com papel **Admin** têm acesso completo por padrão.

## Status do usuário

| Status | Significado |
|---|---|
| **Aprovado** | Acesso liberado ao sistema |
| **Pendente** | Cadastro aguardando aprovação |
| **Bloqueado** | Acesso suspenso pelo admin |

## Editando um usuário

Clique em **Editar** no card do usuário para alterar:
- **Login** — nome de identificação
- **E-mail** — endereço de e-mail
- **Telefone (WhatsApp)** — número em formato internacional (ex: `+5511999990000`). Obrigatório para receber notificações via WhatsApp.
- **Avatar** — URL da foto de perfil
- **Perfil de acesso** — define as permissões por módulo
- **Status** — Aprovado, Pendente ou Bloqueado

> O telefone deve estar no formato E.164: `+` seguido do código do país e número, sem espaços ou traços.

## Convidando usuários

Use o botão **Convidar** para enviar um convite por e-mail. O usuário recebe um link para criar sua conta diretamente no tenant, sem precisar solicitar acesso manualmente.

## Monitoramento de sessões ativas

O painel **Usuários online** exibe em tempo real:
- Usuários com sessão ativa
- Tela atual, IP, navegador e última atividade

## Uso do Assistente IA

O painel mostra por usuário: número de consultas, tokens consumidos e custo estimado em USD.

## Gestão do tenant

O admin pode editar o nome do tenant nesta tela.

## Configuração de WhatsApp (Twilio)

Para que as notificações via WhatsApp funcionem:
1. O tenant deve ter as secrets `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e `TWILIO_WHATSAPP_FROM` configuradas no Supabase
2. Cada usuário destinatário deve ter o **telefone** cadastrado no perfil (formato internacional)
3. Configure uma regra de notificação com o canal **WhatsApp** na tela de Notificações

## Dicas

> Revise regularmente os usuários pendentes — novos cadastros ficam em espera até aprovação manual.

> Cadastre o telefone de todos os usuários que devem receber alertas via WhatsApp.

> Use perfis de acesso para dar acesso parcial a colaboradores (ex: só leitura de finanças e contratos).
