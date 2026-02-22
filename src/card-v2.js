const { createCanvas, loadImage, registerFont } = require('canvas');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Card dimensions - landscape like Figma design
const WIDTH = 1200;
const HEIGHT = 630;

// Random background colors from the Figma design
const BG_COLORS = [
    '#0047FF', // Blue
    '#B24BF3', // Purple  
    '#BFFF00', // Lime green
    '#FFB6D9', // Pink
    '#FF6B35', // Orange
];

// Text colors that work with each background
const TEXT_COLORS = {
    '#0047FF': { primary: '#FFFFFF', secondary: '#FFFFFF', accent: '#0047FF', bottomBar: '#FFFFFF' },
    '#B24BF3': { primary: '#FFFFFF', secondary: '#FFFFFF', accent: '#B24BF3', bottomBar: '#FFFFFF' },
    '#BFFF00': { primary: '#000000', secondary: '#333333', accent: '#000000', bottomBar: '#000000' },
    '#FFB6D9': { primary: '#000000', secondary: '#333333', accent: '#000000', bottomBar: '#000000' },
    '#FF6B35': { primary: '#FFFFFF', secondary: '#FFFFFF', accent: '#FF6B35', bottomBar: '#FFFFFF' },
};

// Asset paths
const ASSETS_DIR = path.join(__dirname, 'assets');

// Font paths
const FONTS = {
    bold: path.join(ASSETS_DIR, 'fonts', 'SpaceGrotesk-Bold.ttf'),
    medium: path.join(ASSETS_DIR, 'fonts', 'Satoshi-Medium.ttf'),
    regular: path.join(ASSETS_DIR, 'fonts', 'Satoshi-Regular.ttf')
};

// Register fonts
let fontsLoaded = false;
try {
    if (fs.existsSync(FONTS.bold)) {
        registerFont(FONTS.bold, { family: 'SpaceGrotesk', weight: 'bold' });
    }
    if (fs.existsSync(FONTS.medium)) {
        registerFont(FONTS.medium, { family: 'Satoshi', weight: '500' });
    }
    if (fs.existsSync(FONTS.regular)) {
        registerFont(FONTS.regular, { family: 'Satoshi', weight: 'normal' });
    }
    fontsLoaded = true;
    console.log('✓ Fonts registered for card-v2');
} catch (e) {
    console.error('Failed to register fonts:', e.message);
}

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

// Draw sunburst pattern (radial lines from center, with optional hole)
function drawSunburst(ctx, cx, cy, radius, color, opacity = 0.08, holeRadius = 0) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    
    const numLines = 24;
    const innerRadius = Math.max(radius * 0.35, holeRadius);
    const outerRadius = radius;
    
    for (let i = 0; i < numLines; i++) {
        const angle = (i * Math.PI * 2) / numLines;
        const x1 = cx + Math.cos(angle) * innerRadius;
        const y1 = cy + Math.sin(angle) * innerRadius;
        const x2 = cx + Math.cos(angle) * outerRadius;
        const y2 = cy + Math.sin(angle) * outerRadius;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
    
    ctx.restore();
}

