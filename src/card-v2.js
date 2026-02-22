const { createCanvas, loadImage, registerFont } = require('canvas');
const sharp = require('sharp');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Card dimensions from Figma v2
const WIDTH = 1200;
const HEIGHT = 675;

// Random background colors from the Figma design
const BG_COLORS = [
    '#0047FF', // Blue
    '#B24BF3', // Purple  
    '#BFFF00', // Lime green
    '#FFB6D9', // Pink
    '#FF6B35', // Orange
];

// Asset paths
const ASSETS_DIR = path.join(__dirname, 'assets');

// SVG assets exported from Figma
const SVG_ASSETS = {
    leftIO: path.join(ASSETS_DIR, 'left-io.svg'),
    rightIC: path.join(ASSETS_DIR, 'right-ic.svg'),
    innerCircleLogo: path.join(ASSETS_DIR, 'inner-circle-logo.svg'),
    sunIcon: path.join(ASSETS_DIR, 'sun-icon.svg'),
    bottomInvite: path.join(ASSETS_DIR, 'bottom-invite.svg'),
};

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

// Exact positions from Figma (relative to 1200x675 card)
const POSITIONS = {
    // INNER CIRCLE logo top-left
    logo: { x: 36, y: 36, width: 101, height: 46 },
    
    // Name + Sun + Member type frame (top-right area)
    nameFrame: { x: 718, y: 37, width: 446, height: 44 },
    // Within nameFrame:
    // - Name: x=0, y=0
    // - Sun: x=99, y=1.5  (relative to nameFrame)
    // - Member type: x=154, y=0 (relative to nameFrame)
    
    // Left IO letters (partially off-screen)
    leftIO: { x: -54, y: 145, width: 728, height: 445 },
    
    // Right IC letters (partially off-screen)
    rightIC: { x: 744, y: 145, width: 728, height: 445 },
    
    // Profile ellipse (white ring)
    profile: { x: 266, y: 186, width: 369, height: 369 },
    
    // Bottom invite box
    bottomInvite: { x: 284, y: 555, width: 373, height: 73 },
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
            return buffer;
        }
    } catch (e) {
        console.error('Failed to get profile photo:', e.message);
    }
    return null;
}

// Load SVG and tint it with background-appropriate color
async function loadSvgTinted(svgPath, bgColor) {
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    
    // For dark backgrounds, keep white. For light backgrounds (lime, pink), use black
    const isLightBg = ['#BFFF00', '#FFB6D9'].includes(bgColor);
    const tintColor = isLightBg ? '#000000' : '#FFFFFF';
    
    // Replace fill="white" with the tint color
    const tintedSvg = svgContent
        .replace(/fill="white"/g, `fill="${tintColor}"`)
        .replace(/stroke="white"/g, `stroke="${tintColor}"`);
    
    return Buffer.from(tintedSvg);
}

