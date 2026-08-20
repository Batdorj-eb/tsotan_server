# Tsotan API

Express + TypeScript + PostgreSQL (`pg`, Prisma байхгүй).

## Postgres

Компьютер дээр PostgreSQL 18 суусан байна. Дараахыг `psql`-ээр ажиллуулна:

```sql
CREATE USER tsotan WITH PASSWORD 'tsotan';
CREATE DATABASE tsotan OWNER tsotan;
```

## Асаах

```bash
cd tsotan_server
npm install
npm run db:init
npm run dev
```

API: http://localhost:4000  
Админ: http://localhost:3001/admin  
Нэвтрэх: `admin` / `admin123`

QPay username/password-ийг `.env` дээр тавина. Зураг `uploads/` хавтаст хадгалагдана.

