# Instruções de Debug - Migração API Green365

## Alterações Realizadas

### 1. Removidas APIs antigas:
- ❌ `https://esoccer.dev3.caveira.tips/v1/esoccer/analysis`
- ❌ `https://esoccer.dev3.caveira.tips/v1/esoccer/search`
- ❌ `https://rwtips-r943.onrender.com/api/v1/historico/confronto`
- ❌ `https://rwtips-r943.onrender.com/api/v1/historico/partidas-assincrono`

### 2. APIs Green365 Consolidadas:
- ✅ **Histórico de Jogos:** `https://api-v2.green365.com.br/api/v2/sport-events`
- ✅ **Análise de Jogador:** `https://api-v2.green365.com.br/api/v2/analysis/participant/dynamic`
- ✅ **Confrontos Diretos (H2H):** `https://api-v2.green365.com.br/api/v2/analysis/sport/dynamic`

### 3. Estruturas de Dados Atualizadas:

#### API H2H (Confrontos Diretos)
```
Resposta esperada:
{
  "sessions": {
    "sessionEvents": {
      "headToHeadEvents": [...],  // Confrontos diretos
      "homeEvents": [...],         // Jogos do jogador 1
      "awayEvents": [...]          // Jogos do jogador 2
    }
  }
}
```

#### API Histórico do Jogador
```
Resposta esperada:
{
  "sessions": {
    "sessionEvents": {
      "events": [...]  // Últimos jogos do jogador
    }
  }
}
```

## Debug no Console

Foram adicionados logs para ajudar a identificar problemas:

1. **Console do navegador (F12):**
   - Abra DevTools → Console
   - Procure por:
     - "H2H API Response Structure:" - mostra estrutura da API H2H
     - "H2H Events found:" - quantidade de eventos encontrados
     - "Player History API Response Structure:" - estrutura da API de histórico
     - "Player X history events found:" - quantidade de eventos do jogador

2. **Verificar erros:**
   - "Missing IDs for H2H:" - IDs não foram capturados
   - "sessionEvents not found" - estrutura da API mudou
   - "Green365 H2H Error:" - erro na chamada da API

## Como Testar

1. Execute o servidor:
   ```bash
   npm run dev
   ```

2. Abra o navegador em `http://localhost:5173` (ou porta configurada)

3. Abra DevTools (F12) → Console

4. Navegue para H2H e selecione:
   - Liga: Qualquer liga disponível
   - Jogador 1: Ex: "maksdh"
   - Jogador 2: Ex: "nightxx"

5. Clique em "Comparar"

6. Verifique os logs no console:
   - Se aparecer "H2H API Response Structure:", anote as chaves disponíveis
   - Se aparecer "sessionEvents not found", a estrutura é diferente

## Possíveis Problemas

### Problema 1: "Missing IDs for H2H"
**Causa:** IDs dos jogadores/liga não foram capturados
**Solução:** 
- Certifique-se de carregar a página Overview primeiro
- Os IDs são capturados ao processar o histórico de jogos

### Problema 2: "sessionEvents not found"
**Causa:** Estrutura da API mudou
**Solução:**
- Verifique os logs "Available keys:"
- Ajuste o código em `services/api.ts` linha ~117-120

### Problema 3: Métricas não aparecem
**Causa:** Estrutura dos eventos está incorreta
**Solução:**
- Verifique os logs de quantidade de eventos
- Se eventos = 0, verifique a normalização em `normalizeHistoryMatch()`

## Próximos Passos

Se os logs mostrarem uma estrutura diferente, me informe:
1. O conteúdo completo de "H2H API Response Structure:"
2. O conteúdo completo de "Player History API Response Structure:"
3. Se houver erros no console, copie-os

Isso me ajudará a corrigir o código para a estrutura correta da API.
