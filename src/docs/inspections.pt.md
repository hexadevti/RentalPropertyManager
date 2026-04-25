# Vistorias Digitais

## O que é esta tela?

Gerencia o processo de vistoria dos imóveis com um checklist digital por ambiente. Registra o estado de cada item na entrada e saída do inquilino, permitindo comparar as condições e identificar danos.

## Fluxo de status da vistoria

```
Rascunho → Em andamento → Avaliada
```

| Status | O que é possível |
|---|---|
| **Rascunho** | Editar estrutura: nomes dos itens, ambientes e seções |
| **Em andamento** | Avaliar condições de cada item; estrutura bloqueada |
| **Avaliada** | Vistoria concluída; geração de PDF liberada |

## Tipos de vistoria

| Tipo | Quando usar |
|---|---|
| **Entrada** | No início do contrato, ao entregar o imóvel ao inquilino |
| **Saída** | No encerramento do contrato, ao receber o imóvel de volta |
| **Manutenção** | Durante a locação, após serviço de reparo ou reforma |
| **Periódica** | Revisão de rotina durante a locação |

> **Regra:** Para criar vistoria de Saída, Manutenção ou Periódica, é necessário que a vistoria de Entrada do mesmo contrato esteja "Em andamento" ou "Avaliada".

## Condições dos itens

| Condição | Significado |
|---|---|
| **Excelente** | Perfeito estado, sem nenhum desgaste |
| **Bom** | Estado adequado, desgaste natural mínimo |
| **Atenção** | Requer monitoramento ou ajuste breve |
| **Danificado** | Requer reparo ou substituição |
| **N/A** | Item não aplicável ou não verificado |

## Estrutura do checklist

- **Ambientes** (casas/apartamentos) — Sala, Quarto 1, Banheiro etc.
- **Seções** (quartos) — Mobiliário, Itens de vistoria

Os ambientes e itens são definidos no cadastro da **Propriedade**.

## Modo Rascunho (estrutura)

No rascunho você pode:
- Renomear ambientes e itens
- Adicionar ou remover ambientes e itens
- Não é possível avaliar condições

## Modo Em andamento (avaliação)

Ao iniciar a vistoria:
- Estrutura fica bloqueada (itens não podem ser adicionados/removidos)
- Selecione a condição de cada item
- Adicione observações por item e por ambiente

## Voltar para Rascunho

Você pode retornar ao rascunho a partir do status "Em andamento". **Atenção:** todas as condições e observações serão apagadas.

## Vistorias vinculadas

Vistorias de Saída, Manutenção e Periódica são automaticamente vinculadas à vistoria de Entrada do mesmo contrato. O sistema exibe as **diferenças** entre cada vistoria e a anterior:

- Itens que pioraram de condição são destacados
- O botão **Criar task** gera automaticamente uma tarefa de manutenção para itens danificados

## Geração de PDF

Disponível apenas quando a vistoria está no status **Avaliada**. O PDF inclui:
- Dados do imóvel, contrato e vistoriador
- Checklist completo com condições e observações
- Data e assinatura

## Dicas

> Realize a vistoria de entrada antes de entregar as chaves — ela serve como prova do estado inicial do imóvel.

> Use observações detalhadas em itens com condição "Danificado" para embasar descontos na devolução da caução.

> Vistorias periódicas permitem monitorar o estado do imóvel durante a locação sem necessidade de encerramento do contrato.
