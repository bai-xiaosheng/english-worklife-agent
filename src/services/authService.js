import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { config } from "../config.js";

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function validateCredentials({ email, password }) {
  const errors = [];
  const normalizedEmail = normalizeEmail(email);
  const pwd = String(password || "");

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    errors.push("Please provide a valid email.");
  }

  if (pwd.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }

  return {
    email: normalizedEmail,
    password: pwd,
    errors
  };
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      displayName: user.displayName || ""
    },
    config.auth.jwtSecret,
    {
      expiresIn: config.auth.jwtExpiresIn
    }
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, config.auth.jwtSecret);
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName || "",
    createdAt: user.createdAt || new Date().toISOString()
  };
}

