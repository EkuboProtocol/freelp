import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { createFormHash, readCreateForm, type CreateForm } from "./createForm";
export function useCreateForm(chain: number) {
  const [form, setForm] = useState(() => readCreateForm(location.hash, chain));
  useEffect(() => {
    const restore = () => {
      if (location.hash.split("?")[0] === "#/create")
        setForm(readCreateForm(location.hash, chain));
    };
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, [chain]);
  useEffect(() => {
    if (location.hash.split("?")[0] === "#/create")
      history.replaceState(history.state, "", createFormHash(form));
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
