# Guia de Teste - API Green365

## Status da Migração ✅

Todas as APIs antigas foram removidas e substituídas pelas APIs do Green365:

- ✅ Histórico de Jogos
- ✅ Análise de Jogador Individual  
- ✅ Confrontos Diretos (H2H)

## Estruturas das APIs

### 1. API de Confrontos Diretos (H2H)
**URL:** `https://api-v2.green365.com.br/api/v2/analysis/sport/dynamic`

**Parâmetros:**
- `type=h2h`
- `sport=esoccer`
- `status=manual`
- `competitionID={id da liga}`
- `home={nome jogador 1}`
- `away={nome jogador 2}`
- `homeID={id jogador 1}`
- `awayID={id jogador 2}`
- `period=50g`

**Estrutura da Resposta:**
```json
{
  "type": "h2h",
  "sport": "esoccer",
  "sessions": {
    "sessionEvents": {
      "category": "events",
      "home": "jogador1",
      "away": "jogador2",
      "headToHeadEvents": [
        {
          "id": 2914398,
          "eventID": 11057908,
          "sport": "esoccer",
          "score": { "home": 1, "away": 3 },
          "scoreHT": { "home": 1, "away": 0 },
          "home": {
            "id": 1091163,
            "name": "a1ose",
            "teamName": "Czechia"
          },
          "away": {
            "id": 1220651,
            "name": "space",
            "teamName": "Hungary"
          },
          "competition": {
            "id": 22614,
            "name": "Esoccer Battle - 8 mins play"
          },
          "startTime": "2025-11-29T01:16:00.000Z",
          "status": "ended",
          "winner": "away"
        }
      ],
      "homeEvents": [...],  // Jogos recentes do jogador 1
      "awayEvents": [...]   // Jogos recentes do jogador 2
    }
  }
}
```

**Como o código processa:**
- `scoreHT` → analise de primeiro tempo (HT)
- `score` → analise de jogo completo
- `headToHeadEvents` → confrontos diretos entre os jogadores
- `homeEvents` → histórico do jogador mandante
- `awayEvents` → histórico do jogador visitante

### 2. API de Histórico do Jogador
**URL:** `https://api-v2.green365.com.br/api/v2/analysis/participant/dynamic`

**Parâmetros:**
- `sport=esoccer`
- `participantID={id do jogador}`
- `participantName={nome do jogador}`
- `period=20g` (últimos 20 jogos)

**Estrutura da Resposta:**
```json
{
  "sport": "esoccer",
  "sessions": {
    "sessionEvents": {
      "category": "events",
      "participantName": "bodyaoo",
      "events": [
        {
          "id": 2914463,
          "eventID": 11058034,
          "sport": "esoccer",
          "score": { "home": 2, "away": 1 },
          "scoreHT": { "home": 1, "away": 1 },
          "home": {
            "id": 1165836,
            "name": "bodyaoo",
            "teamName": "Juventus"
          },
          "away": {
            "id": 1097191,
            "name": "maksdh",
            "teamName": "Man City"
          },
          "competition": {
            "id": 22614,
            "name": "Esoccer Battle - 8 mins play"
          },
          "startTime": "2025-11-29T02:28:00.000Z",
          "status": "ended",
          "winner": "home"
        }
      ]
    }
  }
}
```

**Como o código processa:**
- Extrai `sessions.sessionEvents.events`
- Normaliza cada evento com `normalizeHistoryMatch()`
- Captura IDs de jogadores e ligas para uso posterior

## Fluxo de Captura de IDs

O sistema usa Maps para armazenar IDs:

```typescript
const playerIdMap = new Map<string, number>();  // nome → ID
const leagueIdMap = new Map<string, number>();   // nome → ID
```

**Quando são capturados:**
1. Ao carregar histórico de jogos (`fetchHistoryGames`)
2. Ao buscar histórico de jogador (`fetchPlayerHistory`)
3. Na função `normalizeHistoryMatch()`:
   ```typescript
   if (match.home?.id && match.home?.name) 
       playerIdMap.set(match.home.name, match.home.id);
   if (match.away?.id && match.away?.name) 
       playerIdMap.set(match.away.name, match.away.id);
   if (match.competition?.id && match.competition?.name) 
       leagueIdMap.set(match.competition.name, match.competition.id);
   ```

