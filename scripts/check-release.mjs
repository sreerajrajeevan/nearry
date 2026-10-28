import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const assets = [
  "icon",
  "adaptive-icon",
  "adaptive-monochrome",
  "splash",
  "splash-android",
  "favicon",
];
const placeholderHost = (host) =>
  /(^|\.)(localhost|example\.(com|org|net)|invalid|test)$/.test(host) ||
  /^(127\.|0\.|192\.168\.|10\.)/.test(host);

/** Return field names and instructions only; never log key values. */
export function releaseProblems(
  env,
  assetExists = (name) => existsSync(resolve(root, `assets/${name}.png`)),
) {
  const problems = [];
  try {
    const url = new URL(env.EXPO_PUBLIC_SUPABASE_URL ?? "");
    if (
      url.protocol !== "https:" ||
      placeholderHost(url.hostname) ||
      url.username ||
      url.password
    )
      throw new Error();
  } catch {
    problems.push(
      "EXPO_PUBLIC_SUPABASE_URL must be your real HTTPS backend URL.",
    );
  }
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (key.split(".").length === 3) {
    try {
      publicKey =
        JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role === "anon";
    } catch {}
  }
  if (!publicKey)
    problems.push(
      "EXPO_PUBLIC_SUPABASE_ANON_KEY must be an anon/publishable key, never a service-role or secret key.",
    );
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ?? "",
    )
  )
    problems.push(
      "EXPO_PUBLIC_EAS_PROJECT_ID must be the UUID of your Expo project.",
    );
  const owner = env.EXPO_PUBLIC_LEGAL_OWNER?.trim() ?? "";
  if (!owner || /^(your |example|todo|change.?me)/i.test(owner))
    problems.push(
      "EXPO_PUBLIC_LEGAL_OWNER must identify the actual app operator.",
    );
  const email = env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    placeholderHost(email.split("@")[1])
  )
    problems.push(
      "EXPO_PUBLIC_SUPPORT_EMAIL must be a real monitored email address.",
    );
  if (assets.some((name) => !assetExists(name)))
    problems.push(
      "Generate the app icons and splash images with npm run assets before building.",
    );
  return problems;
}

export function checkRelease(env = process.env) {
  const problems = releaseProblems(env);
  let firebase;
  try {
    firebase = JSON.parse(readFileSync(env.GOOGLE_SERVICES_JSON, "utf8"));
  } catch {}
  problems.push(...firebaseProblems(firebase));
  if (problems.length)
    throw new Error(`Release setup incomplete:\n- ${problems.join("\n- ")}`);
  console.log(
    "Release public configuration and generated assets are present. Signing, live backend and device checks remain separate.",
  );
}

export function firebaseProblems(config) {
  if (
    !config?.project_info?.project_number ||
    !Array.isArray(config.client) ||
    !config.client.some(
      (client) =>
        client.client_info?.android_client_info?.package_name ===
        "com.nearry.app",
    )
  )
    return [
      "GOOGLE_SERVICES_JSON must point to the Firebase Android configuration for com.nearry.app so native push can register.",
    ];
  return [];
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    checkRelease();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