// Create circular profile with white ring and grayscale effect
async function createProfileComposite(photoBuffer, bgColor) {
    const p = POSITIONS.profile;
    const ringWidth = 12;
    const innerRadius = (p.width / 2) - ringWidth;
    
    const isLightBg = ['#BFFF00', '#FFB6D9'].includes(bgColor);
    const ringColor = isLightBg ? '#000000' : '#FFFFFF';
    
    // Create the ring as a circle
    const ringSvg = `
        <svg width="${p.width}" height="${p.height}" xmlns="http://www.w3.org/2000/svg">
            <circle cx="${p.width/2}" cy="${p.height/2}" r="${p.width/2 - ringWidth/2}" 
                    fill="none" stroke="${ringColor}" stroke-width="${ringWidth}"/>
        </svg>
    `;
    
    if (!photoBuffer) {
        // Just return the ring with gray center
        const grayCenterSvg = `
            <svg width="${p.width}" height="${p.height}" xmlns="http://www.w3.org/2000/svg">
                <circle cx="${p.width/2}" cy="${p.height/2}" r="${innerRadius}" fill="#333333"/>
                <circle cx="${p.width/2}" cy="${p.height/2}" r="${p.width/2 - ringWidth/2}" 
                        fill="none" stroke="${ringColor}" stroke-width="${ringWidth}"/>
            </svg>
        `;
        return sharp(Buffer.from(grayCenterSvg)).png().toBuffer();
    }
    
    // Process photo: resize, make circular, grayscale
    const photoSize = Math.floor(innerRadius * 2);
    const circularPhoto = await sharp(photoBuffer)
        .resize(photoSize, photoSize, { fit: 'cover' })
        .grayscale()
        .composite([{
            input: Buffer.from(`
                <svg width="${photoSize}" height="${photoSize}" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="${photoSize/2}" cy="${photoSize/2}" r="${photoSize/2}" fill="white"/>
                </svg>
            `),
            blend: 'dest-in'
        }])
        .png()
        .toBuffer();
    
    // Composite ring over photo
    const ringBuffer = await sharp(Buffer.from(ringSvg)).png().toBuffer();
    
    const photoOffset = Math.floor((p.width - photoSize) / 2);
    
    return sharp({
        create: {
            width: p.width,
            height: p.height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    })
    .composite([
        { input: circularPhoto, left: photoOffset, top: photoOffset },
        { input: ringBuffer, left: 0, top: 0 }
    ])
    .png()
    .toBuffer();
}

async function generateMemberCard(bot, member, inviterName = null) {
    // Pick random background color
    const bgColor = BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];
    const isLightBg = ['#BFFF00', '#FFB6D9'].includes(bgColor);
    const textColor = isLightBg ? '#000000' : '#FFFFFF';
    
    // Parse background color to RGB
    const bgR = parseInt(bgColor.slice(1, 3), 16);
    const bgG = parseInt(bgColor.slice(3, 5), 16);
    const bgB = parseInt(bgColor.slice(5, 7), 16);
    
    // Create base image with background color
    const composites = [];
    
    // Load and tint SVG assets
    const [leftIOSvg, rightICSvg, logoSvg, sunSvg] = await Promise.all([
        loadSvgTinted(SVG_ASSETS.leftIO, bgColor),
        loadSvgTinted(SVG_ASSETS.rightIC, bgColor),
        loadSvgTinted(SVG_ASSETS.innerCircleLogo, bgColor),
        loadSvgTinted(SVG_ASSETS.sunIcon, bgColor),
    ]);
    
    // Add left IO letters
    const leftIOPng = await sharp(leftIOSvg).png().toBuffer();
    composites.push({
        input: leftIOPng,
        left: POSITIONS.leftIO.x,
        top: POSITIONS.leftIO.y,
    });
    
    // Add right IC letters
    const rightICPng = await sharp(rightICSvg).png().toBuffer();
    composites.push({
        input: rightICPng,
        left: POSITIONS.rightIC.x,
        top: POSITIONS.rightIC.y,
    });
    
    // Add INNER CIRCLE logo
    const logoPng = await sharp(logoSvg)
        .resize(POSITIONS.logo.width, POSITIONS.logo.height, { fit: 'contain' })
        .png()
        .toBuffer();
    composites.push({
        input: logoPng,
        left: POSITIONS.logo.x,
        top: POSITIONS.logo.y,
    });
    
    // Get profile photo and create composite
    const profilePhotoBuffer = await getProfilePhoto(bot, member.telegram_id);
    const profileComposite = await createProfileComposite(profilePhotoBuffer, bgColor);
    composites.push({
        input: profileComposite,
        left: POSITIONS.profile.x,
        top: POSITIONS.profile.y,
    });
    
    // Create text overlay using canvas
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Transparent background
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    
    // Name text (top right area)
    const displayName = member.telegram_name || member.telegram_username || member.first_name || member.username || 'Member';
    ctx.fillStyle = textColor;
    ctx.font = fontsLoaded ? 'bold 36px SpaceGrotesk' : 'bold 36px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(displayName, POSITIONS.nameFrame.x, POSITIONS.nameFrame.y + 4);
    
    // Measure name width to position sun icon
    const nameWidth = ctx.measureText(displayName).width;
    
    // Sun icon position (after name)
    const sunX = POSITIONS.nameFrame.x + nameWidth + 14;
    const sunY = POSITIONS.nameFrame.y + 1;
    
    // Member type text (after sun)
    let memberType;
    if (member.is_founding_member) {
        memberType = 'Founding Member';
    } else if (inviterName) {
        memberType = `Invited by ${inviterName}`;
    } else {
        memberType = 'Member';
    }
    
    const memberTypeX = sunX + 55;
    ctx.fillText(memberType, memberTypeX, POSITIONS.nameFrame.y + 4);
    
    // Bottom invite box
    const bottomY = POSITIONS.bottomInvite.y;
    const boxText = 'Want In? Ask Me For An Invite!';
    ctx.font = fontsLoaded ? 'bold 24px SpaceGrotesk' : 'bold 24px Arial';
    const boxTextWidth = ctx.measureText(boxText).width;
    const boxPadding = 20;
    const boxWidth = boxTextWidth + boxPadding * 2;
    const boxHeight = 54;
    const boxX = (WIDTH - boxWidth) / 2;
    
    // Slight rotation for the box (-3 degrees like Figma)
    ctx.save();
    ctx.translate(WIDTH / 2, bottomY + boxHeight / 2);
    ctx.rotate(-3 * Math.PI / 180);
    
    // Black box
    ctx.fillStyle = '#000000';
    ctx.fillRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight);
    
    // White text
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(boxText, 0, 0);
    ctx.restore();
    
    // Convert canvas to PNG buffer
    const textOverlay = canvas.toBuffer('image/png');
    composites.push({
        input: textOverlay,
        left: 0,
        top: 0,
    });
    
    // Add sun icon
    const sunPng = await sharp(sunSvg)
        .resize(41, 41)
        .png()
        .toBuffer();
    composites.push({
        input: sunPng,
        left: Math.round(sunX),
        top: Math.round(sunY),
    });
    
    // Compose final image
    const finalImage = await sharp({
        create: {
            width: WIDTH,
            height: HEIGHT,
            channels: 4,
            background: { r: bgR, g: bgG, b: bgB, alpha: 255 }
        }
    })
    .composite(composites)
    .png()
    .toBuffer();
    
    return finalImage;
}

module.exports = { generateMemberCard };
