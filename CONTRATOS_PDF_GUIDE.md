# Sistema de Geração de Contratos em PDF

Este sistema permite gerenciar templates de contratos e gerar PDFs personalizados com os dados dos contratos cadastrados.

## Funcionalidades

### 1. Gerenciamento de Templates
- Crie e edite templates de contratos personalizados
- Dois tipos de templates: Locação Mensal e Curta Temporada
- Duplique templates existentes para criar variações
- Templates padrão disponíveis para inicialização rápida

### 2. Geração de PDFs
- Gere PDFs automaticamente a partir de contratos existentes
- Escolha o template apropriado para cada tipo de contrato
- Visualize o PDF antes de baixar
- PDFs são gerados com formatação profissional

## Como Usar

### Passo 1: Criar Templates
1. Vá para a aba **Templates** (apenas Admin)
2. Clique em **Novo Template**
3. Dê um nome ao template
4. Selecione o tipo (Mensal ou Curta Temporada)
5. Clique em **Carregar Template Padrão** para começar com um modelo pronto
6. Personalize o conteúdo conforme necessário
7. Salve o template

**Ou use o atalho:**
1. Vá para **Configurações**
2. Na seção "Templates de Contratos"
3. Clique em **Criar Templates Padrão** para adicionar 2 templates prontos

### Passo 2: Criar um Contrato
1. Vá para a aba **Contratos**
2. Clique em **Adicionar Contrato**
3. Preencha os dados do contrato:
   - Selecione o hóspede
   - Selecione os imóveis
   - Escolha o tipo de locação (Mensal ou Curta Temporada)
   - Defina as datas e valores
4. Salve o contrato

### Passo 3: Gerar PDF
1. Na lista de contratos, clique no ícone de PDF
2. Selecione o template que deseja usar
3. Escolha entre:
   - **Visualizar**: Abre o PDF em uma nova aba para revisão
   - **Baixar PDF**: Faz o download do arquivo

## Variáveis Disponíveis

Os templates não usam uma lista fixa de variáveis como `{{guestName}}`. O sistema aceita tokens no formato `{{xpath}}`, seguindo a mesma lógica do botão **"Variáveis disponíveis no template"** no formulário.

### Formato do token

- Use sempre `{{seu_xpath}}`
- O caminho segue a estrutura `tabela{indice}.coluna{indice}.subcoluna`
- Exemplo: `{{owners{1}.documents{1}.number}}`

### Fontes de dados disponíveis

Os caminhos partem dos objetos carregados para o contrato selecionado:

- `contract`
- `guest`
- `properties`
- `owners`
- `template`
- `currentDate`

### Como escrever o caminho

1. Comece pelo objeto raiz, como `contract` ou `guest`
2. Acesse propriedades com `.`
3. Para listas, use índice entre chaves, começando em `1`
4. Para trazer todos os itens de uma lista, use `{x}`

### Exemplos válidos

- `{{guest.name}}`
- `{{guest.email}}`
- `{{guest.documents{1}.number}}`
- `{{contract.startDate}}`
- `{{contract.endDate}}`
- `{{contract.monthlyAmount}}`
- `{{properties{1}.name}}`
- `{{properties{1}.address}}`
- `{{owners{1}.name}}`
- `{{owners{x}.name}}`
- `{{owners{x}.documents{1}.number}}`
- `{{currentDate}}`

### Regras importantes

- Os índices são baseados em `1`, não em `0`
- Se usar `{x}` em uma lista, o sistema retorna todos os valores encontrados em linhas separadas
- Datas e valores numéricos podem ser formatados automaticamente na geração do PDF
- Se o caminho não existir, o PDF mostra uma mensagem de erro de XPath ou índice inexistente

### Recomendação de uso

Para descobrir os caminhos corretos, use o botão **"Variáveis disponíveis no template"** dentro do editor:

1. Selecione um contrato de referência
2. Consulte a lista de caminhos e valores exibidos
3. Clique em um caminho para testar
4. Insira o token pronto no template

Essa é a fonte de verdade para saber quais caminhos estão disponíveis em cada contrato.

## Dicas

1. **Formatação**: O gerador de PDF reconhece:
   - Linhas que começam com "CONTRATO" ou "CLÁUSULA" são formatadas em negrito e tamanho maior
   - Campos como "LOCADOR", "LOCATÁRIO", "IMÓVEL" aparecem em negrito
   - Linhas vazias criam espaçamento

2. **Personalização**: Você pode editar os templates a qualquer momento. As mudanças afetarão apenas os PDFs gerados após a edição.

3. **Backup**: Como os templates são salvos no sistema de persistência, eles são mantidos entre sessões.

4. **Múltiplos Templates**: Você pode criar vários templates do mesmo tipo para diferentes situações (ex: "Contrato Mensal Padrão", "Contrato Mensal com Garantia", etc.)
