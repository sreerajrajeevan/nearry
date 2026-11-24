-- Smaller storage caps now that the app shrinks pictures before upload:
-- profile photos are ~40 KB at 512 px and plan photos a few hundred KB at
-- 1280 px. The caps leave room for older app versions (1024 / 1600 px).
begin;
update storage.buckets set file_size_limit = 2097152 where id = 'avatars';
update storage.buckets set file_size_limit = 5242880 where id = 'photos';
commit;
