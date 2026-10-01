const store = new Map<string, any>();

export async function get(key: string) {
    return store.get(key);
}

export async function set(key: string, val: any) {
    store.set(key, val);
}

export async function del(key: string) {
    store.delete(key);
}

export function clearIdb() {
    store.clear();
}
