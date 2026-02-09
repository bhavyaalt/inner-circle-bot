const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Member functions
async function getMemberByTelegramId(telegramId) {
    const { data, error } = await supabase
        .from('inner_circle_members')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

async function createMember({ telegramId, username, firstName, lastName, isFoundingMember = false, invitedById = null }) {
    const { data, error } = await supabase
        .from('inner_circle_members')
        .insert({
            telegram_id: telegramId,
            username,
            first_name: firstName,
            last_name: lastName,
            is_founding_member: isFoundingMember,
            invited_by: invitedById,
            invites_remaining: 2
        })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function getMemberById(id) {
    const { data, error } = await supabase
        .from('inner_circle_members')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) throw error;
    return data;
}

async function decrementInvites(memberId) {
    const { data, error } = await supabase
        .rpc('decrement_invites', { member_id: memberId });
    
    // Fallback if RPC doesn't exist
    if (error) {
        const member = await getMemberById(memberId);
        if (member.invites_remaining <= 0) return false;
        
        const { error: updateError } = await supabase
            .from('inner_circle_members')
            .update({ invites_remaining: member.invites_remaining - 1 })
            .eq('id', memberId);
        
        if (updateError) throw updateError;
        return true;
    }
    return data;
}

// Invite functions
async function createInvite(createdById, targetUsername = null) {
    const code = generateInviteCode();
    
    const { data, error } = await supabase
        .from('inner_circle_invites')
        .insert({
            code,
            created_by: createdById,
            target_username: targetUsername
        })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function getInviteByCode(code) {
    const { data, error } = await supabase
        .from('inner_circle_invites')
        .select('*, creator:created_by(telegram_id, username, first_name)')
        .eq('code', code)
        .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

async function markInviteUsed(inviteId, usedById) {
    const { data, error } = await supabase
        .from('inner_circle_invites')
        .update({
            used_by: usedById,
            used_at: new Date().toISOString()
        })
        .eq('id', inviteId)
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function getInvitesByMember(memberId) {
    const { data, error } = await supabase
        .from('inner_circle_invites')
        .select('*')
        .eq('created_by', memberId)
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
}

async function getMemberStats() {
    const { data: members, error: membersError } = await supabase
        .from('inner_circle_members')
        .select('id, is_founding_member, joined_at');
    
    if (membersError) throw membersError;
    
    return {
        total: members.length,
        founding: members.filter(m => m.is_founding_member).length,
        invited: members.filter(m => !m.is_founding_member).length
    };
}

// Helper
function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

module.exports = {
    supabase,
    getMemberByTelegramId,
    createMember,
    getMemberById,
    decrementInvites,
    createInvite,
    getInviteByCode,
    markInviteUsed,
    getInvitesByMember,
    getMemberStats
};
