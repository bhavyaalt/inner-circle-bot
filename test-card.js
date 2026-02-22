// Test card-v2 generation
require('dotenv').config();
const { generateMemberCard } = require('./src/card-v2');
const fs = require('fs');

// Mock bot object (won't have real profile photos)
const mockBot = {
    telegram: {
        getUserProfilePhotos: async () => ({ total_count: 0, photos: [] }),
        getFile: async () => ({})
    }
};

// Mock member data
const mockMember = {
    telegram_id: 123456789,
    telegram_name: 'Akhil',
    telegram_username: 'akhil_test',
    first_name: 'Akhil',
    is_founding_member: true,
    joined_at: new Date('2026-02-15')
};

async function test() {
    try {
        const buffer = await generateMemberCard(mockBot, mockMember);
        fs.writeFileSync('test-card-output.png', buffer);
        console.log('✓ Card saved to test-card-output.png');
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
