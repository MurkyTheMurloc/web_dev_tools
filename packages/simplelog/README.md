# SimpleLog

`SimpleLog` is a lightweight and flexible logging utility for Node.js, Deno or Bun applications. It provides various log levels, performance benchmarking, and the ability to log messages to both the console and a file.

## Features

-   Multiple log levels: `DEBUG`, `INFO`, `WARN`, `ERROR`
-   Performance benchmarking
-   Log messages to console and/or file
-   Colorized console output
-   Nested loggers for hierarchical logging

## Installation

SimpleLog is currently used as an internal workspace package in `web_kit`.
External publish and install instructions will be added again later.

## Usage

### Importing and Creating a Logger

```typescript
import { Logger } from "@murky-web/simplelog";

const logger = new Logger("MyLogger", undefined, {
    writeToFile: true,
    logFilePath: "logs/mylogger.log",
    logLevelThreshold: "DEBUG",
});
```

### Logging Messages

```typescript
logger.debug("This is a debug message");
logger.info("This is an info message");
logger.warn("This is a warning message");
logger.error("This is an error message");
```

### Performance Benchmarking

```typescript
logger.startPerformanceBenchmark("test");
// ... some code to benchmark ...
logger.endPerformanceBenchmark("test", "Benchmark completed");
```

### Assertions

```typescript
logger.assert(1 + 1 === 2, "Math is broken!");
```

### Creating Child Loggers

```typescript
const childLogger = logger.createChildLogger("ChildLogger");
childLogger.info("This is a message from the child logger");
```

## Logger Options

-   `writeToFile`: Boolean indicating whether to write logs to a file.
-   `logFilePath`: Path to the log file.
-   `logLevelThreshold`: Minimum log level for logging.

## Log Levels

-   `DEBUG`: Detailed information, typically of interest only when diagnosing problems.
-   `INFO`: Confirmation that things are working as expected.
-   `WARN`: An indication that something unexpected happened, or indicative of some problem in the near future.
-   `ERROR`: Error events of considerable importance that will prevent normal program execution.

## Example

```typescript
import { Logger } from "@murky-web/simplelog";

const logger = new Logger("AppLogger", undefined, {
    writeToFile: true,
    logFilePath: "logs/app.log",
    logLevelThreshold: "INFO",
});

logger.info("Application started");
logger.debug(
    "This debug message will not be logged because the threshold is INFO"
);
logger.warn("This is a warning");
logger.error("This is an error");
```

## License

This project is licensed under the MIT License.
