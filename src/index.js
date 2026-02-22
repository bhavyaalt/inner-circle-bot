require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const db = require('./db');
const { generateMemberCard } = require('./card-v2');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Start command - entry point
bot.start(async (ctx) => {
    const startPayload = ctx.startPayload; // Invite code if coming from invite link
    const telegramId = ctx.from.id;
    
    try {
        // Check if already a member
        let member = await db.getMemberByTelegramId(telegramId);
        
        if (member) {
            await ctx.reply(
                `Welcome back to the Inner Circle, ${ctx.from.first_name}! 🎖️\n\n` +
                `You have ${member.invites_remaining} invite(s) remaining.\n\n` +
                `Commands:\n` +
                `/card - Get your member card\n` +
                `/invite - Create an invite link\n` +
                `/status - Check your status`
            );
            return;
        }
        
        // Not a member - check for invite code
        if (startPayload) {
            const invite = await db.getInviteByCode(startPayload);
            
            if (!invite) {
                await ctx.reply('❌ Invalid invite code. Ask a member for a valid invite!');
                return;
            }
            
            if (invite.used_by) {
                await ctx.reply('❌ This invite has already been used.');
                return;
            }
            
            if (new Date(invite.expires_at) < new Date()) {
                await ctx.reply('❌ This invite has expired. Ask for a new one!');
                return;
            }
            
            // Valid invite - create member
            const inviter = await db.getMemberById(invite.created_by);
            
            member = await db.createMember({
                telegramId,
                username: ctx.from.username,
                firstName: ctx.from.first_name,
                lastName: ctx.from.last_name,
                isFoundingMember: false,
                invitedById: invite.created_by
            });
            
            await db.markInviteUsed(invite.id, member.id);
            
            await ctx.reply(
                `🎉 Welcome to the Inner Circle, ${ctx.from.first_name}!\n\n` +
                `You were invited by ${inviter.first_name || inviter.username}.\n\n` +
                `You now have ${member.invites_remaining} invites to share.\n\n` +
                `Commands:\n` +
                `/card - Get your member card\n` +
                `/invite - Create an invite link\n` +
                `/status - Check your status`
            );
            return;
        }
        
        // No invite code
        await ctx.reply(
            `👋 Hey ${ctx.from.first_name}!\n\n` +
            `The Inner Circle is invite-only.\n` +
            `Ask a member for an invite to join!`
        );
        
    } catch (error) {
        console.error('Start error:', error);
        await ctx.reply('Something went wrong. Please try again.');
    }
});

// Generate invite
bot.command('invite', async (ctx) => {
    const telegramId = ctx.from.id;
    
    try {
        const member = await db.getMemberByTelegramId(telegramId);
        
        if (!member) {
            await ctx.reply('❌ You need to be a member to create invites.');
            return;
        }
        
        if (member.invites_remaining <= 0) {
            await ctx.reply('❌ You have no invites remaining.');
            return;
        }
        
        // Get optional target username from args
        const args = ctx.message.text.split(' ').slice(1);
        const targetUsername = args[0]?.replace('@', '') || null;
        
        // Create invite
        const invite = await db.createInvite(member.id, targetUsername);
        await db.decrementInvites(member.id);
        
        const botUsername = ctx.botInfo.username;
        const inviteLink = `https://t.me/${botUsername}?start=${invite.code}`;
        
        let message = `🎟️ **Your Invite Link**\n\n` +
            `\`${inviteLink}\`\n\n` +
            `Share this link with someone to invite them.\n` +
            `⏰ Expires in 7 days\n\n` +
            `You have ${member.invites_remaining - 1} invite(s) remaining.`;
        
        if (targetUsername) {
            message = `🎟️ **Invite for @${targetUsername}**\n\n` +
                `\`${inviteLink}\`\n\n` +
                `Share this with @${targetUsername}\n` +
                `⏰ Expires in 7 days\n\n` +
                `You have ${member.invites_remaining - 1} invite(s) remaining.`;
        }
        
        await ctx.replyWithMarkdown(message);
        
    } catch (error) {
        console.error('Invite error:', error);
        await ctx.reply('Something went wrong. Please try again.');
    }
});

// Generate member card
bot.command('card', async (ctx) => {
    const telegramId = ctx.from.id;
    
    try {
        const member = await db.getMemberByTelegramId(telegramId);
        
        if (!member) {
            await ctx.reply('❌ You need to be a member to get a card.');
            return;
        }
        
        await ctx.reply('🎨 Generating your card...');
        
        // Get inviter name if not a founding member
        let inviterName = null;
        if (!member.is_founding_member && member.invited_by) {
            const inviter = await db.getMemberById(member.invited_by);
            if (inviter) {
                inviterName = inviter.telegram_name || inviter.telegram_username || inviter.first_name || 'Someone';
            }
        }
        
        const cardBuffer = await generateMemberCard(bot, member, inviterName);
        
        await ctx.replyWithPhoto(
            { source: cardBuffer },
            { caption: '✨ Your Inner Circle member card' }
        );
        
    } catch (error) {
        console.error('Card error:', error);
        await ctx.reply('Something went wrong generating your card. Please try again.');
    }
});

