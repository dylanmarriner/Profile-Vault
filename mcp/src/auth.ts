export function requireAuth(token?: string) {
    const expected = process.env.PVAULT_TOKEN;
    if (!expected) return; // auth disabled
    if (!token || token !== expected) throw new Error("Unauthorized");
}
