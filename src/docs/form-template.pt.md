# Formulário de Template de Contrato

## Identificação

- **Nome** — título do template (ex: *Contrato Residencial Padrão*, *Temporada - Verão*)
- **Tipo** — define quais contratos podem usar este template:
  - *Mensal* — contratos de longa duração
  - *Temporada* — contratos de curta duração com datas definidas

## Editor de texto

Use o editor para escrever o contrato completo. Recursos disponíveis:
- Negrito, itálico, sublinhado
- Listas e enumerações
- Alinhamento de parágrafo
- Tamanho e estilo de fonte

## Inserindo variáveis

Clique em **Ajuda: Variáveis** para abrir o painel com os caminhos disponíveis. Os tokens precisam seguir o formato `{{xpath}}`.

### Como funciona

- Estrutura do caminho: `tabela{indice}.coluna{indice}.subcoluna`
- Exemplo: `{{owners{1}.documents{1}.number}}`
- Índices começam em `1`
- Use `{x}` para retornar todos os itens de uma lista

### Objetos disponíveis

- `contract`
- `guest`
- `properties`
- `owners`
- `template`
- `currentDate`

### Exemplos válidos

- `{{guest.name}}`
- `{{guest.email}}`
- `{{contract.startDate}}`
- `{{properties{1}.address}}`
- `{{owners{x}.name}}`
- `{{currentDate}}`

> Não invente nomes de variáveis. Use os caminhos exibidos na ajuda da própria tela.

## Pré-visualização

Selecione um contrato existente no campo **Contrato base para preview** para conferir como os tokens ficam preenchidos com dados reais antes de salvar o template.

> Sempre teste a pré-visualização antes de usar o template em contratos reais.
