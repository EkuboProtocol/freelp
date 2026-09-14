import { useEffect, useState } from "react";
import { errorMessage } from "./errors";
import { loadPositionById, type PositionLookup } from "./positionLookup";
import { useSession } from "./session";
import type { Settings } from "./types";

export type PositionLookupState =
  | { state: "loading" }
  | {
      state: "found";
      owner: PositionLookup["owner"];
      position: PositionLookup["position"];
    }
  | { state: "missing" }
  | { state: "error"; message: string };

export function usePositionLookup(settings: Settings, id: bigint) {
  const { revision } = useSession();
  const [attempt, setAttempt] = useState(0);
  const scope = JSON.stringify([settings, id.toString(), revision, attempt]);
  const [result, setResult] = useState<{
    scope: string;
    value: PositionLookupState;
  }>();
  useEffect(() => {
    let active = true;
    void loadPositionById(settings, id)
      .then((found): PositionLookupState =>
        found ? { state: "found", ...found } : { state: "missing" },
      )
      .catch((error): PositionLookupState => ({
        state: "error",
        message: errorMessage(error),
      }))
      .then((value) => {
        if (active) setResult({ scope, value });
      });
    return () => {
      active = false;
    };
  }, [settings, id, scope]);
  const value: PositionLookupState =
    result?.scope === scope ? result.value : { state: "loading" };
  return { ...value, retry: () => setAttempt((n) => n + 1) };
}
