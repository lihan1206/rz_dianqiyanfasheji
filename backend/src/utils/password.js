import bcrypt from "bcryptjs";

export const hashPassword = async (plain) => bcrypt.hash(plain, 10);
export const comparePassword = async (plain, hashed) => bcrypt.compare(plain, hashed);
