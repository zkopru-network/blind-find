import winston from "winston";

export const transports = {
    console: new winston.transports.Console(),
};

export const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.cli(),
    transports: [
        transports.console,
    ],
});
