require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const db = require('./db');
const { generateMemberCard } = require('./card-v2');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Start command - entry point
bot.start(async (ctx) => {
    const startPayload = ctx.startPayload; // Invite code or command redirect
    const telegramId = ctx.from.id;
    
    // Handle command redirects from group (card/invite/status buttons)
    if (startPayload === 'card') {
        await ctx.reply('Use /card to get your member card!');
        return;
    }
    if (startPayload === 'invite') {
        await ctx.reply('Use /invite to create an invite link!');
        return;
    }
    if (startPayload === 'status') {
        await ctx.reply('Use /status to check your status!');
        return;
    }
    
    try {
        // Check if already a member
        let member = await db.getMemberByTelegramId(telegramId);
        
        if (member) {
            await ctx.replyWithMarkdown(
                `Welcome to the Inner Circle, ${ctx.from.first_name}!\n\n` +
                `You have ${member.invites_remaining} unique invite codes to bring in folks to the Inner Circle.\n\n` +
                `Send the bot:\n` +
                `[/card](tg://bot_command?command=card) - To get your unique founding member card!\n` +
                `[/invite](tg://bot_command?command=invite) - To create the invite link\n` +
                `[/status](tg://bot_command?command=status) - To check status of the invite.`
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
                `You were invited by ${inviter.telegram_name || inviter.telegram_username}.\n\n` +
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

// Inner Circle Group ID
const INNER_CIRCLE_GROUP_ID = -1001613656434;

// Generate invite
bot.command('invite', async (ctx) => {
    // Only work in DMs
    if (ctx.chat.type !== 'private') {
        await ctx.reply('👉 DM me to create invite links!', {
            reply_markup: {
                inline_keyboard: [[
                    { text: 'Create Invite', url: `https://t.me/${ctx.botInfo.username}?start=invite` }
                ]]
            }
        });
        return;
    }
    
    const telegramId = ctx.from.id;
    console.log(`[INVITE] Request from ${ctx.from.first_name} (${telegramId})`);
    
    try {
        const member = await db.getMemberByTelegramId(telegramId);
        console.log(`[INVITE] Member lookup result:`, member ? `found (${member.id})` : 'NOT FOUND');
        
        if (!member) {
            await ctx.reply('❌ You need to be a member to create invites.');
            return;
        }
        
        if (member.invites_remaining <= 0) {
            await ctx.reply('❌ You have no invites remaining.');
            return;
        }
        
        // Create a real group invite link
        const expireDate = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 days
        const inviterName = member.telegram_name || member.telegram_username || `User ${telegramId}`;
        
        const inviteLink = await ctx.telegram.createChatInviteLink(INNER_CIRCLE_GROUP_ID, {
            expire_date: expireDate,
            member_limit: 1, // Single use
            name: `Invite by ${inviterName}` // For tracking in Telegram admin panel
        });
        
        // Track in our DB - store the actual invite link for matching when someone joins
        await db.createInvite(member.id, inviteLink.invite_link);
        await db.decrementInvites(member.id);
        
        const remainingInvites = member.invites_remaining - 1;
        const invitesText = remainingInvites > 0 
            ? `Want to invite more folks? We have ${remainingInvites} more invite code${remainingInvites > 1 ? 's' : ''} for you, prompt the bot again.`
            : `That was your last invite code. Use it wisely!`;
        
        const message = `🎟️ Your Invite code, use it wisely!\n\n` +
            `${inviteLink.invite_link}\n\n` +
            `Share this link with someone you think is worth adding to the Inner Circle, wink wink.\n\n` +
            `Act quick the code expires in 7 days.\n\n` +
            `${invitesText}`;
        
        await ctx.reply(message);
        
    } catch (error) {
        console.error('Invite error:', error);
        if (error.message?.includes('not enough rights')) {
            await ctx.reply('❌ Bot needs admin permissions in the group to create invite links.');
        } else {
            await ctx.reply('Something went wrong. Please try again.');
        }
    }
});

// Generate member card (once per member)
bot.command('card', async (ctx) => {
    // Only work in DMs
    if (ctx.chat.type !== 'private') {
        await ctx.reply('👉 DM me to get your card!', {
            reply_markup: {
                inline_keyboard: [[
                    { text: 'Get My Card', url: `https://t.me/${ctx.botInfo.username}?start=card` }
                ]]
            }
        });
        return;
    }
    
    const telegramId = ctx.from.id;
    console.log(`[CARD] Request from ${ctx.from.first_name} (${telegramId})`);
    
    try {
        const member = await db.getMemberByTelegramId(telegramId);
        console.log(`[CARD] Member lookup result:`, member ? `found (${member.id})` : 'NOT FOUND');
        
        if (!member) {
            await ctx.reply('❌ You need to be a member to get a card.');
            return;
        }
        
        // Check if card already generated
        if (member.card_generated) {
            await ctx.reply('We know you have your founding member card already, stop procrastinating and share it on socials. We are waiting to like that post. 👀');
            return;
        }
        
        await ctx.reply('You have always been part of the Inner Circle, here\'s your founding member card ✨');
        
        // Get inviter name if not a founding member
        let inviterName = null;
        if (!member.is_founding_member && member.invited_by) {
            const inviter = await db.getMemberById(member.invited_by);
            if (inviter) {
                inviterName = inviter.telegram_name || inviter.telegram_username || 'Someone';
            }
        }
        
        const cardBuffer = await generateMemberCard(bot, member, inviterName);
        
        // Mark card as generated
        await db.markCardGenerated(member.id);
        
        const caption = `✨ Your Inner Circle member card

By the power vested in us by FBI, we now give you the right to bring in your trusted folks into the Inner Circle.

If FBI lived up to the expectations and made your life good, Inner Circle will only make it better.

Share this card on socials and make sure to share a little about your journey alongside. Use your invite links wisely.

Love,
Core FBI
Now, call us Inner Circle.`;
        
        await ctx.replyWithPhoto(
            { source: cardBuffer },
            { caption }
        );
        
    } catch (error) {
        console.error('Card error:', error);
        await ctx.reply('Something went wrong generating your card. Please try again.');
    }
});

// Check status
bot.command('status', async (ctx) => {
    // Only work in DMs
    if (ctx.chat.type !== 'private') {
        await ctx.reply('👉 DM me to check your status!', {
            reply_markup: {
                inline_keyboard: [[
                    { text: 'Check Status', url: `https://t.me/${ctx.botInfo.username}?start=status` }
                ]]
            }
        });
        return;
    }
    
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

// Track when someone joins via an invite link
bot.on('chat_member', async (ctx) => {
    try {
        const update = ctx.chatMember;
        
        // Only care about new members joining
        if (update.new_chat_member.status !== 'member') return;
        if (update.old_chat_member.status === 'member') return; // Already was a member
        
        const newUser = update.new_chat_member.user;
        const inviteLink = update.invite_link;
        
        // Check if they joined via an invite link we created
        if (inviteLink && inviteLink.invite_link) {
            console.log(`[JOIN] ${newUser.first_name} (${newUser.id}) joined via invite: ${inviteLink.invite_link}`);
            
            // Find the invite in our DB
            const invite = await db.getInviteByLink(inviteLink.invite_link);
            
            if (invite) {
                console.log(`[JOIN] Found matching invite from member ${invite.created_by}`);
                
                // Get or create the new member
                let member = await db.getMemberByTelegramId(newUser.id);
                
                if (!member) {
                    // Create new member as invited (not founding)
                    member = await db.createMember({
                        telegramId: newUser.id,
                        username: newUser.username,
                        firstName: newUser.first_name,
                        lastName: newUser.last_name,
                        isFoundingMember: false,
                        invitedById: invite.created_by
                    });
                    console.log(`[JOIN] Created new member ${member.id} invited by ${invite.created_by}`);
                } else {
                    // Update existing member's invited_by
                    await db.updateMemberInvitedBy(member.id, invite.created_by);
                    console.log(`[JOIN] Updated member ${member.id} invited by ${invite.created_by}`);
                }
                
                // Mark invite as used
                await db.markInviteUsed(invite.id, member.id);
                console.log(`[JOIN] Marked invite ${invite.id} as used`);
            } else {
                console.log(`[JOIN] No matching invite found in DB for link`);
            }
        } else {
            console.log(`[JOIN] ${newUser.first_name} (${newUser.id}) joined (no invite link tracked)`);
        }
    } catch (error) {
        console.error('[JOIN] Error tracking invite:', error.message);
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
        
        console.log(`✨ Auto-seeded new member: ${ctx.from.first_name} (@${ctx.from.username || 'no-username'})`);
        
    } catch (error) {
        console.error('Auto-seed error:', error.message);
    }
    
    return next();
});

// Error handling
bot.catch((err, ctx) => {
    console.error('Bot error:', err);
});

// Start bot with chat_member updates enabled
bot.launch({
    allowedUpdates: ['message', 'callback_query', 'chat_member']
}).then(() => {
    console.log('🚀 Inner Circle Bot is running!');
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
