import CryptoJS from 'crypto-js';
import localforage from 'localforage';

// IndexedDB Setup for Offline Storage
localforage.config({
    name: 'CipherVault',
    storeName: 'vault_history'
});

// 1. Encryption (Vault Creation)
export const encryptFile = (base64Data: string, secretKey: string) => {
    return CryptoJS.AES.encrypt(base64Data, secretKey).toString();
};

// 2. Decryption (Vault Unlocking)
export const decryptFile = (encryptedData: string, secretKey: string) => {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        return null;
    }
};

// 3. Chunking (Puzzle Maker) - Split data into chunks of 2KB for QR codes
export const createPuzzles = (encryptedData: string, fileId: string) => {
    const chunkSize = 2000; // Safe size for QR
    const chunks = [];
    for (let i = 0; i < encryptedData.length; i += chunkSize) {
        chunks.push(encryptedData.substring(i, i + chunkSize));
    }
    
    return chunks.map((data, index) => JSON.stringify({
        id: fileId,
        part: index + 1,
        total: chunks.length,
        data: data
    }));
};

// 4. Master Cache Cleaner Logic
export const masterCacheClean = async () => {
    // A. Clear IndexedDB (History & Puzzles)
    await localforage.clear();
    
    // B. Clear Service Worker Caches
    if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
    }
    
    // C. Unregister Service Workers
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
            await registration.unregister();
        }
    }
};
