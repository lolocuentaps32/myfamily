import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pb.myfamily.revolucionfutsal.es');

async function fixV23Final() {
    try {
        console.log('Authenticating...');
        await pb.admins.authWithPassword('manuel.urba@gmail.com', 'E6k2VS5V');
        console.log('Admin authenticated.');

        const collections = await pb.collections.getFullList();

        // Delete in reverse order of dependencies
        const toDelete = ['family_members', 'members', 'families'];
        for (const name of toDelete) {
            const c = collections.find(x => x.name === name);
            if (c) {
                console.log(`Deleting ${name}...`);
                await pb.collections.delete(c.id);
            }
        }

        const families = await pb.collections.create({
            name: 'families',
            type: 'base',
            fields: [
                { id: 'f_name', name: 'name', type: 'text', required: true },
                { id: 'f_locale', name: 'locale', type: 'text' },
                { id: 'f_tz', name: 'timezone', type: 'text' }
            ]
        });
        console.log('Families created.');

        // 2. Recreate members
        const memOld = collections.find(x => x.name === 'members');
        if (memOld) await pb.collections.delete(memOld.id);

        const members = await pb.collections.create({
            name: 'members',
            type: 'base',
            fields: [
                { id: 'm_family', name: 'family', type: 'relation', required: true, collectionId: families.id, cascadeDelete: true, maxSelect: 1 },
                { id: 'm_name', name: 'display_name', type: 'text', required: true },
                { id: 'm_email', name: 'email', type: 'email' },
                { id: 'm_role', name: 'role', type: 'select', values: ['owner', 'admin', 'adult', 'child', 'toddler'], maxSelect: 1 },
                { id: 'm_status', name: 'status', type: 'select', values: ['active', 'invited', 'disabled'], maxSelect: 1 },
                { id: 'm_auth', name: 'auth_user_id', type: 'text' }
            ]
        });
        console.log('Members created.');

        // 3. Recreate family_members
        const fmOld = collections.find(x => x.name === 'family_members');
        if (fmOld) await pb.collections.delete(fmOld.id);

        await pb.collections.create({
            name: 'family_members',
            type: 'base',
            fields: [
                { id: 'fm_family', name: 'family', type: 'relation', required: true, collectionId: families.id, cascadeDelete: true, maxSelect: 1 },
                { id: 'fm_member', name: 'member', type: 'relation', required: true, collectionId: members.id, cascadeDelete: true, maxSelect: 1 },
                { id: 'fm_auth', name: 'auth_user_id', type: 'text', required: true },
                { id: 'fm_role', name: 'role', type: 'select', values: ['owner', 'admin', 'adult', 'child', 'toddler'], maxSelect: 1 },
                { id: 'fm_status', name: 'status', type: 'select', values: ['active', 'invited', 'disabled'], maxSelect: 1 }
            ]
        });
        console.log('Family members created.');

        // 4. Initialize Data
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
        console.log('Database initialized successfully!');

    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) console.log('Data:', JSON.stringify(e.response.data));
    }
}

fixV23Final();
