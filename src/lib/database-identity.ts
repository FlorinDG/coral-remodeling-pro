import { v4 as uuidv4 } from 'uuid';

/**
 * Mints a database identifier.
 *
 * Currently invoked client-side from the Zustand store — this is NOT yet the
 * server-side minting required by `pd.md`'s IDENTITY DIRECTIVE. CUSTOM-6 must
 * call a server action; it must not call this from the browser. Tracked as `KERN-3b`.
 *
 * "Creation of the id is a kernel function. Nothing can disagree or overwrite
 * the assigned id. Upwards written, downwards read-only."
 *
 * Identity is minted at the lowest layer that owns it and is immutable to
 * everything above. A caller learns an identity; it never chooses one.
 */
export function mintDatabaseId(): string {
    return uuidv4();
}
