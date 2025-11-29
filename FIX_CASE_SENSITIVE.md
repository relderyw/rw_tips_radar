# Fix: Case-Sensitive Player Name Matching

## Problema Identificado

**Sintoma:** Jogos ao vivo ficam carregando infinitamente quando o nome do jogador tem letras maiúsculas/minúsculas diferentes entre as APIs.

**Exemplo:**
- API Jogos ao Vivo: `"Baba"` (com B maiúsculo)
- API Jogos Finalizados: `"baba"` (tudo minúsculo)
- Resultado: Nome não é encontrado → carregamento infinito

**Causa Raiz:** 
- Os Maps de cache (`playerIdMap`, `leagueIdMap`) armazenavam os nomes exatamente como vinham da API
- A busca era case-sensitive: `playerIdMap.get("Baba")` ≠ `playerIdMap.get("baba")`

## Solução Implementada

### 1. Normalização no Armazenamento
Todos os nomes de jogadores são agora armazenados em **lowercase** no Map:

```typescript
// Antes:
playerIdMap.set(match.home.name, match.home.id);  // "Baba" → ID

// Depois:
playerIdMap.set(match.home.name.toLowerCase(), match.home.id);  // "baba" → ID
```

### 2. Normalização na Busca
Todas as buscas no Map agora usam **lowercase**:

```typescript
// Antes:
const playerId = playerIdMap.get(player);  // "Baba" não encontra "baba"

// Depois:
const playerId = playerIdMap.get(player.toLowerCase());  // "Baba" → "baba" ✓
```

### 3. Busca Fallback Case-Insensitive
Quando busca nos jogos recentes, comparação ignora maiúsculas:

```typescript
const playerMatches = recentGames.filter(m => 
    m.home_player.toLowerCase() === player.toLowerCase() || 
    m.away_player.toLowerCase() === player.toLowerCase()
);
```

### 4. Cache Key Case-Insensitive
A chave de cache também usa lowercase:

```typescript
// Antes:
const cacheKey = `${player}-${playerId || 'noid'}-${limit}`;  // "Baba-123-10"

// Depois:
const cacheKey = `${player.toLowerCase()}-${playerId || 'noid'}-${limit}`;  // "baba-123-10"
```

## Alterações nos Arquivos

### `services/api.ts`

#### 1. `normalizeHistoryMatch()` - Linhas ~11-45
```typescript
// Store names in lowercase for case-insensitive lookup
if (match.home?.id && match.home?.name) {
    playerIdMap.set(match.home.name.toLowerCase(), match.home.id);
}
if (match.away?.id && match.away?.name) {
    playerIdMap.set(match.away.name.toLowerCase(), match.away.id);
}
```

#### 2. `getPlayerIdFromCache()` - Linha ~52
```typescript
export const getPlayerIdFromCache = (playerName: string): number | undefined => {
    return playerIdMap.get(playerName.toLowerCase());
};
```

#### 3. `fetchH2H()` - Linha ~111-113
```typescript
const p1Id = playerIdMap.get(player1.toLowerCase());
const p2Id = playerIdMap.get(player2.toLowerCase());
```

#### 4. `fetchPlayerHistory()` - Linha ~228-300
```typescript
// Cache key em lowercase
const cacheKey = `${player.toLowerCase()}-${playerId || 'noid'}-${limit}`;

// Busca do ID em lowercase
playerId = playerIdMap.get(player.toLowerCase());

// Filtro case-insensitive no fallback
const playerMatches = recentGames.filter(m => 
    m.home_player.toLowerCase() === player.toLowerCase() || 
    m.away_player.toLowerCase() === player.toLowerCase()
);
```

## Logs de Debug Aprimorados

Adicionados logs mais detalhados para facilitar debug:

```typescript
console.log(`[Cache Hit] Returning cached data for ${player}`);
console.log(`[API Call] Fetching history for ${player} (ID: ${playerId})...`);
console.warn(`[API Error] HTTP ${response.status} for player ${player}`);
console.warn(`[Fallback] No ID for player ${player}, searching in recent games...`);
console.log(`[Fallback] Searching ${player} in ${recentGames.length} recent games...`);
console.log(`[Fallback Success] Found ${playerMatches.length} matches for ${player}`);
console.warn(`[Fallback Failed] No matches found for player ${player}`);
console.error(`[Error] Error fetching specific history for player ${player}`);
```

## Teste

### Cenário 1: Nome Exato (case-insensitive)
```
Live: "baba"  → Cache: "baba" → ✅ Encontrado
Live: "Baba"  → Cache: "baba" → ✅ Encontrado
Live: "BABA"  → Cache: "baba" → ✅ Encontrado
Live: "BaBa"  → Cache: "baba" → ✅ Encontrado
```

### Cenário 2: Fallback nos Jogos Recentes
```
Live: "Baba"
Cache: não tem ID
Busca em jogos recentes: "baba" vs "Baba" → toLowerCase() → ✅ Match
```

## Exemplo de Logs Esperados

### Sucesso (Com ID):
```
[LiveGames] Fetching history for Baba...
[API Call] Fetching history for Baba (ID: 123456)...
Player History API Response Structure: ["sport", "sessions"]
Player Baba history events found: 10
[LiveGames] Got 10 matches for Baba
[LiveGames] Calculated stats for Baba
```

### Sucesso (Fallback):
```
[LiveGames] Fetching history for Baba...
[Fallback] No ID for player Baba, searching in recent games...
[Fallback] Searching Baba in 120 recent games...
[Fallback Success] Found 15 matches for Baba in recent games
[LiveGames] Got 15 matches for Baba
[LiveGames] Calculated stats for Baba
```

### Erro (Não Encontrado):
```
[LiveGames] Fetching history for UnknownPlayer...
[Fallback] No ID for player UnknownPlayer, searching in recent games...
[Fallback] Searching UnknownPlayer in 120 recent games...
[Fallback Failed] No matches found for player UnknownPlayer
[LiveGames] Got 0 matches for UnknownPlayer
```

## Impacto

✅ **Resolvido:** Carregamento infinito quando nomes têm case diferente  
✅ **Melhorado:** Performance com cache case-insensitive  
✅ **Melhorado:** Logs mais informativos para debug  
✅ **Garantido:** Compatibilidade com variações de maiúsculas/minúsculas  

## Checklist de Teste

- [ ] Jogador com nome tudo minúsculo (ex: "baba")
- [ ] Jogador com nome com maiúscula inicial (ex: "Baba")
- [ ] Jogador com nome tudo maiúsculo (ex: "BABA")
- [ ] Jogador com nome mixed case (ex: "BaBa")
- [ ] Jogador não encontrado (deve usar fallback)
- [ ] Jogador encontrado com ID (deve usar API Green365)
- [ ] Cache funcionando (segunda busca usa cache)

## Próximos Passos

1. Execute: `npm run dev`
2. Abra DevTools (F12) → Console
3. Vá para **Jogos ao Vivo**
4. Procure por logs `[API Call]` ou `[Fallback]`
5. Verifique se as métricas aparecem nos cards
6. Teste o botão "Analisar Detalhes"

Se ainda houver problemas, me envie:
- ✅ Logs completos do console
- ✅ Nome do jogador que está falhando
- ✅ Screenshot da aba Network
