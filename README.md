# Inner Circle Bot 🎖️

Exclusive invite-only membership system for Telegram groups with shareable member cards.

## Features

- **Invite System**: Each member gets 2 invites to share
- **Member Cards**: Beautiful shareable cards with profile photo, join date, badges
- **Founding Members**: Special badge for original members
- **Invite Tracking**: See who invited whom

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Join with invite code or check status |
| `/card` | Generate your shareable member card |
| `/invite [@user]` | Create an invite link (optionally for specific user) |
| `/status` | View your stats and circle info |
| `/help` | Show commands |

## Setup

### 1. Create Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow prompts
3. Copy the bot token

### 2. Set up Supabase

1. Go to your Supabase project SQL Editor
2. Run the migration in `supabase/migrations/001_init.sql`

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 4. Add Founding Members

Insert founding members directly in Supabase:

```sql
INSERT INTO inner_circle_members (telegram_id, username, first_name, is_founding_member, invites_remaining)
VALUES 
  (123456789, 'username1', 'First Name', true, 2),
  (987654321, 'username2', 'Another Name', true, 2);
```

### 5. Run

```bash
npm start
```

## Tech Stack

- **Bot**: Telegraf (Node.js)
- **Database**: Supabase (PostgreSQL)
- **Card Generation**: Canvas API

## Deployment

Deploy to Railway, Render, or any Node.js host.

```bash
# Railway
railway init
railway up
```

## License

MIT
