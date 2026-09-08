import CryptoJS from 'crypto-js';
import localforage from 'localforage';
import pako from 'pako';

localforage.config({ name: 'CipherVault', storeName: 'vault_history' });

export const encryptFile = (base64Data: string, secretKey: string) => {
    // 1. Calculate Original Size (approx)
    const originalSize = Math.round(base64Data.length * 0.75);
    
    // 2. Compress
    const uint8Array = new TextEncoder().encode(base64Data);
    const compressed = pako.deflate(uint8Array);
    
    // 3. Base64 & Encrypt
    let binary = '';
    compressed.forEach(byte => binary += String.fromCharCode(byte));
    const compressedBase64 = btoa(binary);
    const compressedSize = Math.round(compressedBase64.length * 0.75);
    
    const encrypted = CryptoJS.AES.encrypt(compressedBase64, secretKey).toString();
    
    return {
        encryptedData: encrypted,
        originalSize,
        compressedSize,
        savedRatio: Math.round(((originalSize - compressedSize) / originalSize) * 100)
    };
};

export const decryptFile = (encryptedData: string, secretKey: string) => {
    try {
        const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
        const compressedBase64 = decryptedBytes.toString(CryptoJS.enc.Utf8);
        const binary = atob(compressedBase64);
        const compressed = new Uint8Array(binary.length);
        for(let i=0; i<binary.length; i++) compressed[i] = binary.charCodeAt(i);
        const decompressed = pako.inflate(compressed);
        return new TextDecoder().decode(decompressed);
    } catch (e) { return null; }
};

// Density Size Mapping
export const getChunkSize = (density: string) => {
    switch(density) {
        case 'low': return 800;    // More QRs, Easy to scan
        case 'medium': return 1500; // Balanced
        case 'high': return 2500;   // Less QRs, Dense Data
        default: return 1500;
    }
};

export const createPuzzles = (encryptedData: string, fileId: string, density: string = 'medium') => {
    const chunkSize = getChunkSize(density);
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
        for (let registration of registrations) { await registration.unregister(); }
    }
};

export const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
