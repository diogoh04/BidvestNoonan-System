# Bidvest Noonan — Gestão de Staff

Sistema de cadastro de staff (cleaners e team leaders), prédios e observações,
usando Next.js 14 (App Router) + TypeScript + Prisma + Neon (Postgres) + Tailwind.

## 1. Instalar dependências

```bash
npm install
```

## 2. Configurar o banco (Neon)

1. Copie `.env.example` para `.env` e preencha `DATABASE_URL` e `DIRECT_URL`
   com as connection strings do seu projeto no Neon (Dashboard → Connection Details).
2. Rode o script de migração **uma única vez**, no SQL editor do Neon (ou via `psql`):
   `prisma/manual-migration.sql`

   Esse script:
   - Adiciona a coluna `role` (`cleaner` / `team_leader`) na tabela `worker`, com default `cleaner`
   - Cria a tabela `staff_building` (vínculo N:N entre team leader e prédios)
   - Remove `worker.feedback` (coluna legada, texto solto) e a tabela `playing_with_neon`
   - **Não apaga** nenhum dado de `worker`, `predios` ou `feedback`

3. Gere o Prisma Client (mapeado em cima das tabelas existentes):

```bash
npx prisma generate
```

> Não é necessário rodar `prisma migrate` — o schema em `prisma/schema.prisma`
> já está mapeado (`@@map`) em cima das tabelas físicas que você já tem
> (`worker`, `predios`, `feedback`) mais a nova `staff_building`.

## 3. Rodar localmente

```bash
npm run dev
```

Abra http://localhost:3000

## 4. Depois de importar os dados antigos

Todo `worker` já existente virou automaticamente `role = 'cleaner'` (default do migration).
Entre no sistema e edite manualmente quem na verdade é team leader, marcando o tipo
e selecionando os prédios pelos quais ele responde.

## 5. Deploy no Vercel

1. Suba este projeto para um repositório (GitHub/GitLab/Bitbucket)
2. Em vercel.com → New Project → importe o repositório
3. Em Settings → Environment Variables, adicione `DATABASE_URL` e `DIRECT_URL`
   (as mesmas do seu `.env`, usando a **pooled connection** do Neon para `DATABASE_URL`)
4. Deploy. O Vercel já roda `prisma generate` automaticamente via `postinstall`.

## Estrutura

```
app/
  page.tsx                 -> Dashboard (Team Leader / Building)
  team-leaders/             -> lista + detalhe (prédios + cleaners)
  buildings/                 -> lista + detalhe (team leaders + cleaners)
  filter/                    -> busca por prédio / nome / staff number
  staff/new, staff/[id]/edit -> cadastro e edição
  api/                        -> rotas REST (staff, buildings, team-leaders, feedback)
components/
  Header.tsx                -> filtrar | logo | cadastrar staff
  StaffRow.tsx               -> card de staff com observação / editar / excluir
  StaffForm.tsx               -> formulário único de cadastro/edição (cleaner ou team leader)
prisma/
  schema.prisma              -> mapeado nas tabelas já existentes no Neon
  manual-migration.sql       -> script único de migração (rodar manualmente no Neon)
```

## Regras de negócio implementadas

- **Cleaner**: prédio fixo é opcional no cadastro (pode ficar sem prédio até ser definido)
- **Team Leader**: pode estar vinculado a **vários** prédios; e um prédio pode ter **vários** team leaders
- **Observações**: cada staff pode acumular várias observações (histórico), tabela `feedback`
- **Filtro**: combina prédio + (nome OU staff number), tudo opcional
