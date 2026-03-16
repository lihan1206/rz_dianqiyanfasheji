import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const signToken = (payload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpire });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);
