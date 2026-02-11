const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { nanoid } = require('nanoid');
const path = require('path');

// Register bundled fonts
try {
  const fontsDir = path.join(__dirname, 'fonts');
  registerFont(path.join(fontsDir, 'Roboto-Regular.ttf'), { family: 'Roboto' });
  registerFont(path.join(fontsDir, 'Roboto-Bold.ttf'), { family: 'Roboto', weight: 'bold' });
  registerFont(path.join(fontsDir, 'Roboto-Italic.ttf'), { family: 'Roboto', style: 'italic' });
  console.log('✓ Fonts registered successfully');
} catch (e) {
  console.error('✗ Font registration failed:', e.message);
}

// Config
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GROUP_ID = process.env.GROUP_ID; // The Inner Circle group chat ID

// Debug: log which vars are missing
console.log('ENV CHECK:');
console.log('BOT_TOKEN:', BOT_TOKEN ? '✓ set' : '✗ missing');
console.log('SUPABASE_URL:', SUPABASE_URL ? '✓ set' : '✗ missing');
console.log('SUPABASE_SERVICE_KEY:', SUPABASE_KEY ? '✓ set' : '✗ missing');
console.log('GROUP_ID:', GROUP_ID ? '✓ set' : '✗ missing (optional)');

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing environment variables! Check Railway Variables tab.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper: Get member by telegram ID
async function getMember(telegramId) {
  const { data, error } = await supabase
    .from('inner_circle_members')
    .select('*, inviter:invited_by(telegram_username, telegram_name)')
    .eq('telegram_id', telegramId)
    .single();
  
  if (error && error.code !== 'PGRST116') console.error(error);
  return data;
}

// Helper: Get member by ID
async function getMemberById(id) {
  const { data, error } = await supabase
    .from('inner_circle_members')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) console.error(error);
  return data;
}

// Helper: Validate invite code
async function validateInviteCode(code) {
  const { data, error } = await supabase
    .from('inner_circle_invites')
    .select('*, creator:created_by(telegram_username, telegram_name)')
    .eq('code', code)
    .is('used_by', null)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (error && error.code !== 'PGRST116') console.error(error);
  return data;
}

// Helper: Get circle stats
async function getCircleStats() {
  const { count: totalMembers } = await supabase
    .from('inner_circle_members')
    .select('*', { count: 'exact', head: true });
  
  const { count: foundingMembers } = await supabase
    .from('inner_circle_members')
    .select('*', { count: 'exact', head: true })
    .eq('is_founding_member', true);
  
  return {
    totalMembers: totalMembers || 0,
    foundingMembers: foundingMembers || 0,
    invitedMembers: (totalMembers || 0) - (foundingMembers || 0)
  };
}

// Helper: Get people invited by member
async function getInvitedCount(memberId) {
  const { count } = await supabase
    .from('inner_circle_members')
    .select('*', { count: 'exact', head: true })
    .eq('invited_by', memberId);
  
  return count || 0;
}

// /start command
bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const inviteCode = ctx.startPayload;
  
  // Check if already a member
  const existingMember = await getMember(telegramId);
  
  if (existingMember) {
    const badge = existingMember.is_founding_member ? '★ Founding Member' : 'Member';
    return ctx.reply(
      `Welcome back, ${badge}!\n\n` +
      `🎟️ You have ${existingMember.invites_remaining} invite${existingMember.invites_remaining !== 1 ? 's' : ''} remaining.\n\n` +
      `Commands:\n` +
      `/invite - Generate invite link\n` +
      `/card - Get your member card\n` +
      `/status - View your status`
    );
  }
  
  // No invite code and not a member
  if (!inviteCode) {
    return ctx.reply(
      `👋 The Inner Circle is invite-only.\n\n` +
      `Ask a member for an invite!`
    );
  }
  
  // Validate invite code
  const invite = await validateInviteCode(inviteCode);
  
  if (!invite) {
    return ctx.reply(
      `❌ Invalid or expired invite code.\n\n` +
      `Ask a member for a fresh invite!`
    );
  }
  
  // Create new member
  const { data: newMember, error: memberError } = await supabase
    .from('inner_circle_members')
    .insert({
      telegram_id: telegramId,
      telegram_username: ctx.from.username,
      telegram_name: ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : ''),
      is_founding_member: false,
      invites_remaining: 2,
      invited_by: invite.created_by
    })
    .select()
    .single();
  
  if (memberError) {
    console.error(memberError);
    return ctx.reply('Something went wrong. Try again later.');
  }
  
  // Mark invite as used
  await supabase
    .from('inner_circle_invites')
    .update({ 
      used_by: newMember.id,
      used_at: new Date().toISOString()
    })
    .eq('id', invite.id);
  
  const inviterName = invite.creator?.telegram_username 
    ? `@${invite.creator.telegram_username}` 
    : invite.creator?.telegram_name || 'a member';
  
  return ctx.reply(
    `🎉 Welcome to the Inner Circle!\n\n` +
    `You were invited by ${inviterName}\n\n` +
    `You now have 2 invites to share.\n\n` +
    `Commands:\n` +
    `/invite - Generate invite link\n` +
    `/card - Get your member card\n` +
    `/status - View your status`
  );
});

