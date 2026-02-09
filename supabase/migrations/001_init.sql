-- Inner Circle Members
CREATE TABLE IF NOT EXISTS inner_circle_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    is_founding_member BOOLEAN DEFAULT FALSE,
    invited_by UUID REFERENCES inner_circle_members(id),
    invites_remaining INTEGER DEFAULT 2,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invites
CREATE TABLE IF NOT EXISTS inner_circle_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    created_by UUID REFERENCES inner_circle_members(id) NOT NULL,
    target_username TEXT, -- who it's intended for (optional)
    used_by UUID REFERENCES inner_circle_members(id),
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_members_telegram_id ON inner_circle_members(telegram_id);
CREATE INDEX IF NOT EXISTS idx_invites_code ON inner_circle_invites(code);
CREATE INDEX IF NOT EXISTS idx_invites_created_by ON inner_circle_invites(created_by);

-- RLS Policies (enable RLS)
ALTER TABLE inner_circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE inner_circle_invites ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access members" ON inner_circle_members
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access invites" ON inner_circle_invites
    FOR ALL USING (true) WITH CHECK (true);
