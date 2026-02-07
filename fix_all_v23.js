import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pb.myfamily.revolucionfutsal.es');

async function fixAll() {
    try {
        console.log('Authenticating...');
        await pb.admins.authWithPassword('manuel.urba@gmail.com', 'E6k2VS5V');
        console.log('Admin authenticated.');

        const collections = await pb.collections.getFullList();

        // Delete in reverse order of dependencies
        const toDelete = [
            'feed_reactions', 'reward_redemptions', 'family_feed', 'reward_items',
            'reward_goals', 'reward_points', 'routines', 'event_conflicts',
            'recurring_bills', 'chat_messages', 'shopping_items', 'tasks',
            'events', 'family_members', 'members', 'families'
        ];
        for (const name of toDelete) {
            const c = collections.find(x => x.name === name);
            if (c) {
                console.log(`Deleting ${name}...`);
                try { await pb.collections.delete(c.id); } catch (e) { }
            }
        }

        const createColl = async (config) => {
            const res = await pb.collections.create({ ...config, type: 'base' });
            console.log(`Created ${config.name}`);
            return res;
        };

        const families = await createColl({
            name: 'families',
            fields: [
                { id: 'f_name', name: 'name', type: 'text', required: true, max: 255 },
                { id: 'f_locale', name: 'locale', type: 'text' },
                { id: 'f_tz', name: 'timezone', type: 'text' }
            ]
        });

        const members = await createColl({
            name: 'members',
            fields: [
                { id: 'm_family', name: 'family', type: 'relation', required: true, collectionId: families.id, cascadeDelete: true, maxSelect: 1 },
                { id: 'm_name', name: 'display_name', type: 'text', required: true },
                { id: 'm_email', name: 'email', type: 'email' },
                { id: 'm_role', name: 'role', type: 'select', values: ['owner', 'admin', 'adult', 'child', 'toddler'], maxSelect: 1 },
                { id: 'm_status', name: 'status', type: 'select', values: ['active', 'invited', 'disabled'], maxSelect: 1 },
                { id: 'm_auth', name: 'auth_user_id', type: 'text' }
            ]
        });

        await createColl({
            name: 'family_members',
            fields: [
                { id: 'fm_family', name: 'family', type: 'relation', required: true, collectionId: families.id, cascadeDelete: true, maxSelect: 1 },
                { id: 'fm_member', name: 'member', type: 'relation', required: true, collectionId: members.id, cascadeDelete: true, maxSelect: 1 },
                { id: 'fm_auth', name: 'auth_user_id', type: 'text', required: true },
                { id: 'fm_role', name: 'role', type: 'select', values: ['owner', 'admin', 'adult', 'child', 'toddler'], maxSelect: 1 },
                { id: 'fm_status', name: 'status', type: 'select', values: ['active', 'invited', 'disabled'], maxSelect: 1 }
            ]
        });

        const events = await createColl({
            name: 'events',
            fields: [
                { id: 'e_family', name: 'family', type: 'relation', required: true, collectionId: families.id, cascadeDelete: true, maxSelect: 1 },
                { id: 'e_title', name: 'title', type: 'text', required: true },
                { id: 'e_desc', name: 'description', type: 'text' },
                { id: 'e_loc', name: 'location', type: 'text' },
                { id: 'e_start', name: 'starts_at', type: 'date', required: true },
                { id: 'e_end', name: 'ends_at', type: 'date', required: true },
                { id: 'e_allday', name: 'all_day', type: 'bool' },
                { id: 'e_status', name: 'status', type: 'select', values: ['tentative', 'confirmed', 'cancelled'], maxSelect: 1 },
                { id: 'e_vis', name: 'visibility', type: 'select', values: ['private', 'participants', 'family', 'adults_only', 'admins_only'], maxSelect: 1 }
            ]
        });

        const tasks = await createColl({
            name: 'tasks',
            fields: [
                { id: 't_family', name: 'family', type: 'relation', required: true, collectionId: families.id, cascadeDelete: true, maxSelect: 1 },
                { id: 't_title', name: 'title', type: 'text', required: true },
                { id: 't_notes', name: 'notes', type: 'text' },
                { id: 't_status', name: 'status', type: 'select', values: ['inbox', 'planned', 'today', 'done', 'archived'], maxSelect: 1 },
                { id: 't_due', name: 'due_at', type: 'date' },
                { id: 't_prio', name: 'priority', type: 'number' },
                { id: 't_assignee', name: 'assignee', type: 'relation', collectionId: members.id, maxSelect: 1 }
            ]
        });

        await createColl({
            name: 'shopping_items',
            fields: [
                { id: 's_family', name: 'family', type: 'relation', required: true, collectionId: families.id, cascadeDelete: true, maxSelect: 1 },
                { id: 's_title', name: 'title', type: 'text', required: true },
                { id: 's_cat', name: 'category', type: 'text' },
                { id: 's_qty', name: 'quantity', type: 'text' },
                { id: 's_status', name: 'status', type: 'select', values: ['open', 'done', 'skipped'], maxSelect: 1 }
            ]
        });

        console.log('Collections recreated with direct properties!');

        // Initial Data
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
        console.log('Database finalized successfully!');

    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) console.log('Data:', JSON.stringify(e.response.data));
    }
}

fixAll();
