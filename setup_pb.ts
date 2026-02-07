import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8116');

async function setup() {
    await pb.admins.authWithPassword('manuel.urba@gmail.com', 'E6k2VS5V');
    console.log('Authenticated as Admin');

    const collections = [
        {
            name: 'families',
            type: 'base',
            schema: [
                { name: 'name', type: 'text', required: true },
                { name: 'locale', type: 'text', required: false },
                { name: 'timezone', type: 'text', required: false }
            ]
        },
        {
            name: 'members',
            type: 'base',
            schema: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: 'families', cascadeDelete: true } },
                { name: 'display_name', type: 'text', required: true },
                { name: 'email', type: 'email', required: false },
                { name: 'dob', type: 'date', required: false },
                { name: 'avatar_url', type: 'url', required: false },
                { name: 'role', type: 'select', options: { values: ['owner', 'admin', 'adult', 'child', 'toddler'] } },
                { name: 'status', type: 'select', options: { values: ['active', 'invited', 'disabled'] } },
                { name: 'auth_user_id', type: 'text', required: false } // Supabase UUID reference
            ]
        },
        {
            name: 'family_members',
            type: 'base',
            schema: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: 'families', cascadeDelete: true } },
                { name: 'member', type: 'relation', required: true, options: { collectionId: 'members', cascadeDelete: true } },
                { name: 'auth_user_id', type: 'text', required: true },
                { name: 'role', type: 'select', options: { values: ['owner', 'admin', 'adult', 'child', 'toddler'] } },
                { name: 'status', type: 'select', options: { values: ['active', 'invited', 'disabled'] } }
            ]
        },
        {
            name: 'events',
            type: 'base',
            schema: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: 'families', cascadeDelete: true } },
                { name: 'title', type: 'text', required: true },
                { name: 'description', type: 'text', required: false },
                { name: 'location', type: 'text', required: false },
                { name: 'starts_at', type: 'date', required: true },
                { name: 'ends_at', type: 'date', required: true },
                { name: 'all_day', type: 'bool', required: false },
                { name: 'status', type: 'select', options: { values: ['tentative', 'confirmed', 'cancelled'] } },
                { name: 'visibility', type: 'select', options: { values: ['private', 'participants', 'family', 'adults_only', 'admins_only'] } },
                { name: 'created_by', type: 'relation', required: false, options: { collectionId: 'members' } }
            ]
        },
        {
            name: 'tasks',
            type: 'base',
            schema: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: 'families', cascadeDelete: true } },
                { name: 'title', type: 'text', required: true },
                { name: 'notes', type: 'text', required: false },
                { name: 'status', type: 'select', options: { values: ['inbox', 'planned', 'today', 'done', 'archived'] } },
                { name: 'due_at', type: 'date', required: false },
                { name: 'priority', type: 'number', required: false },
                { name: 'assignee', type: 'relation', required: false, options: { collectionId: 'members' } },
                { name: 'created_by', type: 'relation', required: false, options: { collectionId: 'members' } }
            ]
        },
        {
            name: 'shopping_items',
            type: 'base',
            schema: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: 'families', cascadeDelete: true } },
                { name: 'title', type: 'text', required: true },
                { name: 'category', type: 'text', required: false },
                { name: 'quantity', type: 'text', required: false },
                { name: 'status', type: 'select', options: { values: ['open', 'done', 'skipped'] } },
                { name: 'added_by', type: 'relation', required: false, options: { collectionId: 'members' } }
            ]
        },
        {
            name: 'chat_messages',
            type: 'base',
            schema: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: 'families', cascadeDelete: true } },
                { name: 'sender', type: 'relation', required: true, options: { collectionId: 'members' } },
                { name: 'content', type: 'text', required: false },
                { name: 'media_url', type: 'url', required: false },
                { name: 'media_type', type: 'text', required: false },
                { name: 'reply_to', type: 'relation', required: false, options: { collectionId: 'chat_messages' } },
                { name: 'is_deleted', type: 'bool', required: false }
            ]
        },
        {
            name: 'recurring_bills',
            type: 'base',
            schema: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: 'families', cascadeDelete: true } },
                { name: 'name', type: 'text', required: true },
                { name: 'amount_cents', type: 'number', required: true },
                { name: 'currency', type: 'text', required: true },
                { name: 'next_due_at', type: 'date', required: true },
                { name: 'is_active', type: 'bool', required: false }
            ]
        },
        {
            name: 'event_conflicts',
            type: 'base',
            schema: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: 'families', cascadeDelete: true } },
                { name: 'event1', type: 'relation', required: true, options: { collectionId: 'events' } },
                { name: 'event2', type: 'relation', required: true, options: { collectionId: 'events' } },
                { name: 'overlap_start', type: 'date', required: true },
                { name: 'overlap_end', type: 'date', required: true }
            ]
        },
        {
            name: 'routines',
            type: 'base',
            schema: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: 'families', cascadeDelete: true } },
                { name: 'name', type: 'text', required: true },
                { name: 'context', type: 'text', required: false },
                { name: 'is_active', type: 'bool', required: false }
            ]
        },
        {
            name: 'reward_points',
            type: 'base',
            schema: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: 'families', cascadeDelete: true } },
                { name: 'member', type: 'relation', required: true, options: { collectionId: 'members' } },
                { name: 'points', type: 'number', required: true },
                { name: 'reason', type: 'text', required: true },
                { name: 'creator', type: 'relation', required: false, options: { collectionId: 'members' } }
            ]
        },
        {
            name: 'reward_goals',
            type: 'base',
            schema: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: 'families', cascadeDelete: true } },
                { name: 'title', type: 'text', required: true },
                { name: 'description', type: 'text', required: false },
                { name: 'points', type: 'number', required: true },
                { name: 'icon', type: 'text', required: false },
                { name: 'is_recurring', type: 'bool', required: false },
                { name: 'is_active', type: 'bool', required: false },
                { name: 'creator', type: 'relation', required: false, options: { collectionId: 'members' } }
            ]
        },
        {
            name: 'reward_items',
            type: 'base',
            schema: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: 'families', cascadeDelete: true } },
                { name: 'title', type: 'text', required: true },
                { name: 'description', type: 'text', required: false },
                { name: 'points_cost', type: 'number', required: true },
                { name: 'icon', type: 'text', required: false },
                { name: 'stock', type: 'number', required: false },
                { name: 'is_active', type: 'bool', required: false },
                { name: 'creator', type: 'relation', required: false, options: { collectionId: 'members' } }
            ]
        },
        {
            name: 'family_feed',
            type: 'base',
            schema: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: 'families', cascadeDelete: true } },
                { name: 'author', type: 'relation', required: false, options: { collectionId: 'members' } },
                { name: 'content', type: 'text', required: true },
                { name: 'is_pinned', type: 'bool', required: false }
            ]
        },
        {
            name: 'reward_redemptions',
            type: 'base',
            schema: [
                { name: 'family', type: 'relation', required: true, options: { collectionId: 'families', cascadeDelete: true } },
                { name: 'member', type: 'relation', required: true, options: { collectionId: 'members' } },
                { name: 'reward_item', type: 'relation', required: true, options: { collectionId: 'reward_items' } },
                { name: 'points_spent', type: 'number', required: true },
                { name: 'status', type: 'text', required: true },
                { name: 'approved_by', type: 'relation', required: false, options: { collectionId: 'members' } },
                { name: 'approved_at', type: 'date', required: false }
            ]
        },
        {
            name: 'feed_reactions',
            type: 'base',
            schema: [
                { name: 'feed_item', type: 'relation', required: true, options: { collectionId: 'family_feed', cascadeDelete: true } },
                { name: 'member', type: 'relation', required: true, options: { collectionId: 'members' } },
                { name: 'emoji', type: 'text', required: true }
            ]
        }
    ];

    for (const config of collections) {
        try {
            await pb.collections.create(config);
            console.log(`Collection ${config.name} created`);
        } catch (e) {
            console.log(`Collection ${config.name} already exists or error:`, e.message);
        }
    }
}

setup();
