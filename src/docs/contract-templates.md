# Templates de Contrato

## O que é esta tela?

Cria e gerencia modelos reutilizáveis de contrato para geração automática de PDFs. Cada template usa tokens no formato `{{xpath}}`, que são resolvidos com os dados reais do contrato selecionado no momento da geração.

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

## Variáveis do template

Os templates não usam variáveis fixas como `{nome_inquilino}`. Use sempre tokens no formato `{{xpath}}`.

### Estrutura do XPath

- Formato: `tabela{indice}.coluna{indice}.subcoluna`
- Exemplo: `{{owners{1}.documents{1}.number}}`
- O índice começa em `1`
- Para listas, use `{x}` quando quiser trazer todos os itens

### Objetos raiz disponíveis

- `contract`
- `guest`
- `properties`
- `owners`
- `template`
- `currentDate`

### Exemplos válidos

- `{{guest.name}}`
- `{{guest.documents{1}.number}}`
- `{{contract.startDate}}`
- `{{contract.monthlyAmount}}`
- `{{properties{1}.name}}`
- `{{owners{1}.name}}`
- `{{owners{x}.name}}`
- `{{currentDate}}`

> Use o botão **Ajuda: Variáveis** para consultar os caminhos disponíveis e inserir o token pronto no editor.

## Pré-visualização

Selecione um contrato existente no campo **Contrato base para preview** para ver como o template ficará preenchido com dados reais antes de usá-lo.

## Duplicar template

Use o botão **Duplicar** para criar uma cópia de um template existente como ponto de partida para uma nova versão.

## Dicas

> Crie templates separados para locação mensal e temporada, pois os campos e cláusulas são diferentes.

> Teste sempre a pré-visualização antes de usar o template em um contrato real.

> A lista exibida em **Ajuda: Variáveis** é a fonte de verdade para saber quais caminhos existem no contrato selecionado.
