#!/usr/bin/env python3
"""
Telegram Group Member Sync
Fetches all members from a Telegram group and syncs to Supabase.

Usage:
    python sync-members.py <group_id_or_username>
    
Examples:
    python sync-members.py -1001234567890
    python sync-members.py @mygroup
"""

import sys
import asyncio
from telethon import TelegramClient
from telethon.tl.types import ChannelParticipantsSearch
from supabase import create_client
from datetime import datetime

# Telegram API credentials
API_ID = 36036016
API_HASH = "cc05391222b217ef9338f48010270509"

# Supabase credentials
SUPABASE_URL = "https://ohwtiwhbqsiwpktteaur.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9od3Rpd2hicXNpd3BrdHRlYXVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTc0MzQ5NSwiZXhwIjoyMDg1MzE5NDk1fQ.i3SIdWZFgtrr0i4qYOWmuIrjtr-RDxhxrpSa17kPptA"

# Session file location
SESSION_FILE = "inner_circle_sync"


async def get_group_members(client, group_id):
    """Fetch all members from a group."""
    members = []
    
    try:
        # Get the group entity
        group = await client.get_entity(group_id)
        print(f"📍 Found group: {getattr(group, 'title', group_id)}")
        print(f"   Type: {type(group).__name__}")
        
        # Try to get participant count
        try:
            full = await client.get_participants(group, limit=0)
            print(f"   Total participants: {full.total}")
        except Exception as e:
            print(f"   Could not get participant count: {e}")
        
        # Fetch all participants with aggressive=True for large groups
        print("⏳ Fetching members...")
        count = 0
        async for user in client.iter_participants(group, aggressive=True):
            count += 1
            if user.bot:
                continue  # Skip bots
                
            members.append({
                'telegram_id': user.id,
                'telegram_username': user.username,
                'telegram_name': f"{user.first_name or ''} {user.last_name or ''}".strip() or None,
            })
            
            # Progress indicator
            if count % 50 == 0:
                print(f"   Processed {count} users...")
            
        print(f"✅ Found {len(members)} members (excluding bots) out of {count} total users")
        
    except Exception as e:
        print(f"❌ Error fetching members: {e}")
        import traceback
        traceback.print_exc()
        return []
    
    return members


def sync_to_supabase(members):
    """Insert members into Supabase, skipping duplicates."""
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    added = 0
    skipped = 0
    
    for member in members:
        try:
            # Check if member exists
            existing = supabase.table('inner_circle_members') \
                .select('id') \
                .eq('telegram_id', member['telegram_id']) \
                .execute()
            
            if existing.data:
                skipped += 1
                continue
            
            # Insert new member
            supabase.table('inner_circle_members').insert({
                'telegram_id': member['telegram_id'],
                'telegram_username': member['telegram_username'],
                'telegram_name': member['telegram_name'],
                'is_founding_member': True,
                'invites_remaining': 2,
            }).execute()
            
            added += 1
            print(f"  ✓ Added: {member['telegram_name'] or member['telegram_username'] or member['telegram_id']}")
            
        except Exception as e:
            print(f"  ✗ Error adding {member['telegram_id']}: {e}")
    
    return added, skipped


async def main():
    if len(sys.argv) < 2:
        print("Usage: python sync-members.py <group_id_or_username>")
        print("Examples:")
        print("  python sync-members.py -1001234567890")
        print("  python sync-members.py @mygroup")
        sys.exit(1)
    
    group_id = sys.argv[1]
    
    # Convert to int if it looks like an ID
    if group_id.lstrip('-').isdigit():
        group_id = int(group_id)
    
    print("🔐 Connecting to Telegram...")
    
    async with TelegramClient(SESSION_FILE, API_ID, API_HASH) as client:
        # This will prompt for phone/code on first run
        await client.start()
        
        me = await client.get_me()
        print(f"✅ Logged in as: {me.first_name} (@{me.username})")
        
        # Get members
        members = await get_group_members(client, group_id)
        
        if not members:
            print("No members to sync.")
            return
        
        # Sync to Supabase
        print("\n📤 Syncing to Supabase...")
        added, skipped = sync_to_supabase(members)
        
        print(f"\n✨ Done!")
        print(f"   Added: {added}")
        print(f"   Skipped (already exist): {skipped}")


if __name__ == "__main__":
    asyncio.run(main())
