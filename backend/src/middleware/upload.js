import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import dayjs from "dayjs";
import { env } from "../config/env.js";

if (!fs.existsSync(env.uploadDir)) {
  fs.mkdirSync(env.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, env.uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9\u4e00-\u9fa5-_]/g, "_");
    cb(null, `${dayjs().format("YYYYMMDDHHmmss")}_${safeName}${ext}`);
  }
});

const allowedMimes = new Set([
  "application/pdf",
  "application/octet-stream",
  "application/acad",
  "image/vnd.dwg",
  "application/dxf"
]);

export const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".pdf", ".dwg", ".dxf", ".edz", ".dgn"].includes(ext) || allowedMimes.has(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error("仅支持上传 PDF/DWG/DXF/EDZ/DGN 文件"));
  }
});
