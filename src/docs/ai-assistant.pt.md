# Assistente IA

## O que é esta tela?

Chat inteligente alimentado pelo **Claude** (Anthropic) que responde perguntas sobre os dados do seu portfólio em linguagem natural. O assistente consulta o banco de dados dinamicamente para fornecer respostas precisas e atualizadas.

## Como usar

1. Digite sua pergunta na caixa de texto
2. Pressione **Enter** para enviar — ou **Ctrl+Enter** para quebrar linha
3. O assistente consulta os dados necessários e responde em alguns segundos

## O que o assistente pode responder

- Saldo financeiro do mês atual e por categoria
- Propriedades disponíveis e ocupadas
- Contratos/reservas ativos, vencendo ou encerrados recentemente
- Tarefas pendentes por propriedade ou prioridade
- Agendamentos próximos
- Prestadores de serviço por especialidade
- Documentos cadastrados por tipo
- Vistorias realizadas e pendências

## Como o assistente funciona

O assistente usa **tool use** — ele decide quais tabelas consultar para cada pergunta, executa as queries e cruza os resultados. Não há limite de registros pré-carregados: ele busca apenas o que é necessário para responder.

## Modelos disponíveis

| Modelo | Indicado para |
|---|---|
| **Claude Sonnet 4.6** | Uso geral — melhor equilíbrio custo/qualidade *(padrão)* |
| **Claude Haiku 4.5** | Perguntas simples e rápidas — mais econômico |
| **Claude Opus 4.7** | Análises complexas — máxima capacidade |

## Painel de consultas realizadas

O painel lateral exibe quantas iterações de consulta foram necessárias na última pergunta. Perguntas que exigem cruzar múltiplas tabelas resultam em mais iterações.

## Perguntas rápidas

Use os botões de **Perguntas rápidas** no painel lateral para consultas comuns com um clique.

## Persistência da conversa

O histórico é mantido enquanto você navega pelo sistema. Use o botão **Limpar conversa** para reiniciar.

## Boas práticas

> Seja específico: "Qual o saldo de março de 2026?" funciona melhor que "Como estão as finanças?".

> O assistente responde com base nos dados cadastrados — registros não criados no sistema não aparecerão.

> Para ações que alteram dados (criar contrato, registrar pagamento), use os módulos correspondentes — o assistente é consultivo apenas.

## Disponibilidade e segurança

- Disponível apenas para **administradores aprovados**
- Todas as consultas são filtradas pelo tenant do usuário — sem acesso a dados de outros tenants
- O uso é registrado com tokens consumidos para controle de custo
