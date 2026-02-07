import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pb.myfamily.revolucionfutsal.es');

async function fixSchema() {
    try {
        console.log('Authenticating as admin...');
        await pb.admins.authWithPassword('manuel.urba@gmail.com', 'E6k2VS5V');
        console.log('Admin authenticated.');

        const existingCollections = await pb.collections.getFullList();

        const familiesId = existingCollections.find(c => c.name === 'families')?.id;
        const membersId = existingCollections.find(c => c.name === 'members')?.id;

        const schemaConfig = [
            {
                name: 'families',
                fields: [
                    { name: 'name', type: 'text', required: true },
                    { name: 'locale', type: 'text' },
                    { name: 'timezone', type: 'text' }
                ]
            },
            {
                name: 'members',
                fields: [
                    { name: 'family', type: 'relation', required: true, options: { collectionId: familiesId, cascadeDelete: true, maxSelect: 1 } },
                    { name: 'display_name', type: 'text', required: true },
                    { name: 'email', type: 'email' },
                    { name: 'dob', type: 'date' },
                    { name: 'avatar_url', type: 'url' },
                    { name: 'role', type: 'select', options: { values: ['owner', 'admin', 'adult', 'child', 'toddler'], maxSelect: 1 } },
                    { name: 'status', type: 'select', options: { values: ['active', 'invited', 'disabled'], maxSelect: 1 } },
                    { name: 'auth_user_id', type: 'text' }
                ]
            },
            {
                name: 'family_members',
                fields: [
                    { name: 'family', type: 'relation', required: true, options: { collectionId: familiesId, cascadeDelete: true, maxSelect: 1 } },
                    { name: 'member', type: 'relation', required: true, options: { collectionId: membersId, cascadeDelete: true, maxSelect: 1 } },
                    { name: 'auth_user_id', type: 'text', required: true },
                    { name: 'role', type: 'select', options: { values: ['owner', 'admin', 'adult', 'child', 'toddler'], maxSelect: 1 } },
                    { name: 'status', type: 'select', options: { values: ['active', 'invited', 'disabled'], maxSelect: 1 } }
                ]
            }
        ];

        for (const config of schemaConfig) {
            const coll = existingCollections.find(c => c.name === config.name);
            if (coll) {
                console.log(`Updating collection: ${config.name} (${coll.id})...`);
                await pb.collections.update(coll.id, config);
                console.log(`Collection ${config.name} updated successfully.`);
            } else {
                console.log(`Collection ${config.name} NOT FOUND, creating...`);
                await pb.collections.create({ ...config, type: 'base' });
                console.log(`Collection ${config.name} created.`);
            }
        }

        console.log('--- FINAL DIAGNOSTIC ---');
        const email = 'manuel.urba@gmail.com';
        const user = await pb.collection('users').getFirstListItem(`email="${email}"`);
        console.log('User ID:', user.id);

        let family;
        try {
            family = await pb.collection('families').getFirstListItem(`name="Urba"`);
        } catch (e) {
            family = await pb.collection('families').create({ name: 'Urba' });
        }
        console.log('Family ID:', family.id);

        const linkage = await pb.collection('family_members').getFullList({
            filter: `auth_user_id = "${user.id}"`
        });
        if (linkage.length === 0) {
            await pb.collection('family_members').create({
                family: family.id,
                auth_user_id: user.id,
                status: 'active',
                role: 'owner'
            });
            console.log('Linkage created.');
        } else {
            console.log('Linkage already exists.');
        }

    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) console.error('Data:', JSON.stringify(e.response.data));
    }
}

fixSchema();
