import { Logger } from "@murky-web/simplelog/web";
import { Hono } from "hono";

const app = new Hono();
const logger = new Logger("app");

app.get("/", (c) => {
    const requestLogger = c.var.logger ?? logger.createChildLogger("request");
    requestLogger.info("ok");
    return c.text("ok");
});
