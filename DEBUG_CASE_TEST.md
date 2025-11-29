# Debug - Case Sensitivity Issue

## Teste Imediato

### Passo 1: Limpar Cache do Navegador
```
1. Pressione Ctrl+Shift+Delete
2. Marque "Cache" e "Cookies"
3. Clique em "Limpar dados"
4. Feche todas as abas
5. Reabra o navegador
```

### Passo 2: Executar Aplicação
```bash
npm run dev
```

### Passo 3: Abrir DevTools
```
1. Pressione F12
2. Vá para aba Console
3. Clique no ícone "Clear console" (🚫) para limpar
```

### Passo 4: Sequência de Navegação IMPORTANTE!

**NÃO vá direto para Jogos ao Vivo!**

1. **PRIMEIRO:** Abra a aba **Overview** ou **Histórico**
   - Aguarde 5-10 segundos
   - Procure no console: `[fetchHistoryGames] Loaded X matches`
   - Verifique: `[fetchHistoryGames] Sample player names:`

2. **DEPOIS:** Vá para aba **Jogos ao Vivo**
   - Procure: `[LiveGames] Loading live games...`
   - Procure: `[LiveGames] Fetching history for XXX...`

### Passo 5: Copiar Logs Específicos

**Para jogador que FUNCIONA (minúsculo):**
```
[LiveGames] Fetching history for maksdh...
[ID Found] Player "maksdh" → ID XXXXX
ou
[No ID] Player "maksdh" not in cache
[Fallback] Searching maksdh in X recent games...
```

**Para jogador que NÃO FUNCIONA (maiúscula):**
```
[LiveGames] Fetching history for Baba...
[No ID] Player "Baba" (lowercase: "baba") not in cache
[Cache Content] Players in cache: [...]
[Fallback] Searching Baba in X recent games...
[Fallback] Searching for: "baba"
[Fallback] Sample players in recent games: [...]
```

## Informações Críticas Necessárias

Me envie os seguintes logs:

### 1. Carregamento de Jogos Recentes
```
[fetchHistoryGames] Loaded X matches from 5 pages
[fetchHistoryGames] Sample player names: [...]
```

### 2. Cache de IDs
```
[Cache Content] Players in cache: [...]
```

### 3. Busca do Jogador
```
[LiveGames] Fetching history for Baba...
[No ID] Player "Baba" (lowercase: "baba") not in cache
[Fallback] Searching for: "baba"
[Fallback] Sample players in recent games: [...]
[Fallback] Match found: XXX vs YYY  (se encontrar)
ou
[Fallback Failed] No matches found for player Baba  (se não encontrar)
```

## Checklist de Diagnóstico

- [ ] Jogos recentes foram carregados? (procure `[fetchHistoryGames] Loaded`)
- [ ] Há jogadores no cache? (procure `[Cache Content] Players in cache`)
- [ ] O nome lowercase está sendo usado na busca? (procure `[Fallback] Searching for:`)
- [ ] Os nomes de exemplo estão em lowercase? (procure `Sample players in recent games`)
- [ ] Algum match foi encontrado? (procure `[Fallback] Match found:`)

## Possíveis Problemas

### Problema 1: Cache Vazio
```
[Cache Content] Players in cache: []
```
**Causa:** Jogos recentes não foram carregados antes de ir para Jogos ao Vivo
**Solução:** Visite Overview primeiro

### Problema 2: Nomes Diferentes
```
[Fallback] Searching for: "baba"
[Fallback] Sample players in recent games: ["maksdh vs nightxx", "bodyaoo vs space"]
```
**Causa:** O jogador "baba" não está nos jogos recentes da API Green365
**Solução:** API de jogos ao vivo pode ter jogadores diferentes da API de jogos recentes

### Problema 3: Nome com Espaços ou Caracteres Especiais
```
[Fallback] Searching for: "baba "  (note o espaço)
```
**Causa:** Nome tem espaço no final
**Solução:** Precisamos adicionar `.trim()` na normalização

### Problema 4: Fetch Infinito
**Sintoma:** O ícone de loading não para
**Causa:** Promise não está resolvendo
**Verificar:** Se não há logs `[Fallback Success]` ou `[Fallback Failed]`

## Estrutura Esperada dos Logs

### Fluxo Completo para "Baba":
```
1. [fetchHistoryGames] Starting to fetch recent games...
2. [fetchHistoryGames] Loaded 120 matches from 5 pages
3. [fetchHistoryGames] Sample player names: ["baba vs snail", "hulk vs tifosi", ...]
4. [LiveGames] Loading live games...
5. [LiveGames] Received 8 live games
6. [LiveGames] Processing 8 live games
7. [LiveGames] Extracted players: Baba vs Snail (status: 1)
8. [LiveGames] Players to fetch: Baba, Snail
9. [LiveGames] Fetching history for Baba...
10. [No ID] Player "Baba" (lowercase: "baba") not in cache
11. [Cache Content] Players in cache: ["baba", "snail", "hulk", ...]
12. [Fallback] No ID for player Baba, searching in recent games...
13. [Fallback] Searching Baba in 120 recent games...
14. [Fallback] Searching for: "baba"
15. [Fallback] Sample players in recent games: ["baba vs snail", "hulk vs tifosi", ...]
16. [Fallback] Match found: baba vs snail
17. [Fallback Success] Found 15 matches for Baba in recent games
18. [LiveGames] Got 15 matches for Baba
19. [LiveGames] Calculated stats for Baba: {...}
```

## Screenshot Necessário

Por favor, tire um screenshot mostrando:
1. A aba Console com os logs
2. A tela de Jogos ao Vivo com os cards (mostrando quais têm métricas e quais não)

## Teste Adicional

Execute este comando no Console do navegador:
```javascript
// Verificar cache de jogadores
console.log('Testing player lookup...');
console.log('Has "baba"?', window.playerIdMap?.has('baba'));
console.log('Has "Baba"?', window.playerIdMap?.has('Baba'));
```

(Nota: Isso pode não funcionar se o Map não estiver exposto, mas vale tentar)

## Próximos Passos

Depois de seguir esses passos e coletar os logs, me envie:
1. ✅ Logs completos do console (copie e cole TUDO)
2. ✅ Screenshot da tela
3. ✅ Lista de jogadores que funcionam vs não funcionam
4. ✅ Nomes exatos como aparecem nos cards (Baba, baba, BABA, etc.)

Com essas informações conseguirei identificar o problema exato!
