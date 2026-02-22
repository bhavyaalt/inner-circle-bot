const { createCanvas, loadImage, registerFont } = require('canvas');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Card dimensions - landscape like Figma v2
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
    '#0047FF': { primary: '#FFFFFF', secondary: '#FFFFFF' },
    '#B24BF3': { primary: '#FFFFFF', secondary: '#FFFFFF' },
    '#BFFF00': { primary: '#000000', secondary: '#000000' },
    '#FFB6D9': { primary: '#000000', secondary: '#000000' },
    '#FF6B35': { primary: '#FFFFFF', secondary: '#FFFFFF' },
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

// Draw the "INNER CIRCLE" logo (top left) - stylized with circle O
function drawInnerCircleLogo(ctx, color) {
    ctx.fillStyle = color;
    ctx.font = fontsLoaded ? 'bold 28px SpaceGrotesk' : 'bold 28px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    // "INN" then special "E" with line, then "R"
    ctx.fillText('INNER', 50, 45);
    
    // "CIRCLE" below with the O being a circle with cross
    ctx.fillText('CIRCLE', 50, 75);
}

// Draw sun/starburst icon
function drawSunIcon(ctx, x, y, radius, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    const numRays = 16;
    const innerRadius = radius * 0.3;
    const outerRadius = radius;
    
    for (let i = 0; i < numRays; i++) {
        const angle = (i * 2 * Math.PI) / numRays;
        const x1 = x + Math.cos(angle) * innerRadius;
        const y1 = y + Math.sin(angle) * innerRadius;
        const x2 = x + Math.cos(angle) * outerRadius;
        const y2 = y + Math.sin(angle) * outerRadius;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
}

// Draw the big "IOIC" background geometric shapes
function drawBackgroundLetters(ctx, color) {
    ctx.fillStyle = color;
    
    // Big "I" on far left (partially cut off)
    ctx.fillRect(-20, 170, 60, 290);  // Vertical bar
    ctx.fillRect(-20, 170, 120, 60);   // Top serif
    ctx.fillRect(-20, 400, 120, 60);   // Bottom serif
    
    // Big "O" - the main circle where profile sits
    // This is drawn as a ring (will be behind the profile)
    const oX = 400;
    const oY = HEIGHT / 2;
    const outerR = 200;
    const innerR = 130;
    
    ctx.beginPath();
    ctx.arc(oX, oY, outerR, 0, Math.PI * 2);
    ctx.arc(oX, oY, innerR, 0, Math.PI * 2, true); // Counter-clockwise for hole
    ctx.fill();
    
    // Big "I" after the O
    ctx.fillRect(680, 170, 60, 290);  // Vertical bar
    ctx.fillRect(640, 170, 140, 60);   // Top serif
    ctx.fillRect(640, 400, 140, 60);   // Bottom serif
    
    // Big "C" on far right (partially cut off)
    const cX = WIDTH + 50;
    const cY = HEIGHT / 2;
    const cOuterR = 220;
    const cInnerR = 150;
    
    ctx.beginPath();
    ctx.arc(cX, cY, cOuterR, 0.6, Math.PI * 2 - 0.6);
    ctx.arc(cX, cY, cInnerR, Math.PI * 2 - 0.6, 0.6, true);
    ctx.closePath();
    ctx.fill();
}

// Draw circular profile photo with white ring (B&W effect)
function drawProfilePhoto(ctx, photo, cx, cy, radius, ringColor) {
    // White ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 12, 0, Math.PI * 2);
    ctx.fillStyle = ringColor;
    ctx.fill();
    
    // Clip to circle and draw photo
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    
    if (photo) {
        // Draw photo centered and covering the circle (grayscale via composite)
        const size = Math.max(photo.width, photo.height);
        const scale = (radius * 2) / Math.min(photo.width, photo.height);
        const w = photo.width * scale;
        const h = photo.height * scale;
        
        ctx.drawImage(photo, cx - w/2, cy - h/2, w, h);
        
        // Apply grayscale effect
        ctx.globalCompositeOperation = 'saturation';
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
        ctx.globalCompositeOperation = 'source-over';
    } else {
        // Gray placeholder
        ctx.fillStyle = '#333333';
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
    
    ctx.restore();
}

// Draw placeholder initials
function drawInitials(ctx, name, cx, cy) {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = fontsLoaded ? 'bold 80px SpaceGrotesk' : 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    ctx.fillText(initials || '?', cx, cy);
}

async function generateMemberCard(bot, member, inviterName = null) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Pick random background color
    const bgColor = BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];
    const textColors = TEXT_COLORS[bgColor];
    
    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Draw big "IOIC" background letters in white
    drawBackgroundLetters(ctx, textColors.primary);
    
    // === TOP LEFT: INNER CIRCLE logo ===
    drawInnerCircleLogo(ctx, textColors.primary);
    
    // === TOP RIGHT: Name + Sun + Member Type ===
    const displayName = member.telegram_name || member.telegram_username || member.first_name || member.username || 'Member';
    
    // Member type text
    let memberType;
    if (member.is_founding_member) {
        memberType = 'Founding Member';
    } else if (inviterName) {
        memberType = `Invited by ${inviterName}`;
    } else {
        memberType = 'Member';
    }
    
    // Draw name
    ctx.fillStyle = textColors.primary;
    ctx.font = fontsLoaded ? 'bold 52px SpaceGrotesk' : 'bold 52px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    
    // Calculate positions
    const nameX = WIDTH - 50;
    const nameY = 50;
    
    // Measure member type text to position sun icon
    ctx.font = fontsLoaded ? '500 36px Satoshi' : '36px Arial';
    const memberTypeWidth = ctx.measureText(memberType).width;
    
    // Draw name
    ctx.font = fontsLoaded ? 'bold 52px SpaceGrotesk' : 'bold 52px Arial';
    const nameWidth = ctx.measureText(displayName).width;
    
    // Sun icon position (between name and member type)
    const sunX = nameX - memberTypeWidth - 30;
    const sunY = nameY + 26;
    
    // Draw: Name [sun] Member Type
    ctx.fillText(displayName, sunX - 30, nameY);
    drawSunIcon(ctx, sunX, sunY, 16, textColors.primary);
    
    ctx.font = fontsLoaded ? '500 36px Satoshi' : '36px Arial';
    ctx.fillText(memberType, nameX, nameY + 10);
    
    // === CENTER: Profile Photo ===
    const photoX = 400;
    const photoY = HEIGHT / 2;
    const photoRadius = 118;
    
    // Try to load profile photo
    const profilePhoto = await getProfilePhoto(bot, member.telegram_id);
    
    // Draw profile with white ring
    drawProfilePhoto(ctx, profilePhoto, photoX, photoY, photoRadius, textColors.primary);
    
    // Draw initials if no photo
    if (!profilePhoto) {
        drawInitials(ctx, displayName, photoX, photoY);
    }
    
    // === BOTTOM: Black box with invite text ===
    const boxText = 'Want In? Ask Me For An Invite!';
    ctx.font = fontsLoaded ? 'bold 28px SpaceGrotesk' : 'bold 28px Arial';
    const boxTextWidth = ctx.measureText(boxText).width;
    const boxPadding = 24;
    const boxHeight = 50;
    const boxWidth = boxTextWidth + boxPadding * 2;
    const boxX = (WIDTH - boxWidth) / 2;
    const boxY = HEIGHT - 90;
    
    // Black box
    ctx.fillStyle = '#000000';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    
    // White text
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(boxText, WIDTH / 2, boxY + boxHeight / 2);
    
    return canvas.toBuffer('image/png');
}

module.exports = { generateMemberCard };
