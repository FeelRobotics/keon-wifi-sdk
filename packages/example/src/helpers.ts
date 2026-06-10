export const wait = (msecs: number) =>
    new Promise((resolve) => {
        setTimeout(resolve, msecs);
    });
