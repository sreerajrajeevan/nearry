import type { Profile } from "./mappers";
import {
  ageFromBirthday,
  onboardingPreferences,
  type OnboardingPreferences,
} from "../utils/onboarding";
import { validatePersonalDetails } from "../utils/profileReadiness";
import { isValidBusinessName } from "../utils/validation";

export type OnboardingDraft = {
  step: number;
  name: string;
  dob: string;
  gender?: "male" | "female" | "other";
  businessName: string;
  category: string;
  area: string;
  interests: string[];
  preferences: OnboardingPreferences;
  photo: string | null;
  uploadedPhoto: string | null;
};
type Role = "personal" | "business";
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
const MAX_AGE = 30 * 86400000;
const keyFor = (id: string, role: Role) =>
  `nearry.onboardingDraft.v1.${encodeURIComponent(id)}.${role}`;

export function initialOnboardingDraft(
  profile: Profile | null,
): OnboardingDraft {
  return {
    step: 0,
    name: profile?.displayName ?? "",
    dob: "",
    gender: profile?.gender,
    businessName: profile?.businessName ?? "",
    category: String(profile?.businessDetails.category ?? ""),
    area: String(profile?.businessDetails.area ?? ""),
    interests: profile?.interests ?? [],
    preferences: onboardingPreferences(profile?.onboardingPreferences),
    photo: null,
    uploadedPhoto: null,
  };
}

/** Restore progress, but never skip an invalid or incomplete required page. */
export function onboardingResumeStep(
  draft: OnboardingDraft,
  role: Role,
  savedAge?: number,
): number {
  const complete =
    role === "business"
      ? isValidBusinessName(draft.businessName) &&
        draft.name.trim().length >= 2 &&
        draft.name.trim().length <= 40 &&
        !!draft.category
      : !validatePersonalDetails(
          draft.name,
          draft.gender,
          String(
            draft.dob ? (ageFromBirthday(draft.dob) ?? "") : (savedAge ?? ""),
          ),
        );
  if (!complete) return 0;
  const step = Math.max(
    0,
    Math.min(role === "business" ? 2 : 4, Math.floor(draft.step)),
  );
  return role === "business" && step > 1 && !draft.area.trim() ? 1 : step;
}

function parseDraft(
  raw: string,
  id: string,
  role: Role,
  now: number,
): OnboardingDraft | null {
  try {
    const row = JSON.parse(raw);
    if (
      !row ||
      row.version !== 1 ||
      row.id !== id ||
      row.role !== role ||
      !Number.isFinite(row.updatedAt) ||
      row.updatedAt > now ||
      now - row.updatedAt >= MAX_AGE ||
      !row.draft ||
      typeof row.draft !== "object"
    )
      return null;
    const d = row.draft;
    const text = (key: string, limit: number) =>
      typeof d[key] === "string" ? d[key].slice(0, limit) : "";
    const photo = (key: string) =>
      typeof d[key] === "string" &&
      d[key].length <= 2_000_000 &&
      /^(file:\/\/|blob:|data:image\/|https:\/\/)/.test(d[key])
        ? d[key]
        : null;
    return {
      step: Number.isInteger(d.step)
        ? Math.max(0, Math.min(role === "business" ? 2 : 4, d.step))
        : 0,
      name: text("name", 40),
      dob: text("dob", 10),
      gender: ["male", "female", "other"].includes(d.gender)
        ? d.gender
        : undefined,
      businessName: text("businessName", 80),
      category: text("category", 80),
      area: text("area", 200),
      interests: Array.isArray(d.interests)
        ? [
            ...new Set<string>(
              d.interests.filter(
                (v: unknown): v is string =>
                  typeof v === "string" && v.length <= 80,
              ),
            ),
          ].slice(0, 30)
        : [],
      preferences: onboardingPreferences(d.preferences, now),
      photo: photo("photo"),
      uploadedPhoto: photo("uploadedPhoto"),
    };
  } catch {
    return null;
  }
}

/** Ordered, account-scoped device storage. Old screen writes cannot revive a cleared draft. */
export class OnboardingDraftStore {
  private revisions = new Map<string, number>();
  private queues = new Map<string, Promise<unknown>>();
  constructor(
    private storage: Storage,
    private clock = Date.now,
  ) {}
  private enqueue<T>(key: string, work: () => Promise<T>): Promise<T> {
    const next = (this.queues.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(work);
    this.queues.set(key, next);
    void next
      .finally(() => {
        if (this.queues.get(key) === next) this.queues.delete(key);
      })
      .catch(() => {});
    return next;
  }
  open(id: string, role: Role) {
    const key = keyFor(id, role),
      revision = this.revisions.get(key) ?? 0;
    const current = () => (this.revisions.get(key) ?? 0) === revision;
    return {
      read: () =>
        this.enqueue(key, async () => {
          if (!current()) return null;
          const raw = await this.storage.getItem(key);
          if (!current() || !raw) return null;
          const draft = parseDraft(raw, id, role, this.clock());
          if (!draft) await this.storage.removeItem(key);
          return draft;
        }),
      save: (draft: OnboardingDraft) => {
        // Whitelist fields: neither consent nor auth credentials belong in a draft.
        const {
          step,
          name,
          dob,
          gender,
          businessName,
          category,
          area,
          interests,
          preferences,
          photo,
          uploadedPhoto,
        } = draft;
        const raw = JSON.stringify({
          version: 1,
          id,
          role,
          updatedAt: this.clock(),
          draft: {
            step,
            name,
            dob,
            gender,
            businessName,
            category,
            area,
            interests,
            preferences,
            photo,
            uploadedPhoto,
          },
        });
        return this.enqueue(key, async () => {
          if (!current()) return false;
          await this.storage.setItem(key, raw);
          return current();
        });
      },
    };
  }
  async clear(id: string) {
    await Promise.all(
      (["personal", "business"] as const).map((role) => {
        const key = keyFor(id, role);
        this.revisions.set(key, (this.revisions.get(key) ?? 0) + 1);
        return this.enqueue(key, () => this.storage.removeItem(key));
      }),
    );
  }
}