// Check status
bot.command('status', async (ctx) => {
    const telegramId = ctx.from.id;
    
    try {
        const member = await db.getMemberByTelegramId(telegramId);
        
        if (!member) {
            await ctx.reply('❌ You are not a member of the Inner Circle.');
            return;
        }
        
        const stats = await db.getMemberStats();
        const invites = await db.getInvitesByMember(member.id);
        const usedInvites = invites.filter(i => i.used_by).length;
        
        const joinDate = new Date(member.joined_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        let status = `📊 **Your Status**\n\n`;
        status += `${member.is_founding_member ? '★ Founding Member' : 'Member'}\n`;
        status += `Joined: ${joinDate}\n`;
        status += `Invites remaining: ${member.invites_remaining}\n`;
        status += `People you've invited: ${usedInvites}\n\n`;
        status += `📈 **Circle Stats**\n`;
        status += `Total members: ${stats.total}\n`;
        status += `Founding members: ${stats.founding}\n`;
        status += `Invited members: ${stats.invited}`;
        
        await ctx.replyWithMarkdown(status);
        
    } catch (error) {
        console.error('Status error:', error);
        await ctx.reply('Something went wrong. Please try again.');
    }
});

// Help command
bot.help((ctx) => {
    ctx.reply(
        `🎖️ **Inner Circle Bot**\n\n` +
        `Commands:\n` +
        `/start - Join with invite or check status\n` +
        `/card - Get your shareable member card\n` +
        `/invite [@username] - Create an invite link\n` +
        `/status - View your stats\n` +
        `/help - Show this message`,
        { parse_mode: 'Markdown' }
    );
});

// Seed group command (admin only, run in a group)
bot.command('seedgroup', async (ctx) => {
    // Must be in a group
    if (ctx.chat.type === 'private') {
        await ctx.reply('❌ Run this command in a group chat.');
        return;
    }
    
    try {
        // Check if user is admin
        const chatMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
        if (!['creator', 'administrator'].includes(chatMember.status)) {
            await ctx.reply('❌ Only admins can seed groups.');
            return;
        }
        
        // Get or create member record for the admin
        let admin = await db.getMemberByTelegramId(ctx.from.id);
        if (!admin) {
            admin = await db.createMember({
                telegramId: ctx.from.id,
                username: ctx.from.username,
                firstName: ctx.from.first_name,
                lastName: ctx.from.last_name,
                isFoundingMember: true
            });
        }
        
        // Mark this group as seeded
        await db.addSeededGroup(ctx.chat.id, ctx.chat.title, admin.id);
        
        // Seed all admins immediately
        const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
        let seeded = 0;
        
        for (const adminMember of admins) {
            if (adminMember.user.is_bot) continue;
            
            try {
                await db.upsertMember({
                    telegramId: adminMember.user.id,
                    username: adminMember.user.username,
                    firstName: adminMember.user.first_name,
                    lastName: adminMember.user.last_name,
                    isFoundingMember: true
                });
                seeded++;
            } catch (e) {
                console.error('Failed to seed admin:', e.message);
            }
        }
        
        await ctx.reply(
            `✅ Group seeded!\n\n` +
            `• ${seeded} admin(s) added as founding members\n` +
            `• Regular members will be auto-added when they send a message\n\n` +
            `Members can now DM the bot to get their card!`
        );
        
    } catch (error) {
        console.error('Seedgroup error:', error);
        await ctx.reply('Something went wrong. Please try again.');
    }
});

// Auto-seed members when they message in a seeded group
bot.on('message', async (ctx, next) => {
    // Skip private chats and bot messages
    if (ctx.chat.type === 'private' || ctx.from.is_bot) {
        return next();
    }
    
    try {
        // Check if this is a seeded group
        const isSeeded = await db.isSeededGroup(ctx.chat.id);
        if (!isSeeded) {
            return next();
        }
        
        // Check if user is already a member
        const existing = await db.getMemberByTelegramId(ctx.from.id);
        if (existing) {
            return next();
        }
        
        // Auto-add them as a founding member
        await db.upsertMember({
            telegramId: ctx.from.id,
            username: ctx.from.username,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name,
            isFoundingMember: true
        });
        
        console.log(`Auto-seeded member: ${ctx.from.first_name} (${ctx.from.id})`);
        
    } catch (error) {
        console.error('Auto-seed error:', error.message);
    }
    
    return next();
});

// Error handling
bot.catch((err, ctx) => {
    console.error('Bot error:', err);
});

// Start bot
bot.launch().then(() => {
    console.log('🚀 Inner Circle Bot is running!');
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
