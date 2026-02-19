const { createCanvas, loadImage } = require('canvas');
const https = require('https');
const http = require('http');

// Card dimensions - matching the SVG design
const WIDTH = 1024;
const HEIGHT = 768;

// Colors from the SVG design
const COLORS = {
    background: '#000000',
    neonGreen: '#BCFF00',
    blue: '#0052FF',
    pink: '#FF9FC2',
    red: '#FF3500',
    peach: '#FFA38B',
    white: '#FFFFFF',
    gray: '#7C7B7B',
    darkGray: '#5A5959'
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

// Draw a star shape
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
}

// Draw starburst decoration in corners
function drawStarburst(ctx, x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    
    // Main burst lines
    for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 / 8) * i);
        
        ctx.strokeStyle = COLORS.neonGreen;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(0, -100);
        ctx.stroke();
        
        ctx.restore();
    }
    
    // Additional diagonal lines
    for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((Math.PI * 2 / 8) * i + Math.PI / 16);
        
        ctx.strokeStyle = COLORS.neonGreen;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(0, -60);
        ctx.stroke();
        
        ctx.restore();
    }
    
    ctx.restore();
}

// Draw concentric circles (bottom decoration)
function drawConcentricCircles(ctx, x, y, maxRadius) {
    // Outer circle
    ctx.beginPath();
    ctx.arc(x, y, maxRadius, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Middle circle
    ctx.beginPath();
    ctx.arc(x, y, maxRadius * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    
    // Inner circle
    ctx.beginPath();
    ctx.arc(x, y, maxRadius * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    
    // Center dot
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.red;
    ctx.fill();
}

// Draw member badge (star shape like in SVG)
function drawMemberBadge(ctx, x, y, radius, isFounding) {
    ctx.save();
    ctx.translate(x, y);
    
    // Pink badge background
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.pink;
    ctx.fill();
    
    // Star cutout/overlay
    ctx.fillStyle = isFounding ? COLORS.peach : COLORS.white;
    drawStar(ctx, 0, 0, 5, radius * 0.6, radius * 0.25);
    ctx.fill();
    
    ctx.restore();
}

// Draw blue decorative dots
function drawBlueDots(ctx, x, y, count = 12) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i;
        const dotX = x + Math.cos(angle) * 60;
        const dotY = y + Math.sin(angle) * 60;
        
        ctx.beginPath();
        ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.blue;
        ctx.fill();
    }
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
    
    // Black background
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Draw decorative starbursts in corners
    drawStarburst(ctx, 0, 0, 1);
    drawStarburst(ctx, WIDTH, 0, 1);
    drawStarburst(ctx, 0, HEIGHT, 0.8);
    
    // Draw blue decorative dots near the profile area
    drawBlueDots(ctx, 512, 286, 12);
    
    // Profile photo area - centered upper portion
    const photoX = 512;
    const photoY = 286;
    const photoRadius = 90;
    
    // Profile photo border (pink)
    ctx.beginPath();
    ctx.arc(photoX, photoY, photoRadius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.pink;
    ctx.lineWidth = 3;
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
        ctx.font = 'bold 60px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initials = (member.first_name?.[0] || '') + (member.last_name?.[0] || '');
        ctx.fillText(initials.toUpperCase() || '?', photoX, photoY);
    }
    
    // Member badge (pink star) - position near the badge in original SVG
    drawMemberBadge(ctx, 512, 478, 100, member.is_founding_member);
    
    // Name
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 42px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const displayName = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username || 'Member';
    ctx.fillText(displayName, 512, 400);
    
    // Founding Member / Member badge text
    ctx.fillStyle = COLORS.red;
    ctx.font = '24px Arial, sans-serif';
    const memberType = member.is_founding_member ? 'Founding Member' : 'Member';
    ctx.fillText(memberType, 512, 450);
    
    // Draw concentric circles at bottom
    drawConcentricCircles(ctx, 512, 670, 50);
    
    // Date (Member since)
    ctx.fillStyle = COLORS.gray;
    ctx.font = '18px Arial, sans-serif';
    const memberSince = formatDate(member.joined_at);
    ctx.fillText(`Member since ${memberSince}`, 512, 590);
    
    // CTA at bottom - in the decorative box area
    ctx.fillStyle = COLORS.white;
    ctx.font = '24px Arial, sans-serif';
    ctx.fillText('Want in? Ask me for an invite!', 512, 730);
    
    // Small decorative elements
    ctx.strokeStyle = COLORS.neonGreen;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, 730);
    ctx.lineTo(270, 730);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(754, 730);
    ctx.lineTo(824, 730);
    ctx.stroke();
    
    return canvas.toBuffer('image/png');
}

module.exports = { generateMemberCard };
