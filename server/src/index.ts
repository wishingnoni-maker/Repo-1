import dotenv from "dotenv";
import { createApp } from "./app.js";

dotenv.config({ path: "../.env" });

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
