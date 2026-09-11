import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createFormHash, readCreateForm, type CreateForm } from "./createForm";
export function useCreateForm(chain: number) {
  const [form, setForm] = useState(() => readCreateForm(location.hash, chain));
  const lastSerialized = useRef(createFormHash(form));
  useEffect(() => {
    const restore = () => {
      if (location.hash.split("?")[0] === "#/create") {
        const restored = readCreateForm(location.hash, chain);
        lastSerialized.current = createFormHash(restored);
        setForm(restored);
      }
    };
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, [chain]);
  useEffect(() => {
    const serialized = createFormHash(form);
    if (serialized === lastSerialized.current) return;
    lastSerialized.current = serialized;
    if (location.hash.split("?")[0] === "#/create")
      history.replaceState(history.state, "", serialized);
  }, [form]);
  return [form, setForm] as const;
}
export function formField<K extends keyof CreateForm>(
  form: CreateForm,
  set: Dispatch<SetStateAction<CreateForm>>,
  key: K,
): [CreateForm[K], Dispatch<SetStateAction<CreateForm[K]>>] {
  return [
    form[key],
    (value) =>
      set((previous) => ({
        ...previous,
        [key]: typeof value === "function" ? value(previous[key]) : value,
      })),
  ];
}
