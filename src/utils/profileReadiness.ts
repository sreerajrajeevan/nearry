import type { Profile, NeedPost } from "../services/mappers";
import { POLICY_VERSION } from "./legal";

/** Server requirements can change while a signed-in profile is cached. */
export function isProfileCompletionError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "";
  return (
    /complete your profile with name, gender and age/i.test(message) ||
    /personal onboarding required/i.test(message)
  );
}

export function personalProfileReady(
  profile: Profile | null | undefined,
): boolean {
  return (
    !!profile &&
    profile.displayName.trim().length >= 2 &&
    profile.displayName.trim().length <= 40 &&
    profile.accountType === "personal" &&
    profile.onboardingCompleted &&
    !!profile.roleSelected &&
    ["male", "female", "other"].includes(profile.gender ?? "") &&
    Number.isInteger(profile.age) &&
    profile.age! >= 18 &&
    profile.age! <= 100 &&
    profile.termsVersion === POLICY_VERSION
  );
}
export function matchesPostAudience(
  post: Pick<NeedPost, "genderPreference">,
  gender?: Profile["gender"],
): boolean {
  return (
    !post.genderPreference ||
    post.genderPreference === "any" ||
    post.genderPreference === gender
  );
}
export function validatePersonalDetails(
  name: string,
  gender: string | undefined,
  age: string,
): string | null {
  if (name.trim().length < 2 || name.trim().length > 40)
    return "Enter your name using 2–40 characters.";
  if (!["male", "female", "other"].includes(gender ?? ""))
    return "Select your gender.";
  if (!/^\d{2,3}$/.test(age.trim()) || Number(age) < 18 || Number(age) > 100)
    return "Enter your age, between 18 and 100. Nearry is for adults.";
  return null;
}
