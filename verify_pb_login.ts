import PocketBase from 'pocketbase';

async function testLogin(email: string, pass: string) {
    const pb = new PocketBase('http://127.0.0.1:8116');
    try {
        await pb.admins.authWithPassword(email, pass);
        console.log(`SUCCESS: ${email}:${pass}`);
        return true;
    } catch (e) {
        console.log(`FAILED: ${email}:${pass}`);
        return false;
    }
}

async function run() {
    const creds = [
        ['admin@example.com', '1234567890'],
        ['admin@copacrm.com', '1234567890'],
        ['lolo@example.com', '1234567890'],
        ['admin@revolucionfutsal.es', '1234567890']
    ];

    for (const [e, p] of creds) {
        if (await testLogin(e, p)) break;
    }
}

run();
