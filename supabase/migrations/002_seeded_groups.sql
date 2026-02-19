-- Seeded Groups - tracks which groups have auto-member detection enabled
CREATE TABLE IF NOT EXISTS inner_circle_seeded_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id TEXT UNIQUE NOT NULL,  -- Telegram chat ID (stored as text for bigint support)
    chat_title TEXT,
    seeded_by UUID REFERENCES inner_circle_members(id),
    seeded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_seeded_groups_chat_id ON inner_circle_seeded_groups(chat_id);

-- RLS
ALTER TABLE inner_circle_seeded_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access seeded_groups" ON inner_circle_seeded_groups
    FOR ALL USING (true) WITH CHECK (true);
