
# 🚀 Evolutech Digital Core - Guia de Instalação e Execução

Este guia descreve o passo a passo completo para configurar o ambiente de desenvolvimento, conectar o banco de dados Neon 3(PostgreSQL), rodar as migrações do Prisma e realizar o login no sistema SaaS Whitelabel.

---

## 📋 Pré-requisitos

* **Node.js** (v18 ou superior)
* **NPM** ou **Yarn**
* **Conta no Neon DB** (PostgreSQL)

---

## ⚙️ Passo 1: Configuração do Backend (API & Banco)

### 1. Instalação de Dependências

Abra o terminal na pasta do backend:

```bash
cd backend-evolutech
npm install

```

### 2. Configuração de Variáveis de Ambiente (.env)

Crie ou edite o arquivo `.env` na raiz de `backend-evolutech`. Ele deve conter:

```env
# Porta do Servidor
PORT=3001

# Chave secreta para assinar os Tokens JWT (Pode ser qualquer string aleatória e segura)
JWT_SECRET=sua_chave_secreta_super_segura_aqui

# Conexão com o Neon DB (ATENÇÃO: Adicione ?pgbouncer=true no final para evitar erros de cache)
DATABASE_URL="postgres://usuario:senha@ep-url-do-neon.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"

```

### 3. Configuração do Banco de Dados (Prisma)

Com as dependências instaladas e o `.env` configurado, execute os comandos abaixo na ordem para "resetar" e preparar o banco:

```bash
# 1. Gera o cliente TypeScript do Prisma (lê o schema.prisma)
npx prisma generate

# 2. Envia a estrutura do banco (schema) para o Neon.
# (Se perguntar sobre perda de dados, digite 'y' para aceitar o reset)
npx prisma db push --force-reset

# 3. Popula o banco com o Super Admin inicial
npx ts-node prisma/seed.ts

```

> **Resultado Esperado:** O terminal deve exibir `✅ Admin pronto` ou `✅ Seed concluído!`.

### 4. Rodar o Servidor

```bash
npm run dev

```

> O servidor iniciará em `http://localhost:3001`. Mantenha este terminal aberto.

---

## 🖥️ Passo 2: Configuração do Frontend (React)

Abra um **novo terminal** (não feche o do backend) e vá para a pasta do frontend (raiz do projeto):

### 1. Instalação

```bash
# Se estiver na pasta do backend, volte um nível: cd ..
npm install

```

### 2. Rodar a Aplicação

```bash
npm run dev

```

> O Vite iniciará o frontend, geralmente em `http://localhost:8080` ou `http://localhost:5173`.

---

## 🔐 Passo 3: Login (Teste Final)

1. Abra seu navegador e acesse a URL do Frontend (ex: `http://localhost:8080/login`).
2. Utilize as credenciais de **Super Admin** criadas pelo Seed:

| Campo | Valor |
| --- | --- |
| **Email** | `admin@evolutech.com` |
| **Senha** | `123456` |

3. Clique em **Entrar**.
4. Você deve ver a mensagem **"Bem-vindo, Super Admin!"** e ser redirecionado para o Dashboard Administrativo (`/admin-evolutech`).

---

## 🛠️ Solução de Problemas Comuns

**Erro: "cached plan must not change result type"**

* **Causa:** O Prisma está usando cache de query incompatível com o Pooler do Neon.
* **Solução:** Verifique se sua `DATABASE_URL` no `.env` termina com `?pgbouncer=true` (ou `&pgbouncer=true`). Pare o servidor, rode `npx prisma db push --force-reset` e tente novamente.

**Erro: "Connection refused" no Login**

* **Causa:** O Backend não está rodando.
* **Solução:** Verifique o terminal do backend. Se ele caiu, rode `npm run dev` novamente.

**Erro: "Invalid credentials"**

* **Causa:** O banco foi resetado mas o Seed não rodou.
* **Solução:** Rode `npx ts-node prisma/seed.ts` na pasta do backend.