// Draw the IO logo (stylized "I" with diagonal slash + "O")
function drawIOLogo(ctx, x, y, color) {
    ctx.fillStyle = color;
    
    const height = 42;
    const stemWidth = 12;
    
    // "I" - Two parts with diagonal cut between them
    // Top part of I
    ctx.fillRect(x, y, stemWidth, height * 0.35);
    
    // Bottom part of I (offset to create slash effect)
    ctx.fillRect(x + 8, y + height * 0.55, stemWidth, height * 0.45);
    
    // Diagonal connector (the slash)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + stemWidth, y + height * 0.35);
    ctx.lineTo(x + stemWidth + 8, y + height * 0.35);
    ctx.lineTo(x + 8, y + height * 0.55);
    ctx.lineTo(x, y + height * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    
    // "O" circle (outline)
    ctx.beginPath();
    ctx.arc(x + 50, y + height/2, 17, 0, Math.PI * 2);
    ctx.lineWidth = 7;
    ctx.strokeStyle = color;
    ctx.stroke();
}

// Draw decorative diagonal brush strokes (right side)
function drawBrushStrokes(ctx, color, opacity = 0.12) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    
    // Diagonal lines on right side
    const strokes = [
        { x1: WIDTH - 200, y1: 80, x2: WIDTH - 100, y2: 200 },
        { x1: WIDTH - 170, y1: 110, x2: WIDTH - 70, y2: 230 },
        { x1: WIDTH - 140, y1: 140, x2: WIDTH - 40, y2: 260 },
        { x1: WIDTH - 110, y1: 170, x2: WIDTH - 10, y2: 290 },
        // Lower right strokes
        { x1: WIDTH - 180, y1: 280, x2: WIDTH - 60, y2: 420 },
        { x1: WIDTH - 150, y1: 310, x2: WIDTH - 30, y2: 450 },
        { x1: WIDTH - 120, y1: 340, x2: WIDTH - 0, y2: 480 },
    ];
    
    strokes.forEach(s => {
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
    });
    
    ctx.restore();
}

// Draw INNER/CIRCLE stacked text (top right)
function drawInnerCircleText(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.font = fontsLoaded ? 'bold 18px SpaceGrotesk' : 'bold 18px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    
    // Letter spacing effect
    const innerText = 'I N N E R';
    const circleText = 'C I R C L E';
    
    ctx.fillText(innerText, x, y);
    ctx.fillText(circleText, x, y + 22);
}

// Draw circular profile photo with white ring
function drawProfilePhoto(ctx, photo, cx, cy, radius, bgColor) {
    // Determine if dark background for placeholder color
    const isDark = ['#0047FF', '#B24BF3', '#FF6B35'].includes(bgColor);
    
    const ringWidth = 14; // White ring thickness
    
    if (photo) {
        // Clip to circle and draw photo first
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();
        
        // Draw photo centered and covering the circle
        const size = radius * 2;
        ctx.drawImage(photo, cx - radius, cy - radius, size, size);
        
        ctx.restore();
    } else {
        // Placeholder circle (no photo) - draw a filled circle
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.2)';
        ctx.fill();
    }
    
    // Draw white ring AFTER photo/placeholder (so it's on top)
    // DEBUG: Using red to verify ring position
    ctx.beginPath();
    ctx.arc(cx, cy, radius + ringWidth / 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#FF0000'; // DEBUG: Red to verify
    ctx.lineWidth = ringWidth;
    ctx.stroke();
}

// Draw placeholder initials
function drawInitials(ctx, name, cx, cy, bgColor) {
    // Use accent color or white for initials
    const isDark = ['#0047FF', '#B24BF3', '#FF6B35'].includes(bgColor);
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)';
    ctx.font = fontsLoaded ? 'bold 80px SpaceGrotesk' : 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    ctx.fillText(initials || '?', cx, cy);
}

// Draw bottom bar with diagonal divider
function drawBottomBar(ctx, bgColor, textColors, memberSince) {
    const barHeight = 70;
    const barY = HEIGHT - barHeight;
    const diagonalOffset = 80; // How much the diagonal cuts in
    
    // Blue section (left side with diagonal)
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.moveTo(0, barY);
    ctx.lineTo(WIDTH * 0.5 + diagonalOffset, barY);
    ctx.lineTo(WIDTH * 0.5 - diagonalOffset, HEIGHT);
    ctx.lineTo(0, HEIGHT);
    ctx.closePath();
    ctx.fill();
    
    // White section (right side)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(WIDTH * 0.5 + diagonalOffset, barY);
    ctx.lineTo(WIDTH, barY);
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.lineTo(WIDTH * 0.5 - diagonalOffset, HEIGHT);
    ctx.closePath();
    ctx.fill();
    
    // Sunburst icon (small) + "Member Since" text (left)
    const sunburstX = 55;
    const sunburstY = barY + barHeight / 2;
    drawSunburst(ctx, sunburstX, sunburstY, 18, textColors.bottomBar, 1);
    
    ctx.fillStyle = textColors.bottomBar;
    ctx.font = fontsLoaded ? '500 22px Satoshi' : '22px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Member Since ${memberSince}`, 90, barY + barHeight / 2);
    
    // "Want In? Ask Me For An Invite!" text (right)
    ctx.fillStyle = textColors.accent;
    ctx.font = fontsLoaded ? '500 22px Satoshi' : '22px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('Want In? Ask Me For An Invite!', WIDTH - 45, barY + barHeight / 2);
}

