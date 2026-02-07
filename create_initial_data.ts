import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8116');

// Credentials provided for admin/user
const EMAIL = 'manuel.urba@gmail.com';
const PASS = 'E6k2VS5V';

async function main() {
    try {
        // 1. Auth as Admin
        await pb.admins.authWithPassword(EMAIL, PASS);
        console.log('✅ Authenticated as Admin');

        // 2. Find the user (auth record)
        const user = await pb.collection('users').getFirstListItem(`email="${EMAIL}"`);
        console.log(`✅ Found User: ${user.id}`);

        // 3. Create Family
        // Check if exists first to avoid dupes if re-run
        let family;
        try {
            family = await pb.collection('families').getFirstListItem('name="Urba"');
            console.log(`ℹ️ Family "Urba" already exists: ${family.id}`);
        } catch (e) {
            family = await pb.collection('families').create({
                name: 'Urba',
                timezone: 'Europe/Madrid',
                locale: 'es'
            });
            console.log(`✅ Created Family "Urba": ${family.id}`);
        }

        // 4. Create Member "Papá"
        let member;
        try {
            member = await pb.collection('members').getFirstListItem(`email="${EMAIL}" && family="${family.id}"`);
            console.log(`ℹ️ Member "Papá" already exists: ${member.id}`);
        } catch {
            member = await pb.collection('members').create({
                family: family.id,
                display_name: 'Papá',
                email: EMAIL,
                role: 'owner',
                status: 'active',
                auth_user_id: user.id
            });
            console.log(`✅ Created Member "Papá": ${member.id}`);
        }

        // 5. Create Family Member linkage
        try {
            const fm = await pb.collection('family_members').getFirstListItem(`family="${family.id}" && member="${member.id}"`);
            console.log(`ℹ️ Family-Member link already exists.`);
        } catch {
            await pb.collection('family_members').create({
                family: family.id,
                member: member.id,
                auth_user_id: user.id,
                role: 'owner',
                status: 'active'
            });
            console.log(`✅ Linked Member to Family.`);
        }

    } catch (err) {
        console.error('❌ Error:', err);
    }
}

main();
