# Checklist de aceite manual — Arte de pet (aqua)

Exige a GUI real do Tauri (animação, hover). O E2E só cobre montagem do canvas.

## Pré-requisitos
- `cargo` no PATH; `pnpm install` feito.
- Atlas gerado: `pnpm assets:pets` (cria `public/pets/aqua.{png,json}`).

## Como rodar
```powershell
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
pnpm tauri dev
```

## Critérios
- [ ] O pet exibido é o **aqua** (azul), **animado** em idle (não um quadro estático).
- [ ] Ao clicar **dormir** (💤), o pet troca para a animação **sleep**; ao **acordar** (☀️), volta para idle.
- [ ] Ao clicar **alimentar** (🍖) com fome ≥ 10, toca a animação de **comer** uma vez e
      depois **reverte** ao estado atual (idle ou sleep), sem ser cortada por ticks.
- [ ] Sem regressão da Fatia 2: barra aparece no hover, alimentar desabilita ao saciar,
      modo persiste ao reabrir.

## Resultado
- [ ] Todos os critérios OK → fatia de arte (aqua) aceita.
