import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pb.myfamily.revolucionfutsal.es');
const FAMILY_ID = 'q17pslwbji1pxlk';

async function run() {
    console.log('--- PocketBase Script Started (ESM) ---');
    try {
        console.log('Authenticating as admin...');
        await pb.admins.authWithPassword('manuel.urba@gmail.com', 'E6k2VS5V');
        console.log('Admin authenticated.');

        // 1. Update members collection to add gender field
        const coll = await pb.collections.getOne('members');
        const fields = coll.fields || coll.schema || [];
        if (!fields.find(f => f.name === 'gender')) {
            console.log('Adding gender field to members collection...');
            fields.push({
                name: 'gender',
                type: 'select',
                values: ['man', 'woman', 'boy', 'girl'],
                required: false
            });
            await pb.collections.update(coll.id, { fields });
            console.log('Gender field added.');
        } else {
            console.log('Gender field already exists.');
        }

        const membersToAdd = [
            { name: 'Mamá', email: 'castylla@gmail.com', pass: 'castylla1987', gender: 'woman', role: 'adult' },
            { name: 'Blanca', email: 'blanca.urbano.castilla@gmail.com', pass: 'blanca2016', gender: 'girl', role: 'child' },
            { name: 'Marco', email: 'marco.urbano.castilla@gmail.com', pass: 'marco2022', gender: 'boy', role: 'child' }
        ];

        for (const m of membersToAdd) {
            console.log(`\n--- Processing ${m.name} ---`);

            // Check if user already exists
            let user;
            try {
                console.log(`Creating auth user: ${m.email}`);
                user = await pb.collection('users').create({
                    email: m.email,
                    password: m.pass,
                    passwordConfirm: m.pass,
                    name: m.name,
                    emailVisibility: true
                });
                console.log(`User created with ID: ${user.id}`);
            } catch (err) {
                console.log(`User creation note: ${err.message}`);
                try {
                    user = await pb.collection('users').getFirstListItem(`email="${m.email}"`);
                    console.log(`Existing user found with ID: ${user.id}`);
                } catch (e2) {
                    console.error(`Could not create or find user ${m.email}: ${e2.message}`);
                    continue;
                }
            }

            // Create member record
            try {
                console.log(`Creating member record for ${m.name}`);
                const member = await pb.collection('members').create({
                    display_name: m.name,
                    gender: m.gender,
                    email: m.email,
                    family: FAMILY_ID,
                    role: m.role,
                    status: 'active',
                    auth_user_id: user.id
                });
                console.log(`Member record created with ID: ${member.id}`);

                // Link in family_members collection
                console.log(`Linking ${m.name} to family ${FAMILY_ID}`);
                await pb.collection('family_members').create({
                    family: FAMILY_ID,
                    member: member.id,
                    auth_user_id: user.id,
                    role: m.role,
                    status: 'active'
                });
                console.log(`${m.name} linkage complete.`);
            } catch (err) {
                console.error(`Error processing member data for ${m.name}: ${err.message}`);
                if (err.response) console.log('Response data:', JSON.stringify(err.response.data));
            }
        }

        console.log('\nAll additions complete!');
    } catch (e) {
        console.error('Fatal Error:', e.message);
        if (e.response) console.log('Payload:', JSON.stringify(e.response.data));
    }
}

run();
