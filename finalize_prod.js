import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pb.myfamily.revolucionfutsal.es');

async function finalizeProduction() {
    try {
        console.log('Authenticating...');
        await pb.admins.authWithPassword('manuel.urba@gmail.com', 'E6k2VS5V');
        console.log('Admin authenticated.');

        const collections = await pb.collections.getFullList();
        const fId = collections.find(c => c.name === 'families')?.id;
        const mId = collections.find(c => c.name === 'members')?.id;

        const ensureCollection = async (config) => {
            const existing = collections.find(c => c.name === config.name);
            if (existing) {
                console.log(`Updating ${config.name}...`);
                return await pb.collections.update(existing.id, { ...config, type: 'base' });
            } else {
                console.log(`Creating ${config.name}...`);
                return await pb.collections.create({ ...config, type: 'base' });
            }
        };

        const ruleIsLoggedIn = '@request.auth.id != ""';
        // Rule: User must be in the family linked to the record
        const ruleSameFamily = '@collection.family_members.family ?= family && @collection.family_members.auth_user_id ?= @request.auth.id';
        const ruleSameFamilyID = '@collection.family_members.family ?= id && @collection.family_members.auth_user_id ?= @request.auth.id';

        // 1. Core Collections (ensure rules)
        await ensureCollection({
            name: 'family_members',
            listRule: ruleSameFamily,
            viewRule: ruleSameFamily,
            createRule: ruleIsLoggedIn,
            updateRule: ruleSameFamily, // Members can update their status if needed
        });

        await ensureCollection({
            name: 'families',
            listRule: ruleSameFamilyID,
            viewRule: ruleSameFamilyID,
            createRule: ruleIsLoggedIn,
            updateRule: ruleSameFamilyID,
        });

        await ensureCollection({
            name: 'members',
            listRule: ruleSameFamily,
            viewRule: ruleSameFamily,
            createRule: ruleIsLoggedIn,
            updateRule: ruleSameFamily,
        });

        // 2. Data Collections
        const dataColls = [
            {
                name: 'events',
                fields: [
                    { id: 'e_family', name: 'family', type: 'relation', required: true, collectionId: fId, maxSelect: 1 },
                    { id: 'e_title', name: 'title', type: 'text', required: true },
                    { id: 'e_start', name: 'starts_at', type: 'date', required: true },
                    { id: 'e_end', name: 'ends_at', type: 'date', required: true }
                ]
            },
            {
                name: 'tasks',
                fields: [
                    { id: 't_family', name: 'family', type: 'relation', required: true, collectionId: fId, maxSelect: 1 },
                    { id: 't_title', name: 'title', type: 'text', required: true },
                    { id: 't_status', name: 'status', type: 'select', values: ['inbox', 'planned', 'today', 'done', 'archived'] }
                ]
            },
            {
                name: 'shopping_items',
                fields: [
                    { id: 's_family', name: 'family', type: 'relation', required: true, collectionId: fId, maxSelect: 1 },
                    { id: 's_title', name: 'title', type: 'text', required: true },
                    { id: 's_status', name: 'status', type: 'select', values: ['open', 'done', 'skipped'] }
                ]
            },
            {
                name: 'event_conflicts',
                fields: [
                    { id: 'ec_f', name: 'family', type: 'relation', required: true, collectionId: fId, maxSelect: 1 },
                    { id: 'ec_e1', name: 'event1', type: 'relation', collectionId: collections.find(c => c.name === 'events')?.id, maxSelect: 1 },
                    { id: 'ec_e2', name: 'event2', type: 'relation', collectionId: collections.find(c => c.name === 'events')?.id, maxSelect: 1 },
                    { id: 'ec_start', name: 'overlap_start', type: 'date' }
                ]
            },
            {
                name: 'recurring_bills',
                fields: [
                    { id: 'rb_f', name: 'family', type: 'relation', required: true, collectionId: fId, maxSelect: 1 },
                    { id: 'rb_n', name: 'name', type: 'text', required: true },
                    { id: 'rb_a', name: 'amount_cents', type: 'number' },
                    { id: 'rb_c', name: 'currency', type: 'text' },
                    { id: 'rb_d', name: 'next_due_at', type: 'date' },
                    { id: 'rb_ia', name: 'is_active', type: 'bool' }
                ]
            }
        ];

        for (const config of dataColls) {
            await ensureCollection({
                ...config,
                listRule: ruleSameFamily,
                viewRule: ruleSameFamily,
                createRule: ruleSameFamily,
                updateRule: ruleSameFamily,
                deleteRule: ruleSameFamily,
            });
        }

        // 3. Optional/Newer Collections (ensure existence)
        const optionalColls = ['chat_messages', 'routines', 'reward_points', 'reward_goals', 'reward_items'];
        for (const name of optionalColls) {
            await ensureCollection({
                name,
                fields: [{ id: 'opt_f', name: 'family', type: 'relation', collectionId: fId, maxSelect: 1 }],
                listRule: ruleIsLoggedIn,
                viewRule: ruleIsLoggedIn,
                createRule: ruleIsLoggedIn,
            });
        }

        console.log('Production finalized successfully!');

    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) console.log('Data:', JSON.stringify(e.response.data));
    }
}

finalizeProduction();