**Quando são usados:**
- Na função `fetchH2H()` para montar a URL da API H2H
- Na função `fetchPlayerHistory()` quando o ID não é fornecido

## Logs de Debug Implementados

### Console do Navegador (F12 → Console)

**Para H2H:**
```
H2H API Response Structure: ["type", "sport", "sessions", "status"]
H2H Events found: 6, Home: 20, Away: 20
```

**Para Histórico do Jogador:**
```
Player History API Response Structure: ["sport", "sessions", "info"]
Player bodyaoo history events found: 10
```

**Erros possíveis:**
```
Missing IDs for H2H: maksdh(1097191) vs nightxx(undefined) in Esoccer Battle - 8 mins play(22614)
sessionEvents not found. Available keys: type,sport,sessions,status
Green365 H2H Error: TypeError: ...
```

## Como Testar

### Passo 1: Iniciar aplicação
```bash
npm run dev
```

### Passo 2: Abrir DevTools
- Pressione F12
- Vá para aba "Console"

### Passo 3: Navegar para H2H
1. Selecione uma **Liga** (ex: "Esoccer Battle - 8 mins play")
2. Selecione **Jogador 1** (ex: "maksdh")
3. Selecione **Jogador 2** (ex: "nightxx")
4. Clique em **"Comparar"**

### Passo 4: Verificar Console
- Deve aparecer: "H2H API Response Structure: ..."
- Deve aparecer: "H2H Events found: X, Home: Y, Away: Z"
- Se X > 0, os confrontos diretos foram encontrados
- Se Y > 0 e Z > 0, os históricos individuais foram encontrados

### Passo 5: Verificar Aba Network (DevTools)
1. Vá para aba "Network" (Rede)
2. Filtre por "api-v2.green365"
3. Deve ver requisições para:
   - `/api/v2/sport-events` (histórico geral)
   - `/api/v2/analysis/participant/dynamic` (histórico do jogador)
   - `/api/v2/analysis/sport/dynamic` (confrontos diretos)
4. Clique em cada requisição e veja a resposta em "Response"

## Diagnóstico de Problemas

### ❌ "Missing IDs for H2H"
**Causa:** IDs não foram capturados
**Solução:**
1. Recarregue a página (Ctrl+F5)
2. Aguarde carregar o histórico de jogos na página Overview
3. Tente novamente o H2H

### ❌ "sessionEvents not found"
**Causa:** Estrutura da API mudou
**Solução:**
1. Copie o conteúdo de "Available keys:" do console
2. Verifique na aba Network a estrutura real da resposta
3. Me informe a estrutura correta

### ❌ Métricas não aparecem mas API retorna 200
**Causa:** Normalização dos dados está falhando
**Solução:**
1. Verifique se "H2H Events found" mostra números > 0
2. Se mostrar 0, verifique a estrutura dos eventos em Network → Response
3. Me informe a estrutura dos eventos

### ✅ Tudo funciona
Parabéns! As métricas devem aparecer:
- Estatísticas de confrontos diretos
- Win rate de cada jogador
- Histórico de jogos
- Gráficos de performance
- Projeções de resultados

## Checklist Final

- [ ] APIs antigas removidas (não deve haver referências a `caveira.tips`)
- [ ] API Green365 H2H funcionando
- [ ] API Green365 histórico de jogador funcionando
- [ ] IDs sendo capturados corretamente
- [ ] Métricas aparecendo na interface
- [ ] Logs de debug visíveis no console
- [ ] Sem erros no console do navegador

## Próximos Passos

Se encontrar qualquer problema, me informe:
1. Os logs completos do console (copie e cole)
2. A resposta da API na aba Network (copie o JSON)
3. Screenshots se necessário

Assim posso ajustar o código para a estrutura exata da API.
