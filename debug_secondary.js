import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pb.myfamily.revolucionfutsal.es');

async function debugSecondary() {
    try {
        console.log('=== AUTH ===');
        await pb.collection('users').authWithPassword('manuel.urba@gmail.com', 'E6k2VS5V');
        const user = pb.authStore.model;

        // Get Active Family
        const fm = await pb.collection('family_members').getFirstListItem(`auth_user_id="${user.id}"`, { expand: 'family' });
        const activeFamilyId = fm.family;
        console.log(`Active Family: ${activeFamilyId}`);

        // 3. Shopping Items
        try {
            console.log('\nFetching shopping_items...');
            const shop = await pb.collection('shopping_items').getList(1, 1, {
                filter: `family = "${activeFamilyId}" && status = "open"`
            });
            console.log(`Shopping: ${shop.totalItems} found.`);
        } catch (e) {
            console.error('Shopping Error:', e.status, e.message);
            console.dir(e.response);
        }

        // 4. Event Conflicts
        try {
            console.log('\nFetching event_conflicts...');
            const range = { start: '2026-02-08 00:00:00', end: '2026-02-09 00:00:00' };
            const conf = await pb.collection('event_conflicts').getList(1, 1, {
                filter: `family = "${activeFamilyId}" && overlap_start >= "${range.start}" && overlap_start < "${range.end}"`
            });
            console.log(`Conflicts: ${conf.totalItems} found.`);
        } catch (e) {
            console.error('Conflicts Error:', e.status, e.message);
            console.dir(e.response);
        }

        // 5. Recurring Bills
        try {
            console.log('\nFetching recurring_bills...');
            const weekFromNow = '2026-02-15 00:00:00';
            const bills = await pb.collection('recurring_bills').getList(1, 10, {
                filter: `family = "${activeFamilyId}" && is_active = true && next_due_at <= "${weekFromNow}"`,
                sort: 'next_due_at'
            });
            console.log(`Bills: ${bills.totalItems} found.`);
        } catch (e) {
            console.error('Bills Error:', e.status, e.message);
            console.dir(e.response);
        }

    } catch (e) {
        console.error('Critical Error:', e.message);
    }
}

debugSecondary();
