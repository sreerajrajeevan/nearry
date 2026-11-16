import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard } from "react-native";
import { PhotoCropper } from "../components/PhotoCropper";
import { pickAvatar as pickSource } from "../services/avatars";

/** Every avatar entry point waits for explicit confirmation of the circular crop. */
export function useAvatarPicker() {
  const [editing, setEditing] = useState<string | null>(null);
  const active = useRef(true);
  const picking = useRef(false);
  const pending = useRef<((uri: string | null) => void) | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      pending.current?.(null);
      pending.current = null;
    };
  }, []);
  const finish = useCallback((uri: string | null) => {
    setEditing(null);
    pending.current?.(uri);
    pending.current = null;
  }, []);
  const pickAvatar = useCallback(async (): Promise<string | null> => {
    if (picking.current) return null;
    picking.current = true;
    Keyboard.dismiss();
    try {
      const uri = await pickSource();
      if (!uri || !active.current) return null;
      return await new Promise<string | null>((resolve) => {
        pending.current = resolve;
        setEditing(uri);
      });
    } finally {
      picking.current = false;
    }
  }, []);
  return {
    pickAvatar,
    avatarCropper: editing ? (
      <PhotoCropper
        key={editing}
        uri={editing}
        variant="avatar"
        onCancel={() => finish(null)}
        onDone={finish}
      />
    ) : null,
  };
}
