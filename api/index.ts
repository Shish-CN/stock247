import { handle } from "hono/vercel";
import { createApp } from "../apps/api/src/app.js";

export const config = { runtime: "nodejs" };
export default handle(createApp());
