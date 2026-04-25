# Contratos/Reservas

## O que é esta tela?

Gerencia os contratos e reservas de locação — o vínculo formal entre hóspede, imóvel e condições financeiras. Inclui locações mensais de longo prazo e reservas de temporada, incluindo importações automáticas de plataformas como Airbnb e Booking.com.

## Tipos de contrato/reserva

| Tipo | Uso |
|---|---|
| **Mensal** | Locação de longo prazo com cobrança recorrente mensal |
| **Temporada** | Locação de curta duração (diárias), com datas de entrada e saída definidas |

## Status

| Status | Significado |
|---|---|
| **Ativo** | Locação em andamento |
| **Encerrado** | Contrato vencido (data fim no passado) |
| **Cancelado** | Encerrado antes do prazo por acordo ou inadimplência |

## Campos do formulário

### Hóspede e propriedade
- **Hóspede** — selecione o inquilino cadastrado
- **Propriedades** — uma ou mais propriedades vinculadas
- **Tipo de locação** — Mensal ou Temporada

### Datas
- **Data de início** — primeiro dia do contrato/reserva
- **Data de fim** — último dia previsto

### Financeiro
- **Valor mensal** — aluguel base por mês
- **Dia de vencimento** — dia do mês em que o pagamento é esperado
- **Condições especiais de pagamento** — descontos, carência, multas ou outras cláusulas

### Observações
Notas internas sobre o contrato/reserva (não aparecem no PDF).

## Geração de PDF

Selecione um **template de contrato/reserva** e clique em **Gerar PDF**. O sistema substitui as variáveis do template com os dados automaticamente.

> Para criar modelos personalizados, acesse **Templates de Contrato/Reserva**.

## Sincronizar Plataformas (iCal)

O botão **Sincronizar Plataformas** busca reservas nos feeds iCal cadastrados nas propriedades (Airbnb, Booking.com, etc.) e cria contratos/reservas automaticamente:

1. Certifique-se de que os feeds iCal estão cadastrados nas propriedades
2. Clique em **Sincronizar Plataformas**
3. Visualize a prévia das reservas encontradas
4. Selecione as que deseja importar e confirme

Reservas já importadas não são duplicadas (controle por UID do evento iCal).

## Importação via CSV

Use **Importar CSV** para importar múltiplos contratos/reservas de uma vez. O sistema faz match automático por nome de hóspede e propriedade.

## Filtros disponíveis

- **Status** — Ativo, Encerrado ou Cancelado
- **Busca** — por nome do hóspede ou propriedade

## Dicas

> Um contrato pode vincular múltiplas propriedades — útil quando o hóspede aluga mais de um quarto simultaneamente.

> Contratos com data de fim nos próximos 30 dias aparecem em destaque no **Relatório** e na resposta do **Assistente IA**.

> O vínculo entre contrato/reserva e hóspede é obrigatório para gerar vistorias digitais de saída.

> Reservas sincronizadas do Airbnb/Booking são criadas sem valor mensal — edite após importar para adicionar o valor cobrado.
