import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pb.myfamily.revolucionfutsal.es');

async function listUsers() {
    try {
        await pb.admins.authWithPassword('manuel.urba@gmail.com', 'E6k2VS5V');
        console.log('Authenticated as Admin');

        const users = await pb.collection('users').getFullList();
        console.log('--- USERS ---');
        users.forEach(u => {
            console.log(`- ${u.email} (ID: ${u.id}, Verified: ${u.verified})`);
        });

        // Also list members
        try {
            const members = await pb.collection('members').getFullList();
            console.log('\n--- MEMBERS ---');
            members.forEach(m => {
                console.log(`- ${m.display_name} (Email: ${m.email}, Status: ${m.status})`);
            });
        } catch (e) {
            console.log('No members collection found or empty.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

listUsers();
