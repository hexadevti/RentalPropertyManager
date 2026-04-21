# Templates de Contrato

## O que é esta tela?

Cria e gerencia modelos reutilizáveis de contrato para geração automática de PDFs. Cada template usa variáveis dinâmicas que são substituídas pelos dados reais do contrato, hóspede e propriedade no momento da geração.

## Tipos de template

| Tipo | Uso |
|---|---|
| **Mensal** | Contratos de locação residencial de longo prazo |
| **Temporada** | Contratos de hospedagem de curta duração |

## Editor de texto

O template é editado em um **editor de texto rico** com suporte a:

- Negrito, itálico, sublinhado
- Listas numeradas e com marcadores
- Alinhamento de texto
- Tamanho de fonte

## Variáveis dinâmicas

Insira variáveis no texto usando a sintaxe `{nome_da_variavel}`. Elas serão substituídas automaticamente na geração do PDF.

### Variáveis disponíveis

| Variável | Conteúdo |
|---|---|
| `{nome_inquilino}` | Nome completo do hóspede |
| `{cpf_inquilino}` | CPF do hóspede |
| `{endereco_imovel}` | Endereço da propriedade |
| `{valor_aluguel}` | Valor mensal do contrato |
| `{data_inicio}` | Data de início do contrato |
| `{data_fim}` | Data de fim do contrato |
| `{dia_vencimento}` | Dia de vencimento do pagamento |
| `{nome_proprietario}` | Nome do proprietário do imóvel |
| `{fiadores}` | Nomes dos fiadores do hóspede |
| `{data_hoje}` | Data atual da geração do PDF |

> Use o **Construtor de variáveis** no painel lateral para inserir variáveis sem precisar digitar a sintaxe.

## Pré-visualização

Selecione um contrato existente no campo **Prévia com contrato** para ver como o template ficará preenchido com dados reais antes de usá-lo.

## Duplicar template

Use o botão **Duplicar** para criar uma cópia de um template existente como ponto de partida para uma nova versão.

## Dicas

> Crie templates separados para locação mensal e temporada, pois os campos e cláusulas são diferentes.

> Teste sempre a pré-visualização antes de usar o template em um contrato real.

> Para contratos com múltiplos proprietários, use `{nome_proprietario}` — o sistema inclui todos os vinculados ao imóvel.
