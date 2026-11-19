import { describe, expect, it } from "vitest";

import { resolveConsoleDefaults } from "../src/console_defaults";
import type { ConsoleEnvironment } from "../src/console_defaults";

const terminal: ConsoleEnvironment = {
    forceColor: undefined,
    noColor: undefined,
    simplelogTimestamp: undefined,
    stdoutIsTerminal: true,
};

const pipe: ConsoleEnvironment = { ...terminal, stdoutIsTerminal: false };

describe(resolveConsoleDefaults, () => {
    it("colors and short times in a terminal", () => {
        expect(resolveConsoleDefaults(terminal)).toStrictEqual({
            timestampFormat: "time",
            valueColorMode: "level",
        });
    });

    it("plain text and ISO timestamps in a pipe", () => {
        expect(resolveConsoleDefaults(pipe)).toStrictEqual({
            timestampFormat: "iso",
            valueColorMode: "off",
        });
    });

    it("NO_COLOR turns colors off in a terminal", () => {
        expect(
            resolveConsoleDefaults({ ...terminal, noColor: "1" })
                .valueColorMode,
        ).toBe("off");
    });

    it("an empty NO_COLOR is ignored", () => {
        expect(
            resolveConsoleDefaults({ ...terminal, noColor: "" }).valueColorMode,
        ).toBe("level");
    });

    it("NO_COLOR beats FORCE_COLOR", () => {
        expect(
            resolveConsoleDefaults({ ...pipe, forceColor: "1", noColor: "1" })
                .valueColorMode,
        ).toBe("off");
    });

    it.each(["1", "3", "true", ""])(
        "FORCE_COLOR=%j turns colors on in a pipe",
        (forceColor) => {
            expect(
                resolveConsoleDefaults({ ...pipe, forceColor }).valueColorMode,
            ).toBe("level");
        },
    );

    it.each(["0", "false"])(
        "FORCE_COLOR=%j turns colors off in a terminal",
        (forceColor) => {
            expect(
                resolveConsoleDefaults({ ...terminal, forceColor })
                    .valueColorMode,
            ).toBe("off");
        },
    );

    it("FORCE_COLOR does not change the timestamp", () => {
        expect(
            resolveConsoleDefaults({ ...pipe, forceColor: "1" })
                .timestampFormat,
        ).toBe("iso");
    });

    it("SIMPLELOG_TIMESTAMP overrides the terminal check both ways", () => {
        expect(
            resolveConsoleDefaults({ ...pipe, simplelogTimestamp: "time" })
                .timestampFormat,
        ).toBe("time");
        expect(
            resolveConsoleDefaults({ ...terminal, simplelogTimestamp: "iso" })
                .timestampFormat,
        ).toBe("iso");
    });

    it("an unknown SIMPLELOG_TIMESTAMP falls back to the terminal check", () => {
        expect(
            resolveConsoleDefaults({ ...pipe, simplelogTimestamp: "short" })
                .timestampFormat,
        ).toBe("iso");
    });
});