// /invite command
bot.command('invite', async (ctx) => {
  const member = await getMember(ctx.from.id);
  
  if (!member) {
    return ctx.reply(
      `👋 You're not a member yet.\n\n` +
      `Ask a member for an invite!`
    );
  }
  
  if (member.invites_remaining <= 0) {
    return ctx.reply(`❌ You have no invites remaining.`);
  }
  
  if (!GROUP_ID) {
    return ctx.reply('❌ Group not configured. Ask admin to set GROUP_ID.');
  }
  
  try {
    // Create actual Telegram group invite link
    const expireDate = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
    
    const inviteLink = await ctx.telegram.createChatInviteLink(GROUP_ID, {
      member_limit: 1, // Single use
      expire_date: expireDate,
      name: `Invite by ${ctx.from.first_name}`
    });
    
    // Store in database for tracking
    const code = inviteLink.invite_link.split('/').pop(); // Extract code from link
    
    const { error } = await supabase
      .from('inner_circle_invites')
      .insert({
        code,
        created_by: member.id,
        expires_at: new Date(expireDate * 1000).toISOString()
      });
    
    if (error) {
      console.error('DB error:', error);
      // Continue anyway - link is created
    }
    
    // Decrement invites
    await supabase
      .from('inner_circle_members')
      .update({ invites_remaining: member.invites_remaining - 1 })
      .eq('id', member.id);
    
    return ctx.reply(
      `🎟️ Your Invite Link\n\n` +
      `${inviteLink.invite_link}\n\n` +
      `⏰ Expires in 7 days\n` +
      `👤 Single use - one person only\n` +
      `You have ${member.invites_remaining - 1} invite${member.invites_remaining - 1 !== 1 ? 's' : ''} remaining.`
    );
    
  } catch (error) {
    console.error('Invite creation error:', error);
    return ctx.reply(`❌ Failed to create invite: ${error.message}\n\nMake sure bot is admin in the group with invite permissions.`);
  }
});

// /status command
bot.command('status', async (ctx) => {
  const member = await getMember(ctx.from.id);
  
  if (!member) {
    return ctx.reply(
      `👋 You're not a member yet.\n\n` +
      `Ask a member for an invite!`
    );
  }
  
  const stats = await getCircleStats();
  const invitedCount = await getInvitedCount(member.id);
  const joinDate = new Date(member.joined_at).toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });
  const badge = member.is_founding_member ? '★ Founding Member' : 'Member';
  
  return ctx.reply(
    `📊 Your Status\n\n` +
    `${badge}\n` +
    `Joined: ${joinDate}\n` +
    `Invites remaining: ${member.invites_remaining}\n` +
    `People you've invited: ${invitedCount}\n\n` +
    `📈 Circle Stats\n` +
    `Total members: ${stats.totalMembers}\n` +
    `Founding members: ${stats.foundingMembers}\n` +
    `Invited members: ${stats.invitedMembers}`
  );
});

