-- Inner Circle Bot - Supabase Migration
-- Run this in your Supabase SQL Editor

-- Members table
CREATE TABLE IF NOT EXISTS inner_circle_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  telegram_username TEXT,
  telegram_name TEXT,
  is_founding_member BOOLEAN DEFAULT FALSE,
  invites_remaining INTEGER DEFAULT 2,
  invited_by UUID REFERENCES inner_circle_members(id),
  badge TEXT,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invite codes table
CREATE TABLE IF NOT EXISTS inner_circle_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES inner_circle_members(id) NOT NULL,
  used_by UUID REFERENCES inner_circle_members(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_members_telegram_id ON inner_circle_members(telegram_id);
CREATE INDEX IF NOT EXISTS idx_invites_code ON inner_circle_invites(code);
CREATE INDEX IF NOT EXISTS idx_invites_created_by ON inner_circle_invites(created_by);

-- Enable RLS
ALTER TABLE inner_circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE inner_circle_invites ENABLE ROW LEVEL SECURITY;

-- Policies (allow service role full access)
CREATE POLICY "Service role full access to members" ON inner_circle_members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to invites" ON inner_circle_invites
  FOR ALL USING (true) WITH CHECK (true);
