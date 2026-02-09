require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const db = require('./db');
const { generateMemberCard } = require('./card');

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
        
        const cardBuffer = await generateMemberCard(bot, member);
        
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
