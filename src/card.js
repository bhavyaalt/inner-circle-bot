const { createCanvas, loadImage, registerFont } = require('canvas');
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

// Asset paths
const ASSETS = {
    background: path.join(__dirname, 'assets', 'card-background.png'),
    hexFrame: path.join(__dirname, 'assets', 'hex-frame.png'),
    hexMask: path.join(__dirname, 'assets', 'hex-mask.png')
};

// Font paths
const FONTS = {
    spaceGroteskBold: path.join(__dirname, 'assets', 'fonts', 'SpaceGrotesk-Bold.ttf'),
    satoshiMedium: path.join(__dirname, 'assets', 'fonts', 'Satoshi-Medium.ttf'),
    satoshiRegular: path.join(__dirname, 'assets', 'fonts', 'Satoshi-Regular.ttf')
};

// Register fonts
let fontsLoaded = false;
try {
    const fs = require('fs');
    
    // Check if font files exist
    const fontFiles = [FONTS.spaceGroteskBold, FONTS.satoshiMedium, FONTS.satoshiRegular];
    for (const fontFile of fontFiles) {
        if (!fs.existsSync(fontFile)) {
            console.error(`Font file not found: ${fontFile}`);
        }
    }
    
    registerFont(FONTS.spaceGroteskBold, { family: 'SpaceGrotesk', weight: 'bold' });
    registerFont(FONTS.satoshiMedium, { family: 'Satoshi', weight: '500' });
    registerFont(FONTS.satoshiRegular, { family: 'Satoshi', weight: 'normal' });
    fontsLoaded = true;
    console.log('✓ Fonts registered successfully');
} catch (e) {
    console.error('Failed to register fonts:', e.message, e.stack);
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

// Draw a hexagon path for clipping
function drawHexagonPath(ctx, cx, cy, radius) {
    const sides = 6;
    const angleOffset = Math.PI / 6; // Rotate to have flat top
    
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const angle = (Math.PI * 2 / sides) * i - Math.PI / 2 + angleOffset;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.closePath();
}

async function generateMemberCard(bot, member) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Load assets
    let background, hexFrame;
    try {
        background = await loadImage(ASSETS.background);
        hexFrame = await loadImage(ASSETS.hexFrame);
    } catch (e) {
        console.error('Failed to load assets:', e.message);
    }
    
    // Draw background
    if (background) {
        ctx.drawImage(background, 0, 0, WIDTH, HEIGHT);
    } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    
    // Profile photo area - centered
    const photoX = WIDTH / 2;
    const photoY = 200;
    const hexScale = 1.0;
    const hexWidth = 255 * hexScale;
    const hexHeight = 240 * hexScale;
    const hexRadius = 105; // Radius for clipping hexagon
    
    // Draw hex frame (with orange shadow)
    if (hexFrame) {
        ctx.drawImage(
            hexFrame,
            photoX - hexWidth / 2,
            photoY - hexHeight / 2,
            hexWidth,
            hexHeight
        );
    }
    
    // Try to load profile photo
    const profilePhoto = await getProfilePhoto(bot, member.telegram_id);
    
    if (profilePhoto) {
        // Clip profile photo to hexagon shape
        ctx.save();
        drawHexagonPath(ctx, photoX, photoY, hexRadius - 8);
        ctx.clip();
        
        // Draw profile photo centered in hexagon
        const photoSize = hexRadius * 2;
        ctx.drawImage(
            profilePhoto,
            photoX - photoSize / 2,
            photoY - photoSize / 2,
            photoSize,
            photoSize
        );
        ctx.restore();
    } else {
        // Placeholder initials in hexagon
        ctx.save();
        drawHexagonPath(ctx, photoX, photoY, hexRadius - 8);
        ctx.fillStyle = '#2a2a2a';
        ctx.fill();
        
        ctx.fillStyle = COLORS.pink;
        ctx.font = fontsLoaded ? 'bold 72px SpaceGrotesk' : 'bold 72px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initials = (member.first_name?.[0] || '') + (member.last_name?.[0] || '');
        ctx.fillText(initials.toUpperCase() || '?', photoX, photoY);
        ctx.restore();
    }
    
    // Name - Space Grotesk Bold
    ctx.fillStyle = COLORS.white;
    ctx.font = fontsLoaded ? 'bold 48px SpaceGrotesk' : 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const displayName = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username || 'Member';
    ctx.fillText(displayName, WIDTH / 2, 340);
    
    // Member type (Founding Member / Member) - Satoshi Medium
    ctx.fillStyle = COLORS.red;
    ctx.font = fontsLoaded ? '500 28px Satoshi' : '28px Arial';
    const memberType = member.is_founding_member ? 'Founding Member' : 'Member';
    ctx.fillText(memberType, WIDTH / 2, 405);
    
    // Member since date - Satoshi Regular
    ctx.fillStyle = COLORS.gray;
    ctx.font = fontsLoaded ? '22px Satoshi' : '22px Arial';
    const memberSince = formatDate(member.joined_at);
    ctx.fillText(`Member since ${memberSince}`, WIDTH / 2, 450);
    
    return canvas.toBuffer('image/png');
}

module.exports = { generateMemberCard };
