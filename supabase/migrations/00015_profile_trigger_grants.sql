-- 00015: the guard_post_edit() trigger (00011) runs as the invoking
-- authenticated user and reads profiles.account_type + onboarding_completed,
-- but 00011 granted only (id, display_name, avatar_url, bio, business_name,
-- verification_status) -> post publish failed with
-- "permission denied for table profiles". Grant the two trigger columns.
grant select (account_type, onboarding_completed) on profiles to authenticated;
