"use client";
import React, { useState } from 'react';
import localforage from 'localforage'; // FIX: Added missing import here
import { masterCacheClean } from '../utils/vaultLogic';
import { Palette, Trash2, Copy, ClipboardPaste, AlertCircle } from 'lucide-react';

export default function SettingsTab({ qrConfig, saveQrSettings }: any) {
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [undoMaster, setUndoMaster] = useState<any>(null);

  const handleMasterFormat = async () => {
      if(deleteConfirm !== 'DELETE') return alert('Type DELETE exactly.');
      
      try {
          // Keep a secure backup before wiping
          const backupHistory = await localforage.getItem('scan_history');
          await masterCacheClean(); 
          setDeleteConfirm('');
          
          const timeout = setTimeout(() => {
              setUndoMaster(null);
              window.location.reload(); // Hard reload after 3s
          }, 3000);

          setUndoMaster({ backup: backupHistory, timeout });
      } catch (error) {
          alert("❌ Error formatting vault. Please clear browser cache manually.");
      }
  };

  const undoFormat = async () => {
      if(undoMaster) {
          clearTimeout(undoMaster.timeout); // Stop the page from reloading
          try {
              if (undoMaster.backup) {
                  await localforage.setItem('scan_history', undoMaster.backup);
              }
              setUndoMaster(null);
              alert("✅ Vault Data Successfully Restored!");
          } catch (error) {
              alert("❌ Failed to restore data.");
          }
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      
      {/* 3-Second Undo Toast */}
      {undoMaster && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-full flex items-center shadow-2xl animate-in slide-in-from-top-5">
              <AlertCircle className="w-5 h-5 mr-2 animate-pulse" />
              <span className="font-bold">Formatting Vault...</span>
              <button onClick={undoFormat} className="ml-5 px-3 py-1 bg-white text-red-600 rounded-full font-black shadow-md hover:bg-gray-100 transition-all">UNDO NOW</button>
          </div>
      )}

      {/* QR Design Settings */}
      <div className="p-5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="font-bold flex items-center mb-4"><Palette className="w-5 h-5 mr-2 text-blue-500"/> Advanced QR Design</h3>
          <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="text-xs text-gray-500 block mb-1 font-bold">Film Color (Data)</label>
                  <input type="color" value={qrConfig.fg} onChange={(e)=>saveQrSettings(e.target.value, qrConfig.bg, qrConfig.level)} className="w-full h-12 rounded-lg cursor-pointer border-none p-0" />
              </div>
              <div>
                  <label className="text-xs text-gray-500 block mb-1 font-bold">Base Background</label>
                  <input type="color" value={qrConfig.bg} onChange={(e)=>saveQrSettings(qrConfig.fg, e.target.value, qrConfig.level)} className="w-full h-12 rounded-lg cursor-pointer border-none p-0" />
              </div>
              <div className="col-span-2 mt-2">
                  <label className="text-xs text-gray-500 block mb-1 font-bold">Error Correction Level (Robustness)</label>
                  <select value={qrConfig.level} onChange={(e)=>saveQrSettings(qrConfig.fg, qrConfig.bg, e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-950 rounded-xl outline-none border border-gray-300 dark:border-gray-700 font-bold">
                      <option value="L">Low (~7% recovery) - Best for Clean Prints</option>
                      <option value="M">Medium (~15% recovery)</option>
                      <option value="Q">Quarter (~25% recovery)</option>
                      <option value="H">High (~30% recovery) - Best for Screens/Damaged Prints</option>
                  </select>
              </div>
          </div>
      </div>

      {/* Danger Zone */}
      <div className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-3xl">
          <h2 className="text-lg font-bold text-red-600 dark:text-red-500 flex items-center mb-4"><Trash2 className="mr-2"/> Danger Zone</h2>
          <div className="flex justify-between items-center bg-white dark:bg-gray-950 p-3 rounded-xl border border-red-200 dark:border-red-900/50 mb-4 shadow-inner">
              <code className="text-red-500 font-bold tracking-widest text-lg">DELETE</code>
              <button onClick={() => navigator.clipboard.writeText('DELETE')} className="text-gray-500 hover:text-gray-900 dark:hover:text-white p-2 transition-colors" title="Copy"><Copy className="w-5 h-5"/></button>
          </div>
          <div className="flex space-x-2 mb-4">
              <input type="text" placeholder="Paste DELETE here" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
                className="flex-1 p-4 bg-white dark:bg-gray-950 text-red-500 font-mono rounded-xl outline-none border border-red-200 dark:border-red-900/50 shadow-inner" />
              <button onClick={async () => setDeleteConfirm(await navigator.clipboard.readText())} className="px-4 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors" title="Paste"><ClipboardPaste className="w-5 h-5"/></button>
          </div>
          <button onClick={handleMasterFormat} disabled={!!undoMaster} className="w-full p-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black tracking-wider shadow-lg disabled:opacity-50 transition-all">FORMAT VAULT</button>
      </div>
    </div>
  );
}
