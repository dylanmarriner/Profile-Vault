export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
    let t: NodeJS.Timeout | undefined;
    return ((...args: any[]) => {
        if (t) clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    }) as T;
}
