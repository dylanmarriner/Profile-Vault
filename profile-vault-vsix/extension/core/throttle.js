"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debounce = debounce;
function debounce(fn, ms) {
    let t;
    return ((...args) => {
        if (t)
            clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    });
}
