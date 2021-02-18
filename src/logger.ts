import winston from "winston";

export const transports = {
    console: new winston.transports.Console(),
};

export const logger = winston.createLogger({
    format: winston.format.json(),
    transports: [
        transports.console,
    ],
});
