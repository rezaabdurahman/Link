-- Drop indexes
DROP INDEX IF EXISTS idx_room_members_active;
DROP INDEX IF EXISTS idx_chat_rooms_updated_at;
DROP INDEX IF EXISTS idx_chat_rooms_created_by;
DROP INDEX IF EXISTS idx_room_members_user_id;
DROP INDEX IF EXISTS idx_room_members_room_id;
DROP INDEX IF EXISTS idx_messages_user_id;
DROP INDEX IF EXISTS idx_messages_created_at;
DROP INDEX IF EXISTS idx_messages_room_id;

-- Drop tables in reverse order due to foreign key constraints
DROP TABLE IF EXISTS room_members;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS chat_rooms;
