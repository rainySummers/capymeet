import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

export class JwtSecretError extends Error {
  constructor(message = "JWT secret is missing or too weak") {
    super(message);
    this.name = "JwtSecretError";
  }
}

export function assertSecret(secret: string | undefined | null): asserts secret is string {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new JwtSecretError();
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createAdminToken(adminId: string, secret: string): Promise<string> {
  assertSecret(secret);
  return new SignJWT({ adminId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAdminToken(token: string, secret: string): Promise<string | null> {
  assertSecret(secret);
  try {
    const result = await jwtVerify(token, new TextEncoder().encode(secret));
    return typeof result.payload.adminId === "string" ? result.payload.adminId : null;
  } catch {
    return null;
  }
}
