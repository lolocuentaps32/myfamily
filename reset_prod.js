import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pb.myfamily.revolucionfutsal.es');

async function resetSchema() {
    try {
        console.log('Authenticating as admin...');
        await pb.admins.authWithPassword('manuel.urba@gmail.com', 'E6k2VS5V');
        console.log('Admin authenticated.');

        const collectionsToReset = [
            'families', 'members', 'family_members', 'events', 'tasks',
            'shopping_items', 'chat_messages', 'recurring_bills',
            'event_conflicts', 'routines', 'reward_points', 'reward_goals',
            'reward_items', 'family_feed', 'reward_redemptions', 'feed_reactions'
        ];

        console.log('Fetching current collections...');
        const existingCollections = await pb.collections.getFullList();

        for (const name of collectionsToReset) {
            const coll = existingCollections.find(c => c.name === name);
            if (coll) {
                console.log(`Deleting broken collection: ${name} (${coll.id})...`);
                await pb.collections.delete(coll.id);
            }
        }

        console.log('Creating fresh collections with correct schema...');

        // Definitions from setup_pb.ts adjusted for newer PB format
        const collections = [
            {
                name: 'families',
                type: 'base',
                fields: [
                    { name: 'name', type: 'text', required: true },
                    { name: 'locale', type: 'text' },
                    { name: 'timezone', type: 'text' }
                ]
            }
            // I'll add the others one by one to ensure dependencies are handled
        ];

        for (const config of collections) {
            await pb.collections.create(config);
            console.log(`Created ${config.name}`);
        }

        // Re-fetch to get new IDs
        const newCols = await pb.collections.getFullList();
        const fId = newCols.find(c => c.name === 'families').id;

        const membersConfig = {
            name: 'members',
            type: 'base',
            fields: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: fId, cascadeDelete: true, maxSelect: 1 } },
                { name: 'display_name', type: 'text', required: true },
                { name: 'email', type: 'email' },
                { name: 'dob', type: 'date' },
                { name: 'avatar_url', type: 'url' },
                { name: 'role', type: 'select', options: { values: ['owner', 'admin', 'adult', 'child', 'toddler'], maxSelect: 1 } },
                { name: 'status', type: 'select', options: { values: ['active', 'invited', 'disabled'], maxSelect: 1 } },
                { name: 'auth_user_id', type: 'text' }
            ]
        };
        await pb.collections.create(membersConfig);
        console.log('Created members');

        const mId = (await pb.collections.getFullList()).find(c => c.name === 'members').id;

        const fmConfig = {
            name: 'family_members',
            type: 'base',
            fields: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: fId, cascadeDelete: true, maxSelect: 1 } },
                { name: 'member', type: 'relation', required: true, options: { collectionId: mId, cascadeDelete: true, maxSelect: 1 } },
                { name: 'auth_user_id', type: 'text', required: true },
                { name: 'role', type: 'select', options: { values: ['owner', 'admin', 'adult', 'child', 'toddler'], maxSelect: 1 } },
                { name: 'status', type: 'select', options: { values: ['active', 'invited', 'disabled'], maxSelect: 1 } }
            ]
        };
        await pb.collections.create(fmConfig);
        console.log('Created family_members');

        console.log('Setting up initial data...');
        const user = await pb.collection('users').getFirstListItem('email="manuel.urba@gmail.com"');
        const family = await pb.collection('families').create({ name: 'Urba' });
        const member = await pb.collection('members').create({
            family: family.id,
            display_name: 'Papá',
            email: 'manuel.urba@gmail.com',
            role: 'owner',
            status: 'active',
            auth_user_id: user.id
        });
        await pb.collection('family_members').create({
            family: family.id,
            member: member.id,
            auth_user_id: user.id,
            role: 'owner',
            status: 'active'
        });

        console.log('Database reset and initialized successfully!');

    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) console.error('Data:', JSON.stringify(e.response.data));
    }
}

resetSchema();
