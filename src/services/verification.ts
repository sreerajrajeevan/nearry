import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { getSupabase, isDemoMode, isSupabaseConfigured } from './supabase';

const BUCKET = 'verification_docs';
const useMock = () => isDemoMode() || !isSupabaseConfigured;

export type VerificationState = 'unverified' | 'pending' | 'verified' | 'rejected';

/** Decode base64 to bytes without relying on atob. */
function base64ToBytes(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const a = chars.indexOf(clean[i]);
    const b = chars.indexOf(clean[i + 1]);
    const c = chars.indexOf(clean[i + 2]);
    const d = chars.indexOf(clean[i + 3]);
    bytes.push((a << 2) | (b >> 4));
    if (c !== 64) bytes.push(((b & 15) << 4) | (c >> 2));
    if (d !== 64) bytes.push(((c & 3) << 6) | d);
  }
  return new Uint8Array(bytes);
}

/**
 * Pick a proof document (business license, etc.) and upload it to private
 * storage, then mark the business as pending review. Returns the storage path.
 */
export async function submitVerificationDoc(businessId: string): Promise<string> {
  if (useMock()) throw new Error('Verification needs the backend configured.');

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
  });
  if (picked.canceled || !picked.assets[0]) throw new Error('No document selected.');
  const uri = picked.assets[0].uri;

  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const bytes = base64ToBytes(b64);
  const path = `${businessId}/proof-${Date.now()}.jpg`;

  const supabase = getSupabase()!;
  const { error: upError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (upError) throw new Error(upError.message);

  // Record the path and move to pending review (trigger allows this transition).
  const { error: dbError } = await supabase
    .from('profiles')
    .update({ verification_doc_path: path, verification_status: 'pending' })
    .eq('id', businessId);
  if (dbError) throw new Error(dbError.message);
  return path;
}

/** Current verification state for a business. */
export async function getVerificationState(businessId: string): Promise<{
  status: VerificationState;
  docPath?: string;
}> {
  if (useMock()) return { status: 'unverified' };
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('profiles')
    .select('verification_status, verification_doc_path')
    .eq('id', businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    status: (data?.verification_status as VerificationState) ?? 'unverified',
    docPath: (data?.verification_doc_path as string) ?? undefined,
  };
}

/** Claim an unclaimed venue for this business (sets venues.business_id). */
export async function claimVenue(venueId: string): Promise<void> {
  if (useMock()) throw new Error('Venue claiming needs the backend configured.');
  const supabase = getSupabase()!;
  const { error } = await supabase.rpc('claim_venue', { p_venue_id: venueId });
  if (error) throw new Error(error.message);
}