async function generateMemberCard(bot, member, inviterName = null) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Pick random background color
    const bgColor = BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];
    const textColors = TEXT_COLORS[bgColor];
    
    // Determine if dark background
    const isDark = ['#0047FF', '#B24BF3', '#FF6B35'].includes(bgColor);
    const decorColor = isDark ? '#FFFFFF' : '#000000';
    
    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Draw sunburst behind profile area (with hole for profile)
    const profileX = 260;
    const profileY = HEIGHT / 2 - 20;
    const photoRadius = 140;
    const profileRingWidth = 14;
    drawSunburst(ctx, profileX, profileY, 320, decorColor, isDark ? 0.08 : 0.06, photoRadius + profileRingWidth + 20);
    
    // Draw decorative brush strokes (right side)
    drawBrushStrokes(ctx, decorColor, isDark ? 0.12 : 0.08);
    
    // === TOP BAR ===
    // IO logo (top left)
    drawIOLogo(ctx, 35, 30, textColors.primary);
    
    // "INNER CIRCLE" stacked text (top right)
    drawInnerCircleText(ctx, WIDTH - 35, 30, textColors.primary);
    
    // === PROFILE SECTION ===
    
    // Try to load profile photo
    const profilePhoto = await getProfilePhoto(bot, member.telegram_id);
    
    // Draw profile with white ring
    drawProfilePhoto(ctx, profilePhoto, profileX, profileY, photoRadius, bgColor);
    
    // Draw initials if no photo
    if (!profilePhoto) {
        const displayNameForInitials = member.telegram_name || member.telegram_username || member.first_name || 'Member';
        drawInitials(ctx, displayNameForInitials, profileX, profileY, bgColor);
    }
    
    // === NAME & TITLE (right of profile) ===
    const textX = 480;
    
    // Name (large)
    ctx.fillStyle = textColors.primary;
    ctx.font = fontsLoaded ? 'bold 72px SpaceGrotesk' : 'bold 72px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const displayName = member.telegram_name || member.telegram_username || member.first_name || member.username || 'Member';
    
    // Truncate name if too long
    let nameToDisplay = displayName;
    const maxWidth = WIDTH - textX - 250;
    while (ctx.measureText(nameToDisplay).width > maxWidth && nameToDisplay.length > 1) {
        nameToDisplay = nameToDisplay.slice(0, -1);
    }
    if (nameToDisplay !== displayName) nameToDisplay += '...';
    
    ctx.fillText(nameToDisplay, textX, HEIGHT / 2 - 40);
    
    // Member type / Invited by
    ctx.fillStyle = textColors.primary;
    ctx.font = fontsLoaded ? '500 28px Satoshi' : '28px Arial';
    let memberType;
    if (member.is_founding_member) {
        memberType = 'Founding Member';
    } else if (inviterName) {
        memberType = `Invited by ${inviterName}`;
    } else {
        memberType = 'Member';
    }
    ctx.fillText(memberType, textX, HEIGHT / 2 + 25);
    
    // === BOTTOM BAR ===
    const memberSince = formatDate(member.joined_at);
    drawBottomBar(ctx, bgColor, textColors, memberSince);
    
    return canvas.toBuffer('image/png');
}

module.exports = { generateMemberCard };
