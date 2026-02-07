import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pb.myfamily.revolucionfutsal.es');

async function testV23() {
    try {
        await pb.admins.authWithPassword('manuel.urba@gmail.com', 'E6k2VS5V');
        const collections = await pb.collections.getFullList();

        // Delete members if it exists
        const m = collections.find(x => x.name === 'members');
        if (m) await pb.collections.delete(m.id);

        const fId = collections.find(x => x.name === 'families')?.id;

        console.log('Testing direct properties...');
        await pb.collections.create({
            name: 'members',
            type: 'base',
            fields: [
                { id: 'm_family', name: 'family', type: 'relation', required: true, collectionId: fId, cascadeDelete: true, maxSelect: 1 },
                { id: 'm_name', name: 'display_name', type: 'text', required: true },
                { id: 'm_email', name: 'email', type: 'email' },
                { id: 'm_role', name: 'role', type: 'select', values: ['owner', 'admin', 'adult', 'child', 'toddler'], maxSelect: 1 },
                { id: 'm_status', name: 'status', type: 'select', values: ['active', 'invited', 'disabled'], maxSelect: 1 },
                { id: 'm_auth', name: 'auth_user_id', type: 'text' }
            ]
        });
        console.log('Success with direct properties!');

    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) console.log('Data:', JSON.stringify(e.response.data));
    }
}

testV23();