// /card command
bot.command('card', async (ctx) => {
  const member = await getMember(ctx.from.id);
  
  if (!member) {
    return ctx.reply(
      `👋 You're not a member yet.\n\n` +
      `Ask a member for an invite!`
    );
  }
  
  try {
    // Get profile photos
    const photos = await ctx.telegram.getUserProfilePhotos(ctx.from.id, 0, 1);
    
    // Create canvas
    const width = 400;
    const height = 500;
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    
    // Background gradient
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    
    // Border
    context.strokeStyle = '#e94560';
    context.lineWidth = 3;
    context.strokeRect(10, 10, width - 20, height - 20);
    
    // Profile photo circle
    const photoSize = 120;
    const photoX = width / 2;
    const photoY = 100;
    
    context.beginPath();
    context.arc(photoX, photoY, photoSize / 2 + 3, 0, Math.PI * 2);
    context.strokeStyle = '#e94560';
    context.lineWidth = 3;
    context.stroke();
    
    // Try to load profile photo
    if (photos.total_count > 0) {
      const fileId = photos.photos[0][0].file_id;
      const file = await ctx.telegram.getFile(fileId);
      const photoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
      
      try {
        const profileImg = await loadImage(photoUrl);
        context.save();
        context.beginPath();
        context.arc(photoX, photoY, photoSize / 2, 0, Math.PI * 2);
        context.clip();
        context.drawImage(profileImg, photoX - photoSize / 2, photoY - photoSize / 2, photoSize, photoSize);
        context.restore();
      } catch (e) {
        // Draw placeholder
        context.beginPath();
        context.arc(photoX, photoY, photoSize / 2, 0, Math.PI * 2);
        context.fillStyle = '#0f3460';
        context.fill();
      }
    } else {
      // Draw placeholder
      context.beginPath();
      context.arc(photoX, photoY, photoSize / 2, 0, Math.PI * 2);
      context.fillStyle = '#0f3460';
      context.fill();
    }
    
    // Name
    const name = member.telegram_name || ctx.from.first_name || 'Member';
    context.font = 'bold 28px Roboto';
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.fillText(name, width / 2, 200);
    
    // Badge
    const badge = member.is_founding_member ? '★ Founding Member' : 'Member';
    context.font = '20px Roboto';
    context.fillStyle = member.is_founding_member ? '#ffd700' : '#e94560';
    context.fillText(badge, width / 2, 235);
    
    // Join date
    const joinDate = new Date(member.joined_at).toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
    context.font = '16px Roboto';
    context.fillStyle = '#a0a0a0';
    context.fillText(`Member since ${joinDate}`, width / 2, 280);
    
    // Divider
    context.beginPath();
    context.moveTo(50, 320);
    context.lineTo(width - 50, 320);
    context.strokeStyle = '#e94560';
    context.lineWidth = 1;
    context.stroke();
    
    // CTA text
    context.font = 'italic 18px Roboto';
    context.fillStyle = '#ffffff';
    context.fillText('"Want in? Ask me for', width / 2, 370);
    context.fillText('an invite"', width / 2, 395);
    
    // Inner Circle branding
    context.font = 'bold 14px Roboto';
    context.fillStyle = '#e94560';
    context.fillText('INNER CIRCLE', width / 2, 460);
    
    // Send as photo
    const buffer = canvas.toBuffer('image/png');
    await ctx.replyWithPhoto({ source: buffer });
    
  } catch (error) {
    console.error('Card generation error:', error);
    return ctx.reply('Failed to generate card. Try again later.');
  }
});

// /seed command (admin only - for seeding founding members)
bot.command('seed', async (ctx) => {
  // Only allow from specific admin
  const ADMIN_ID = 937787970; // Bhavya's ID
  
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply('Admin only command.');
  }
  
  const telegramId = ctx.from.id;
  const existing = await getMember(telegramId);
  
  if (existing) {
    return ctx.reply('You are already a member!');
  }
  
  const { error } = await supabase
    .from('inner_circle_members')
    .insert({
      telegram_id: telegramId,
      telegram_username: ctx.from.username,
      telegram_name: ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : ''),
      is_founding_member: true,
      invites_remaining: 2,
      badge: 'Founding Member'
    });
  
  if (error) {
    console.error(error);
    return ctx.reply('Failed to seed: ' + error.message);
  }
  
  return ctx.reply('✅ Seeded as Founding Member!');
});

// /seedmember command (admin only - for adding other founding members)
bot.command('seedmember', async (ctx) => {
  const ADMIN_ID = 937787970;
  
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply('Admin only command.');
  }
  
  // Usage: /seedmember <telegram_id> <username> <name>
  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length < 1) {
    return ctx.reply('Usage: /seedmember <telegram_id> [username] [name]');
  }
  
  const telegramId = parseInt(args[0]);
  const username = args[1] || null;
  const name = args.slice(2).join(' ') || 'Founding Member';
  
  if (isNaN(telegramId)) {
    return ctx.reply('Invalid telegram ID');
  }
  
  const existing = await getMember(telegramId);
  if (existing) {
    return ctx.reply('That user is already a member!');
  }
  
  const { error } = await supabase
    .from('inner_circle_members')
    .insert({
      telegram_id: telegramId,
      telegram_username: username,
      telegram_name: name,
      is_founding_member: true,
      invites_remaining: 2,
      badge: 'Founding Member'
    });
  
  if (error) {
    console.error(error);
    return ctx.reply('Failed to seed: ' + error.message);
  }
  
  return ctx.reply(`✅ Seeded ${name} as Founding Member!`);
});

