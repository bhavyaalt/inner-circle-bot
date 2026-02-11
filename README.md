# Inner Circle Bot 🎟️

Invite-only Telegram membership bot with exponential but controlled growth.

## Features

- **Invite System**: Each member gets 2 invites
- **Founding Members**: Special badge + seeding commands
- **Member Cards**: Auto-generated profile cards with avatar
- **Status Tracking**: View stats and invite history

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Join with invite code or check status |
| `/invite` | Generate a new invite link (7 day expiry) |
| `/card` | Get your shareable member card |
| `/status` | View your status and circle stats |
| `/seed` | (Admin) Seed yourself as founding member |
| `/seedmember` | (Admin) Add other founding members |

## Setup

### 1. Create Telegram Bot
- Talk to [@BotFather](https://t.me/BotFather)
- Create new bot, get token

### 2. Run Supabase Migration
Execute `supabase-migration.sql` in your Supabase SQL Editor.

### 3. Environment Variables
```
BOT_TOKEN=your_telegram_bot_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
```

### 4. Deploy to Railway
```bash
railway init
railway up
```

Set environment variables in Railway dashboard.

## Growth Model

```
Founding Members (Day 0)
       ↓ 2 invites each
   Wave 1 Members
       ↓ 2 invites each
   Wave 2 Members
       ↓ ...exponential but controlled
```

## Tech Stack

- **Bot**: Telegraf (Telegram Bot Framework)
- **Database**: Supabase (PostgreSQL)
- **Card Generation**: node-canvas
- **Hosting**: Railway

## License

MIT
