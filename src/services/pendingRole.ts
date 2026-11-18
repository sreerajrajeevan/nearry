import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PendingRole } from "../utils/pendingRole";
export { parsePendingRole } from "../utils/pendingRole";
export const rememberPendingRole = (role: PendingRole) =>
  AsyncStorage.setItem(
    "nearry.pendingRole",
    JSON.stringify({ role, at: Date.now() }),
  );
