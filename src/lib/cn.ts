export type ClassValue = string | false | null | undefined | 0 | ClassValue[];

/** Tiny classname joiner — avoids pulling in clsx/tailwind-merge. */
export function cn(...classes: ClassValue[]): string {
  const out: string[] = [];
  const walk = (value: ClassValue) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    out.push(value);
  };
  classes.forEach(walk);
  return out.join(" ");
}
