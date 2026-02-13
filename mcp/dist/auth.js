export function requireAuth(token) {
    const expected = process.env.PVAULT_TOKEN;
    if (!expected)
        return; // auth disabled
    if (!token || token !== expected)
        throw new Error("Unauthorized");
}
