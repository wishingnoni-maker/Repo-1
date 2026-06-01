import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST?.trim();

const app = createApp();

if (host) {
  app.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`);
  });
} else {
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}
