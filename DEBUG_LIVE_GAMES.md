# Debug - Jogos ao Vivo

## Alterações Realizadas

### 1. Melhorada função `fetchPlayerHistory`
Agora a função tem fallback automático:
1. Tenta buscar histórico na API Green365 com ID (se disponível)
2. Se não tiver ID, busca nos jogos recentes carregados
3. Filtra jogos do jogador específico

### 2. Logs de Debug Adicionados

**Em `services/api.ts`:**
- "No ID for player X, searching in recent games..."
- "Found N matches for X in recent games"
- "No matches found for player X"

**Em `views/LiveGames.tsx`:**
- "[LiveGames] Loading live games..."
- "[LiveGames] Received N live games"
- "[LiveGames] Processing N live games"
- "[LiveGames] Extracted players: X vs Y"
- "[LiveGames] Players to fetch: ..."
- "[LiveGames] Fetching history for X..."
- "[LiveGames] Got N matches for X"
- "[LiveGames] Calculated stats for X"

## Como Testar

### Passo 1: Abrir DevTools
```
Pressione F12
Vá para aba Console
```

### Passo 2: Carregar Jogos Recentes Primeiro (IMPORTANTE!)
1. Navegue para a aba **Overview** ou **Histórico** primeiro
2. Aguarde os jogos recentes carregarem (isso popula o cache de IDs)
3. Verifique no console se há mensagens sobre jogos carregados

### Passo 3: Ir para Jogos ao Vivo
1. Clique na aba **"Jogos ao Vivo"**
2. Observe os logs no console

### Passo 4: Analisar Logs

**Logs esperados:**
```
[LiveGames] Loading live games...
[LiveGames] Received 10 live games
[LiveGames] Processing 10 live games
[LiveGames] Extracted players: maksdh vs nightxx (status: 1)
[LiveGames] Extracted players: bodyaoo vs space (status: live)
[LiveGames] Players to fetch: maksdh, nightxx, bodyaoo, space
[LiveGames] Fetching history for maksdh...
Player History API Response Structure: ["sport", "sessions", "info"]
Player maksdh history events found: 10
[LiveGames] Got 10 matches for maksdh
[LiveGames] Calculated stats for maksdh: {...}
```

**Se não tiver ID:**
```
No ID for player maksdh, searching in recent games...
Found 15 matches for maksdh in recent games
[LiveGames] Got 15 matches for maksdh
```

## Problemas Possíveis

### ❌ "[LiveGames] Received 0 live games"
**Causa:** API de jogos ao vivo não está retornando dados
**Solução:**
1. Verifique a aba Network → Filtro "live"
2. Veja se a requisição para `rwtips-r943.onrender.com/api/matches/live` retorna 200
3. Verifique o conteúdo da resposta

### ❌ "No matches found for player X"
**Causa:** Nome do jogador não bate com os jogos recentes
**Solução:**
1. Verifique no console: "[LiveGames] Extracted players: X vs Y"
2. Compare com os nomes nos jogos recentes (Overview)
3. Pode haver diferença em maiúsculas/minúsculas ou espaços

**Exemplo de problema:**
- Jogos ao vivo: "Maksdh" (com M maiúsculo)
- Jogos recentes: "maksdh" (tudo minúsculo)

**Solução aplicada:** A busca agora usa `.toLowerCase()` para ignorar maiúsculas/minúsculas

### ❌ "Player X history events found: 0"
**Causa:** API Green365 não encontrou eventos
**Solução:**
- O sistema agora busca automaticamente nos jogos recentes como fallback

### ✅ Métricas aparecem
Parabéns! As estatísticas devem mostrar:
- Badges de sinais (HT+, FT 2.5+, BTTS, etc.)
- Porcentagens de over/under
- Indicadores de forma dos jogadores

## Fluxo de Dados

```
1. Carregar Jogos ao Vivo
   └─> fetchLiveGames() → rwtips API
       └─> Retorna jogos com formato: "Team (player)"

2. Extrair Nomes dos Jogadores
   └─> extractPlayerName("Man City (maksdh)") → "maksdh"

3. Buscar Histórico do Jogador
   └─> fetchPlayerHistory("maksdh", 10)
       ├─> TEM ID? 
       │   ├─> SIM → API Green365 /participant/dynamic
       │   └─> NÃO → Busca em jogos recentes (fetchHistoryGames)
       └─> Retorna últimos 10 jogos do jogador

4. Calcular Estatísticas
   └─> calculateHistoryPlayerStats(matches, "maksdh", 10)
       └─> Retorna: avgScored, htOver05Pct, ftOver25Pct, etc.

5. Exibir na Interface
   └─> Badges coloridos com métricas
```

## Estrutura de Nome nos Jogos ao Vivo

A API `rwtips` retorna jogos no formato:
```json
{
  "home": {
    "name": "Manchester City (maksdh)"
  },
  "away": {
    "name": "Dortmund (nightxx)"
  }
}
```

A função `extractPlayerName()` pega o nome entre parênteses:
- Input: `"Manchester City (maksdh)"`
- Output: `"maksdh"`

## Checklist de Teste

- [ ] Jogos ao vivo aparecem na tela
- [ ] Logs "[LiveGames] Received N live games" aparecem no console
- [ ] Nomes dos jogadores são extraídos corretamente
- [ ] Histórico é buscado (com ou sem ID)
- [ ] Estatísticas são calculadas
- [ ] Badges de sinais aparecem nos cards dos jogos
- [ ] Botão "Analisar Detalhes" funciona e leva para H2H

## Botão "Analisar Detalhes"

O botão já está configurado para extrair corretamente os nomes:
```typescript
const handleGoToH2H = () => {
    const p1 = extractPlayerName(game.home.name);  // "maksdh"
    const p2 = extractPlayerName(game.away.name);  // "nightxx"
    const league = game.league.name;               // "Esoccer Battle - 8 mins play"
    navigate(`/h2h?league=${...}&p1=${...}&p2=${...}`);
};
```

Isso garante que os parâmetros passados para a página H2H são apenas os nomes dos jogadores, sem o time.

## Próximos Passos

Execute a aplicação e me envie:
1. ✅ Todos os logs do console (copie e cole)
2. ✅ Screenshot da aba Network mostrando as requisições
3. ✅ Screenshot da tela de jogos ao vivo
4. ✅ Qualquer mensagem de erro que aparecer

Com essas informações posso identificar exatamente onde está o problema e corrigir.
