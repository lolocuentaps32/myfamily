import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pb.myfamily.revolucionfutsal.es');

async function fixRules() {
    try {
        console.log('Authenticating as admin...');
        await pb.admins.authWithPassword('manuel.urba@gmail.com', 'E6k2VS5V');
        console.log('Admin authenticated.');

        const collections = [
            {
                name: 'family_members',
                listRule: 'auth_user_id = @request.auth.id',
                viewRule: 'auth_user_id = @request.auth.id',
            },
            {
                name: 'families',
                listRule: '@collection.family_members.family ?= id && @collection.family_members.auth_user_id ?= @request.auth.id',
                viewRule: '@collection.family_members.family ?= id && @collection.family_members.auth_user_id ?= @request.auth.id',
            },
            {
                name: 'members',
                listRule: '@collection.family_members.family ?= family && @collection.family_members.auth_user_id ?= @request.auth.id',
                viewRule: '@collection.family_members.family ?= family && @collection.family_members.auth_user_id ?= @request.auth.id',
            }
        ];

        // Also add generic rules for other data collections
        const otherColls = ['events', 'tasks', 'shopping_items'];
        for (const name of otherColls) {
            collections.push({
                name,
                listRule: `@collection.family_members.family ?= family && @collection.family_members.auth_user_id ?= @request.auth.id`,
                viewRule: `@collection.family_members.family ?= family && @collection.family_members.auth_user_id ?= @request.auth.id`,
                createRule: `@collection.family_members.family ?= family && @collection.family_members.auth_user_id ?= @request.auth.id`,
                updateRule: `@collection.family_members.family ?= family && @collection.family_members.auth_user_id ?= @request.auth.id`,
                deleteRule: `@collection.family_members.family ?= family && @collection.family_members.auth_user_id ?= @request.auth.id`,
            });
        }

        for (const config of collections) {
            try {
                const coll = await pb.collections.getOne(config.name);
                console.log(`Updating rules for ${config.name}...`);
                await pb.collections.update(coll.id, config);
                console.log(`Rules for ${config.name} updated.`);
            } catch (e) {
                console.log(`Error updating ${config.name}:`, e.message);
            }
        }

        console.log('API Rules fixed successfully!');

    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) console.log('Data:', JSON.stringify(e.response.data));
    }
}

fixRules();
