const { createCanvas, loadImage, registerFont } = require('canvas');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Card dimensions
const WIDTH = 800;
const HEIGHT = 420;

// Colors
const COLORS = {
    background: '#0f0f0f',
    cardBg: '#1a1a2e',
    primary: '#eab308',      // Gold
    secondary: '#fbbf24',    // Lighter gold
    text: '#ffffff',
    textMuted: '#9ca3af',
    founding: '#f59e0b',     // Badge color
    accent: '#16213e'
};

async function downloadImage(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadImage(response.headers.location).then(resolve).catch(reject);
            }
            
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        }).on('error', reject);
    });
}

async function getProfilePhoto(bot, userId) {
    try {
        const photos = await bot.telegram.getUserProfilePhotos(userId, 0, 1);
        if (photos.total_count > 0) {
            const fileId = photos.photos[0][photos.photos[0].length - 1].file_id;
            const file = await bot.telegram.getFile(fileId);
            const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
            const buffer = await downloadImage(url);
            return await loadImage(buffer);
        }
    } catch (e) {
        console.error('Failed to get profile photo:', e.message);
    }
    return null;
}

function formatMemberSince(joinedAt) {
    const joined = new Date(joinedAt);
    const now = new Date();
    const diffMs = now - joined;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day';
    if (diffDays < 30) return `${diffDays} days`;
    if (diffDays < 60) return '1 month';
    const months = Math.floor(diffDays / 30);
    return `${months} months`;
}

async function generateMemberCard(bot, member) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    gradient.addColorStop(0, COLORS.background);
    gradient.addColorStop(1, COLORS.accent);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Card background with rounded corners
    const cardX = 30;
    const cardY = 30;
    const cardW = WIDTH - 60;
    const cardH = HEIGHT - 60;
    const radius = 20;
    
    ctx.beginPath();
    ctx.moveTo(cardX + radius, cardY);
    ctx.lineTo(cardX + cardW - radius, cardY);
    ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius);
    ctx.lineTo(cardX + cardW, cardY + cardH - radius);
    ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - radius, cardY + cardH);
    ctx.lineTo(cardX + radius, cardY + cardH);
    ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius);
    ctx.lineTo(cardX, cardY + radius);
    ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY);
    ctx.closePath();
    
    ctx.fillStyle = COLORS.cardBg;
    ctx.fill();
    
    // Gold border
    ctx.strokeStyle = COLORS.primary;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Profile photo (circular)
    const photoX = 100;
    const photoY = HEIGHT / 2;
    const photoRadius = 80;
    
    // Photo circle background
    ctx.beginPath();
    ctx.arc(photoX, photoY, photoRadius + 4, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.primary;
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(photoX, photoY, photoRadius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.cardBg;
    ctx.fill();
    
    // Try to load profile photo
    const profilePhoto = await getProfilePhoto(bot, member.telegram_id);
    if (profilePhoto) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(photoX, photoY, photoRadius - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(profilePhoto, photoX - photoRadius + 2, photoY - photoRadius + 2, (photoRadius - 2) * 2, (photoRadius - 2) * 2);
        ctx.restore();
    } else {
        // Placeholder initials
        ctx.fillStyle = COLORS.primary;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initials = (member.first_name?.[0] || '') + (member.last_name?.[0] || '');
        ctx.fillText(initials.toUpperCase() || '?', photoX, photoY);
    }
    
    // Text content
    const textX = 220;
    
    // Name
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const displayName = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username || 'Member';
    ctx.fillText(displayName, textX, 80);
    
    // Username if different from name
    if (member.username) {
        ctx.fillStyle = COLORS.textMuted;
        ctx.font = '20px Arial';
        ctx.fillText(`@${member.username}`, textX, 125);
    }
    
    // "INNER CIRCLE" badge
    ctx.fillStyle = COLORS.primary;
    ctx.font = 'bold 28px Arial';
    ctx.fillText('INNER CIRCLE', textX, 175);
    
    // Member badge line
    ctx.fillStyle = COLORS.secondary;
    ctx.font = '18px Arial';
    const memberType = member.is_founding_member ? '★ FOUNDING MEMBER' : 'MEMBER';
    ctx.fillText(memberType, textX, 215);
    
    // Member since
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = '18px Arial';
    const memberSince = formatMemberSince(member.joined_at);
    ctx.fillText(`Member for ${memberSince}`, textX, 250);
    
    // Invites remaining
    ctx.fillStyle = COLORS.text;
    ctx.font = '16px Arial';
    ctx.fillText(`${member.invites_remaining} invites remaining`, textX, 290);
    
    // CTA at bottom
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = 'italic 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Want in? Ask me for an invite.', WIDTH / 2, HEIGHT - 55);
    
    // Small decorative line
    ctx.strokeStyle = COLORS.primary;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2 - 100, HEIGHT - 75);
    ctx.lineTo(WIDTH / 2 + 100, HEIGHT - 75);
    ctx.stroke();
    
    return canvas.toBuffer('image/png');
}

module.exports = { generateMemberCard };