// /seedgroup command (admin only - seeds all members from current group as founding members)
bot.command('seedgroup', async (ctx) => {
  const ADMIN_ID = 937787970;
  
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply('Admin only command.');
  }
  
  // Must be used in a group
  if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
    return ctx.reply('This command must be used in a group.');
  }
  
  await ctx.reply('🔄 Scanning group members...');
  
  try {
    // Get chat administrators (includes all members in small groups)
    const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
    
    let seeded = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const admin of admins) {
      const user = admin.user;
      
      // Skip bots
      if (user.is_bot) {
        skipped++;
        continue;
      }
      
      // Check if already a member
      const existing = await getMember(user.id);
      if (existing) {
        skipped++;
        continue;
      }
      
      // Seed as founding member
      const { error } = await supabase
        .from('inner_circle_members')
        .insert({
          telegram_id: user.id,
          telegram_username: user.username || null,
          telegram_name: user.first_name + (user.last_name ? ' ' + user.last_name : ''),
          is_founding_member: true,
          invites_remaining: 2,
          badge: 'Founding Member'
        });
      
      if (error) {
        console.error(`Failed to seed ${user.id}:`, error);
        failed++;
      } else {
        seeded++;
      }
    }
    
    // For supergroups, try to get more members using getChatMembersCount
    const memberCount = await ctx.telegram.getChatMembersCount(ctx.chat.id);
    
    return ctx.reply(
      `✅ Group seeding complete!\n\n` +
      `👥 Group has ${memberCount} total members\n` +
      `✅ Seeded: ${seeded} founding members\n` +
      `⏭️ Skipped: ${skipped} (already members or bots)\n` +
      `❌ Failed: ${failed}\n\n` +
      `Note: Only admins/visible members could be seeded. ` +
      `Regular members should DM the bot - they'll be recognized when they interact.`
    );
    
  } catch (error) {
    console.error('Seedgroup error:', error);
    return ctx.reply(`❌ Error: ${error.message}`);
  }
});

// /seedchat command - alternative that tries to catch members as they interact
bot.on('message', async (ctx, next) => {
  // Only in groups
  if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
    return next();
  }
  
  // Check if this is a group we're tracking (you could add a config for this)
  // For now, auto-register anyone who messages in a group where bot is present
  // as a founding member (if not already registered)
  
  const user = ctx.from;
  if (user.is_bot) return next();
  
  const existing = await getMember(user.id);
  if (existing) return next();
  
  // Check if we should auto-seed (only if seedgroup was run in this chat)
  // For safety, we'll skip auto-seeding - users need to DM bot or be explicitly seeded
  
  return next();
});

// Track new members joining the group
bot.on('chat_member', async (ctx) => {
  try {
    // Only handle joins to our group
    if (!GROUP_ID || ctx.chat.id.toString() !== GROUP_ID.toString()) return;
    
    const update = ctx.chatMember;
    const newStatus = update.new_chat_member.status;
    const oldStatus = update.old_chat_member.status;
    
    // Check if someone just joined (wasn't a member, now is)
    const wasNotMember = ['left', 'kicked', 'restricted'].includes(oldStatus) || oldStatus === undefined;
    const isNowMember = ['member', 'administrator', 'creator'].includes(newStatus);
    
    if (wasNotMember && isNowMember) {
      const user = update.new_chat_member.user;
      if (user.is_bot) return;
      
      // Check if already registered
      const existing = await getMember(user.id);
      if (existing) return;
      
      // Try to find who invited them (by invite link)
      const inviteLink = update.invite_link;
      let invitedBy = null;
      
      if (inviteLink) {
        const code = inviteLink.invite_link.split('/').pop();
        const { data: invite } = await supabase
          .from('inner_circle_invites')
          .select('created_by')
          .eq('code', code)
          .single();
        
        if (invite) {
          invitedBy = invite.created_by;
          
          // Mark invite as used
          await supabase
            .from('inner_circle_invites')
            .update({ used_at: new Date().toISOString() })
            .eq('code', code);
        }
      }
      
      // Register the new member
      await supabase
        .from('inner_circle_members')
        .insert({
          telegram_id: user.id,
          telegram_username: user.username || null,
          telegram_name: user.first_name + (user.last_name ? ' ' + user.last_name : ''),
          is_founding_member: false,
          invites_remaining: 2,
          invited_by: invitedBy
        });
      
      console.log(`New member joined: ${user.first_name} (${user.id})`);
    }
  } catch (error) {
    console.error('chat_member handler error:', error);
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
});

// Launch
bot.launch()
  .then(() => console.log('🚀 Inner Circle Bot is running!'))
  .catch(err => console.error('Failed to start:', err));

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
