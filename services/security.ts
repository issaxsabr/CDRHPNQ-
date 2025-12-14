
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

// NOTE : Dans une application de production, cette clé devrait être gérée de manière plus sécurisée.
// Pour l'obfuscation côté client dans IndexedDB, cette approche de clé statique est un point de départ pratique.
const SECRET_KEY_MATERIAL = 'cdrhpnq-v2-local-db-secret-key'; 
let cryptoKey: CryptoKey | null = null;

async function getDerivedKey(): Promise<CryptoKey> {
    if (cryptoKey) return cryptoKey;

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(SECRET_KEY_MATERIAL),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    
    // Un sel statique est acceptable ici car la clé maîtresse est statique.
    const salt = encoder.encode('a-static-salt-for-derivation'); 

    cryptoKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    return cryptoKey;
}

// Combine IV + données chiffrées en un seul buffer
function pack(iv: Uint8Array, encrypted: ArrayBuffer): Uint8Array {
    const packed = new Uint8Array(iv.length + encrypted.byteLength);
    packed.set(iv, 0);
    packed.set(new Uint8Array(encrypted), iv.length);
    return packed;
}

// Sépare l'IV des données chiffrées
function unpack(packed: Uint8Array): { iv: Uint8Array, encrypted: Uint8Array } {
    const iv = packed.slice(0, 12);
    const encrypted = packed.slice(12);
    return { iv, encrypted };
}

// --- Chiffrement et Compression Combinés ---
export async function securePack(data: any): Promise<string> {
    const key = await getDerivedKey();
    const jsonString = JSON.stringify(data);
    const compressed = compressToUTF16(jsonString);
    if (compressed === null) throw new Error("La compression a échoué");

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(compressed);

    const encryptedContent = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encodedData
    );

    const packedData = pack(iv, encryptedContent);
    
    let binaryString = '';
    packedData.forEach(byte => {
        binaryString += String.fromCharCode(byte);
    });
    return btoa(binaryString);
}

// --- Déchiffrement et Décompression Combinés ---
export async function secureUnpack(base64Encrypted: string | null | undefined): Promise<any> {
    if (!base64Encrypted) return null;

    try {
        const key = await getDerivedKey();
        
        const binaryString = atob(base64Encrypted);
        const packedData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            packedData[i] = binaryString.charCodeAt(i);
        }
        
        const { iv, encrypted } = unpack(packedData);

        const decryptedContent = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encrypted
        );

        const decompressed = decompressFromUTF16(new TextDecoder().decode(decryptedContent));
        if (decompressed === null || decompressed === "") {
             throw new Error("La décompression a échoué, a retourné une valeur nulle ou vide.");
        }
        
        return JSON.parse(decompressed);
    } catch(error) {
        console.warn("Le déchiffrement/décompression a échoué:", error);
        // Tente de lire les données comme du JSON non chiffré (pour la migration des anciennes données)
        try {
            return JSON.parse(base64Encrypted); 
        } catch (e) {
            console.error("La tentative de lecture en format non chiffré a aussi échoué. Données potentiellement corrompues.");
            return null;
        }
    }
}
