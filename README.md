# 🏆 Ranking Comercial — Leaderboard

Dashboard de vendas em tempo real conectado ao Google Sheets e Supabase,
hospedado gratuitamente na Vercel.

---

## Arquitetura

```
Google Sheets (CSV público)
        ↓  30s cache
  Vercel Edge Function  /api/sheets
        ↓
    index.html  ←→  /api/metas  ←→  Supabase (Postgres)
```

---

## 1. Configurar o Supabase

### 1.1 Criar a tabela `metas`

No painel do Supabase → **SQL Editor** → execute:

```sql
CREATE TABLE metas (
  id            int  PRIMARY KEY DEFAULT 1,
  meta_vendas   numeric NOT NULL DEFAULT 0,
  meta_entradas numeric NOT NULL DEFAULT 0,
  meta_equipes  numeric NOT NULL DEFAULT 0,
  updated_at    timestamptz DEFAULT now()
);

-- Garante que sempre exista exatamente 1 linha
INSERT INTO metas (id) VALUES (1) ON CONFLICT DO NOTHING;
```

### 1.2 Liberar acesso pela anon key (RLS)

No Supabase → **Authentication → Policies** → tabela `metas`:

```sql
-- Leitura pública
CREATE POLICY "leitura publica"
ON metas FOR SELECT
USING (true);

-- Escrita pública (ou restrinja por JWT se quiser autenticação)
CREATE POLICY "escrita publica"
ON metas FOR ALL
USING (true);
```

---

## 2. Publicar a planilha Google Sheets como CSV

1. Abra a planilha no Google Sheets
2. **Arquivo → Compartilhar → Publicar na web**
3. Escolha **Documento inteiro** e formato **CSV** → clique **Publicar**
4. Copie a URL gerada. Ela terá o formato:
   ```
   https://docs.google.com/spreadsheets/d/SEU_ID/pub?output=csv

   
   ```
5. Anote o `SEU_ID` para a variável de ambiente


### Descobrir o GID de cada aba

Abra cada aba na planilha e observe a URL:
```
https://docs.google.com/spreadsheets/d/SEU_ID/edit#gid=NUMERO


```
O `NUMERO` é o `gid` da aba.

---

## 3. Configurar variáveis de ambiente na Vercel

No painel da Vercel → **Settings → Environment Variables**:

| Variável           | Valor                                                               |
|--------------------|----------------------------------------------------------------------|
| `SHEETS_URL`       | `https://docs.google.com/spreadsheets/d/SEU_ID/pub?output=csv`     |
| `SUPABASE_URL`     | `https://xxxx.supabase.co`                                          |
| `SUPABASE_ANON_KEY`| `eyJh...` (encontre em Project Settings → API)                      |

---

## 4. Ajustar os GIDs no index.html

Abra `index.html` e edite o objeto `GID` no topo do `<script>`:

```js
const GID = {
  mensal:  "0",    // ← gid da aba Ranking Mensal
  semanal: "123",  // ← gid da aba Campanha Semanal
  equipes: "456",  // ← gid da aba Campanha Mensal
};
```

> **Dica:** Se todas as 3 tabelas estiverem na mesma aba (como no print),
> coloque o mesmo gid nos 3 campos e o dashboard buscará uma só vez.

---

## 5. Deploy na Vercel

```bash
# Instale a CLI da Vercel (uma vez só)
npm i -g vercel

# Na pasta do projeto
vercel

# Siga as instruções:
# - Link to existing project? No → crie novo
# - Framework? Other
# - Deploy!
```

Ou conecte o repositório GitHub em https://vercel.com/new — a Vercel
detecta automaticamente e faz deploy a cada push.

---

## 6. Estrutura de arquivos

```
leaderboard/
├── api/
│   ├── sheets.js   ← proxy Google Sheets com cache 30s
│   └── metas.js    ← CRUD metas via Supabase
├── index.html      ← dashboard completo
├── vercel.json     ← configuração Edge Functions
└── README.md
```

---

## Ajuste fino: colunas da planilha

Se sua planilha tiver colunas em ordem diferente, edite o objeto `COLS`
no `index.html`:

```js
const COLS = {
  mensal:  { nome: 0, vendas: 1, validos: 2, posicao: 3 },
  semanal: { equipe: 0, vendas: 1, entrada: 2, sucesso: 3, posicao: 4 },
  equipes: { equipe: 0, vendas: 1, validadas: 2, posicao: 3 },
};
```

Os números são os índices das colunas no CSV (0 = primeira coluna).

---

## Atualização automática

- O dashboard atualiza os dados da planilha **a cada 30 segundos** automaticamente.
- A Edge Function em `/api/sheets` faz cache de 30s para não sobrecarregar o Google.
- As metas são buscadas do Supabase no carregamento da página.

---

## TV / Modo quiosque

Para exibir em Smart TV sem interação do usuário, abra o navegador em
modo kiosk apontando para a URL do deploy:

```
# Chrome/Chromium
google-chrome --kiosk https://seu-projeto.vercel.app

# Ou use um timer de reload (já incluso: 30s via JS)
```
