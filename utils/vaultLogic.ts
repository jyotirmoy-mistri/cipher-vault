import CryptoJS from 'crypto-js';
import localforage from 'localforage';
import pako from 'pako';

localforage.config({ name: 'CipherVault', storeName: 'vault_history' });

// Advanced Compression + Encryption
export const encryptFile = (base64Data: string, secretKey: string) => {
    // 1. Compress Data First (Reduces 100 QRs to ~10 QRs)
    const uint8Array = new TextEncoder().encode(base64Data);
    const compressed = pako.deflate(uint8Array);
    
    // 2. Convert to Base64 for Encryption
    let binary = '';
    compressed.forEach(byte => binary += String.fromCharCode(byte));
    const compressedBase64 = btoa(binary);

    // 3. Encrypt
    return CryptoJS.AES.encrypt(compressedBase64, secretKey).toString();
};

export const decryptFile = (encryptedData: string, secretKey: string) => {
    try {
        // 1. Decrypt
        const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
        const compressedBase64 = decryptedBytes.toString(CryptoJS.enc.Utf8);
        
        // 2. Decompress
        const binary = atob(compressedBase64);
        const compressed = new Uint8Array(binary.length);
        for(let i=0; i<binary.length; i++) compressed[i] = binary.charCodeAt(i);
        
        const decompressed = pako.inflate(compressed);
        return new TextDecoder().decode(decompressed);
    } catch (e) {
        return null;
    }
};

export const createPuzzles = (encryptedData: string, fileId: string) => {
    const chunkSize = 1500; // Increased chunk size for fewer QRs
    const chunks = [];
    for (let i = 0; i < encryptedData.length; i += chunkSize) {
        chunks.push(encryptedData.substring(i, i + chunkSize));
    }
    return chunks.map((data, index) => JSON.stringify({
        cv_sig: "CipherVault_v2",
        id: fileId,
        part: index + 1,
        total: chunks.length,
        data: data
    }));
};

export const masterCacheClean = async () => {
    await localforage.clear();
    if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
    }
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
            await registration.unregister();
        }
    }
};
