import { v4 as uuidv4 } from 'uuid';

/**
 * mintDatabaseId() — server-side, the only source of a new database identifier.
 * (pd.md IDENTITY DIRECTIVE / KERN-3)
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
