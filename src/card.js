const { createCanvas, loadImage } = require('canvas');
const https = require('https');
const http = require('http');
const path = require('path');

// Card dimensions - matching the background
const WIDTH = 1024;
const HEIGHT = 768;

// Colors
const COLORS = {
    white: '#FFFFFF',
    red: '#FF3500',
    gray: '#888888',
    pink: '#FF9FC2'
};

// Background image path
const BACKGROUND_PATH = path.join(__dirname, 'assets', 'card-background.png');

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

function formatDate(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date(date);
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

async function generateMemberCard(bot, member) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Load and draw background
    try {
        const background = await loadImage(BACKGROUND_PATH);
        ctx.drawImage(background, 0, 0, WIDTH, HEIGHT);
    } catch (e) {
        console.error('Failed to load background:', e.message);
        // Fallback to black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    
    // Profile photo area - centered
    const photoX = WIDTH / 2;
    const photoY = 200;
    const photoRadius = 100;
    
    // Profile photo border (pink)
    ctx.beginPath();
    ctx.arc(photoX, photoY, photoRadius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.pink;
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Profile photo background
    ctx.beginPath();
    ctx.arc(photoX, photoY, photoRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    
    // Try to load profile photo
    const profilePhoto = await getProfilePhoto(bot, member.telegram_id);
    if (profilePhoto) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(photoX, photoY, photoRadius - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(profilePhoto, 
            photoX - photoRadius + 2, 
            photoY - photoRadius + 2, 
            (photoRadius - 2) * 2, 
            (photoRadius - 2) * 2
        );
        ctx.restore();
    } else {
        // Placeholder initials
        ctx.fillStyle = COLORS.pink;
        ctx.font = 'bold 72px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initials = (member.first_name?.[0] || '') + (member.last_name?.[0] || '');
        ctx.fillText(initials.toUpperCase() || '?', photoX, photoY);
    }
    
    // Name
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const displayName = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username || 'Member';
    ctx.fillText(displayName, WIDTH / 2, 330);
    
    // Member type (Founding Member / Member)
    ctx.fillStyle = COLORS.red;
    ctx.font = '28px Arial, sans-serif';
    const memberType = member.is_founding_member ? 'Founding Member' : 'Member';
    ctx.fillText(memberType, WIDTH / 2, 395);
    
    // Member since date
    ctx.fillStyle = COLORS.gray;
    ctx.font = '22px Arial, sans-serif';
    const memberSince = formatDate(member.joined_at);
    ctx.fillText(memberSince, WIDTH / 2, 440);
    
    return canvas.toBuffer('image/png');
}

module.exports = { generateMemberCard };
