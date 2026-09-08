import CryptoJS from 'crypto-js';
import localforage from 'localforage';

localforage.config({ name: 'CipherVault', storeName: 'vault_history' });

export const encryptFile = (base64Data: string, secretKey: string) => {
    return CryptoJS.AES.encrypt(base64Data, secretKey).toString();
};

export const decryptFile = (encryptedData: string, secretKey: string) => {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        return null;
    }
};

export const createPuzzles = (encryptedData: string, fileId: string) => {
    const chunkSize = 800; // Reduced for Grid Printing and easy scanning
    const chunks = [];
    for (let i = 0; i < encryptedData.length; i += chunkSize) {
        chunks.push(encryptedData.substring(i, i + chunkSize));
    }
    
    return chunks.map((data, index) => JSON.stringify({
        cv_sig: "CipherVault_v1", // THE DIGITAL SIGNATURE LOCK
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
