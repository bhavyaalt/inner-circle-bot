require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Add founding members here
// Get Telegram IDs by forwarding a message from the user to @userinfobot
const FOUNDING_MEMBERS = [
    // { telegram_id: 123456789, username: 'username', first_name: 'Name' },
    // Add more founding members...
];

async function seed() {
    console.log('🌱 Seeding founding members...\n');
    
    if (FOUNDING_MEMBERS.length === 0) {
        console.log('⚠️  No founding members defined in FOUNDING_MEMBERS array.');
        console.log('   Edit this file and add members before running.');
        return;
    }
    
    for (const member of FOUNDING_MEMBERS) {
        try {
            const { data, error } = await supabase
                .from('inner_circle_members')
                .upsert({
                    telegram_id: member.telegram_id,
                    username: member.username,
                    first_name: member.first_name,
                    last_name: member.last_name || null,
                    is_founding_member: true,
                    invites_remaining: 2
                }, {
                    onConflict: 'telegram_id'
                })
                .select()
                .single();
            
            if (error) throw error;
            
            console.log(`✅ Added: ${member.first_name} (@${member.username}) - ID: ${member.telegram_id}`);
        } catch (err) {
            console.error(`❌ Failed to add ${member.first_name}:`, err.message);
        }
    }
    
    console.log('\n🎉 Seeding complete!');
}

seed().catch(console.error);
