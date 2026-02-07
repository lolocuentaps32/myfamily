import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pb.myfamily.revolucionfutsal.es');

async function checkAndCreateUser() {
    try {
        console.log('Attempting to authenticate as admin...');
        await pb.admins.authWithPassword('manuel.urba@gmail.com', 'E6k2VS5V');
        console.log('Admin authenticated successfully.');

        const collections = await pb.collections.getFullList();
        console.log('--- Collections ---');
        collections.forEach(c => {
            console.log(`- ${c.name} (ID: ${c.id})`);
            if (c.fields) {
                console.log('  Fields:', c.fields.map(f => f.name).join(', '));
            } else if (c.schema) {
                console.log('  Schema fields:', c.schema.map(f => f.name).join(', '));
            }
        });

        const fmColl = collections.find(c => c.name === 'family_members');
        if (!fmColl) {
            console.log('family_members collection NOT FOUND!');
        }

        const email = 'manuel.urba@gmail.com';
        let user;

        try {
            user = await pb.collection('users').getFirstListItem(`email="${email}"`);
            console.log('User exists, ID:', user.id, 'Verified:', user.verified);
            await pb.collection('users').update(user.id, {
                password: 'E6k2VS5V',
                passwordConfirm: 'E6k2VS5V',
                verified: true,
            });
            console.log('User password reset and verified.');
        } catch (e) {
            console.log('User not found, creating...');
            user = await pb.collection('users').create({
                email: email,
                password: 'E6k2VS5V',
                passwordConfirm: 'E6k2VS5V',
                name: 'Manuel',
                verified: true,
            });
            console.log('User created successfully:', user.id);
        }

        // Check if "Urba" family exists
        let family;
        try {
            family = await pb.collection('families').getFirstListItem('name="Urba"');
            console.log('Family "Urba" exists, ID:', family.id);
        } catch (e) {
            console.log('Family "Urba" not found, creating...');
            family = await pb.collection('families').create({ name: 'Urba' });
            console.log('Family "Urba" created, ID:', family.id);
        }

        // Check family linkage
        const linkage = await pb.collection('family_members').getFullList({
            filter: `auth_user_id = "${user.id}"`
        });

        if (linkage.length > 0) {
            console.log('Family linkage already exists:', linkage.map(l => l.id).join(', '));
        } else {
            console.log('Creating linkage...');
            await pb.collection('family_members').create({
                family: family.id,
                auth_user_id: user.id,
                status: 'active',
                role: 'owner'
            });
            console.log('Linkage created successfully.');
        }

    } catch (e) {
        console.error('Error during diagnostic:', e.message);
        if (e.response) {
            console.error('Data:', JSON.stringify(e.response.data));
        }
    }
}

checkAndCreateUser();
