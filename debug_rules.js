import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pb.myfamily.revolucionfutsal.es');

async function debugRulesAndData() {
    try {
        console.log('=== RULES CHECK ===');
        await pb.admins.authWithPassword('manuel.urba@gmail.com', 'E6k2VS5V');

        const collections = ['families', 'family_members', 'events', 'tasks'];
        for (const name of collections) {
            const c = await pb.collections.getOne(name);
            console.log(`\nCollection: ${name}`);
            console.log('List Rule:', c.listRule);
            console.log('Fields:', c.fields.map(f => f.name).join(', '));
        }

        console.log('\n=== DATA ACCESS SIMULATION ===');
        // Auth as user
        await pb.collection('users').authWithPassword('manuel.urba@gmail.com', 'E6k2VS5V');
        const user = pb.authStore.model;

        // 1. Get Active Family ID
        const fm = await pb.collection('family_members').getFirstListItem(`auth_user_id="${user.id}"`, { expand: 'family' });
        const activeFamilyId = fm.family;
        console.log(`Active Family: ${activeFamilyId}`);

        // 2. Simulate Today Page Queries
        try {
            console.log('Fetching events...');
            // Simple filter first
            const ev = await pb.collection('events').getList(1, 1, {
                filter: `family = "${activeFamilyId}"`
            });
            console.log(`Events: ${ev.totalItems} found.`);
        } catch (e) {
            console.error('Events Error:', e.status, e.message);
            console.dir(e.response);
        }

        try {
            console.log('Fetching tasks...');
            const t = await pb.collection('tasks').getList(1, 1, {
                filter: `family = "${activeFamilyId}"`
            });
            console.log(`Tasks: ${t.totalItems} found.`);
        } catch (e) {
            console.error('Tasks Error:', e.status, e.message);
            console.dir(e.response);
        }

    } catch (e) {
        console.error('Critical Error:', e.message);
    }
}

debugRulesAndData();
