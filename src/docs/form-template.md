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

Clique no botão **{ }** ou use o painel lateral para inserir variáveis que serão substituídas pelos dados reais na geração do PDF:

| Variável | Substituído por |
|---|---|
| `{nome_inquilino}` | Nome completo do hóspede |
| `{cpf_inquilino}` | CPF do hóspede |
| `{endereco_imovel}` | Endereço da propriedade |
| `{valor_aluguel}` | Valor mensal do contrato |
| `{data_inicio}` | Data de início |
| `{data_fim}` | Data de fim |
| `{dia_vencimento}` | Dia de vencimento do pagamento |
| `{nome_proprietario}` | Nome do(s) proprietário(s) |
| `{fiadores}` | Nomes dos fiadores |
| `{data_hoje}` | Data de geração do PDF |

## Pré-visualização

Selecione um contrato existente no campo **Prévia com contrato** para conferir como as variáveis ficam preenchidas com dados reais antes de salvar o template.

> Sempre teste a pré-visualização antes de usar o template em contratos reais.
