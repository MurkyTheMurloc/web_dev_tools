import { Logger } from "@murky-web/simplelog";
import { Hono } from "hono";

const app = new Hono();
const logger = new Logger("");
const { error } = console;

app.get("/", (c) => {
    const fallbackLogger = logger ?? console;
    const requestLogger = new Logger("request");
    logger.info("bad");
    console.warn("oops");
    return c.json({ error, fallbackLogger, requestLogger });
});
