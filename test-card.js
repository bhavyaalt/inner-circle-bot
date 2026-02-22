// Quick test of card-v2 generation
require('dotenv').config();
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, 'src', 'assets');
const FONTS = {
    bold: path.join(ASSETS_DIR, 'fonts', 'SpaceGrotesk-Bold.ttf'),
    medium: path.join(ASSETS_DIR, 'fonts', 'Satoshi-Medium.ttf'),
    regular: path.join(ASSETS_DIR, 'fonts', 'Satoshi-Regular.ttf')
};

// Register fonts
try {
    if (fs.existsSync(FONTS.bold)) registerFont(FONTS.bold, { family: 'SpaceGrotesk', weight: 'bold' });
    if (fs.existsSync(FONTS.medium)) registerFont(FONTS.medium, { family: 'Satoshi', weight: '500' });
    if (fs.existsSync(FONTS.regular)) registerFont(FONTS.regular, { family: 'Satoshi', weight: 'normal' });
    console.log('✓ Fonts loaded');
} catch (e) {
    console.error('Font error:', e.message);
}

// Card dimensions
const WIDTH = 1200;
const HEIGHT = 630;

const BG_COLORS = ['#0047FF', '#B24BF3', '#BFFF00', '#FFB6D9', '#FF6B35'];
const TEXT_COLORS = {
    '#0047FF': { primary: '#FFFFFF', secondary: '#FFFFFF', accent: '#FFFFFF' },
    '#B24BF3': { primary: '#FFFFFF', secondary: '#FFFFFF', accent: '#FFFFFF' },
    '#BFFF00': { primary: '#000000', secondary: '#000000', accent: '#000000' },
    '#FFB6D9': { primary: '#000000', secondary: '#FF6B35', accent: '#FF6B35' },
    '#FF6B35': { primary: '#FFFFFF', secondary: '#FFFFFF', accent: '#FFFFFF' },
};

async function generateTestCard() {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Test with blue background
    const bgColor = '#0047FF';
    const textColors = TEXT_COLORS[bgColor];
    
    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Big "IO" letters
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.15;
    ctx.font = 'bold 500px SpaceGrotesk';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('I', -30, HEIGHT / 2 + 20);
    ctx.fillText('O', 180, HEIGHT / 2 + 20);
    ctx.globalAlpha = 1;
    
    // Brush strokes
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    [[WIDTH - 180, 60, WIDTH - 80, 160],
     [WIDTH - 150, 80, WIDTH - 50, 180],
     [WIDTH - 120, 100, WIDTH - 20, 200]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    });
    
    // "IO" logo top left
    ctx.fillStyle = textColors.primary;
    ctx.font = 'bold 28px SpaceGrotesk';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('IO', 40, 35);
    
    // "INNER CIRCLE" top right
    ctx.font = 'bold 16px SpaceGrotesk';
    ctx.textAlign = 'right';
    ctx.fillText('INNER', WIDTH - 40, 30);
    ctx.fillText('CIRCLE', WIDTH - 40, 48);
    
    // Profile circle
    const photoX = 280;
    const photoY = HEIGHT / 2;
    const photoRadius = 140;
    
    // Black ring
    ctx.beginPath();
    ctx.arc(photoX, photoY, photoRadius + 8, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    
    // Gray placeholder
    ctx.beginPath();
    ctx.arc(photoX, photoY, photoRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#333333';
    ctx.fill();
    
    // Initials
    ctx.fillStyle = '#FF9FC2';
    ctx.font = 'bold 80px SpaceGrotesk';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AK', photoX, photoY);
    
    // Name
    ctx.fillStyle = textColors.primary;
    ctx.font = 'bold 72px SpaceGrotesk';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Akhil', 500, HEIGHT / 2 - 30);
    
    // Member type
    ctx.font = '500 32px Satoshi';
    ctx.fillText('Founding Member', 500, HEIGHT / 2 + 35);
    
    // Bottom bar
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, HEIGHT - 70, WIDTH, 70);
    
    // Member since
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('☀️ Member Since Feb 2026', 40, HEIGHT - 35);
    
    // "Want In?"
    ctx.fillStyle = textColors.accent;
    ctx.font = '500 22px Satoshi';
    ctx.textAlign = 'right';
    ctx.fillText('Want In? Ask Me For An Invite!', WIDTH - 40, HEIGHT - 35);
    
    // Save
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync('test-card-output.png', buffer);
    console.log('✓ Card saved to test-card-output.png');
}

generateTestCard().catch(console.error);
