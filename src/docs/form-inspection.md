# Formulário de Vistoria

## Passo 1 — Configuração

### Propriedade e contrato

- **Propriedade** — imóvel que será vistoriado
- **Contrato** — contrato de locação vinculado (obrigatório para gerar vistorias de saída/manutenção)

> Ao selecionar o contrato, o sistema verifica automaticamente quais tipos de vistoria são permitidos.

### Tipo de vistoria

| Tipo | Quando criar |
|---|---|
| **Entrada** | Antes de entregar o imóvel ao inquilino |
| **Saída** | Ao receber o imóvel de volta no encerramento |
| **Manutenção** | Após serviço de reparo ou reforma |
| **Periódica** | Revisão de rotina durante a locação |

> Saída, Manutenção e Periódica só podem ser criadas quando a vistoria de Entrada do contrato estiver "Em andamento" ou "Avaliada".

### Outros campos

- **Responsável** — nome do vistoriador
- **Data da vistoria** — data agendada ou realizada
- **Título** *(opcional)* — se deixar em branco, o título é gerado automaticamente
- **Resumo** *(opcional)* — observações gerais sobre o estado do imóvel

## Passo 2 — Checklist

O checklist é gerado automaticamente com base nos ambientes e itens cadastrados na Propriedade.

### Modo Rascunho
- Renomeie ambientes e itens conforme necessário
- Adicione ou remova itens
- Condições não podem ser avaliadas ainda

### Modo Em andamento
Iniciada a vistoria, a estrutura é bloqueada e você avalia cada item:

| Condição | Significado |
|---|---|
| **Excelente** | Perfeito estado |
| **Bom** | Desgaste natural mínimo |
| **Atenção** | Requer monitoramento |
| **Danificado** | Requer reparo ou troca |
| **N/A** | Não aplicável / não verificado |

Adicione observações específicas em cada item e ao final de cada ambiente.
