import type { VercelRequest, VercelResponse } from "@vercel/node";
import path from "path";
import fs from "fs";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const htmlPath = path.join(process.cwd(), "predictions.html");
    const html = fs.readFileSync(htmlPath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  } catch {
    res.status(500).send("Page not found");
  }
}
