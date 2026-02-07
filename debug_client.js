import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pb.myfamily.revolucionfutsal.es');

async function debugClient() {
    try {
        console.log('Authenticating as user...');
        await pb.collection('users').authWithPassword('manuel.urba@gmail.com', 'E6k2VS5V');
        const user = pb.authStore.model;
        console.log('User ID:', user.id);

        console.log('Fetching family_members with expand...');
        const records = await pb.collection('family_members').getFullList({
            filter: `auth_user_id = "${user.id}" && status = "active"`,
            expand: 'family,member'
        });

        console.log('Records found:', records.length);
        if (records.length > 0) {
            const r = records[0];
            console.log('Record ID:', r.id);
            console.log('Role:', r.role);
            console.log('Family ID:', r.family);
            console.log('Expand Family:', JSON.stringify(r.expand?.family));
            console.log('Expand Member:', JSON.stringify(r.expand?.member));
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

debugClient();
