export function boolFromDb(value: number): boolean {
  return value === 1;
}

export function boolToDb(value: boolean): number {
  return value ? 1 : 0;
}

export function nowIso(): string {
  return new Date().toISOString();
}
