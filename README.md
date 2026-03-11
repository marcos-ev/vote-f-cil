# CD2 Poker Planning

Sistema interno de Poker Planning para equipes pequenas, com suporte a squads, sala em tempo real e histórico de estimativas.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Node.js + Express + WebSocket
- SQLite (`better-sqlite3`)

## Rodando localmente

```sh
npm install
npm run dev:all
```

Frontend: `http://localhost:8080`  
Backend/API+WS: `http://localhost:8787`

## Scripts

- `npm run dev`: sobe apenas frontend (Vite)
- `npm run dev:server`: sobe apenas backend (API + WebSocket)
- `npm run dev:all`: sobe frontend e backend juntos
- `npm run build`: build do frontend

## Banco de dados

- Arquivo SQLite: `data/app.sqlite`
- Tabelas principais: `squads`, `squad_members`, `rooms`, `participants`, `stories`

## Variáveis opcionais

- `VITE_API_BASE_URL`: URL base da API (por padrão usa `http(s)://<host atual>:8787`)
