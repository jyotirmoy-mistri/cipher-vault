"use client";
import React, { useState } from 'react';
import { masterCacheClean } from '../utils/vaultLogic';
import { Palette, Trash2, Copy, ClipboardPaste } from 'lucide-react';

export default function SettingsTab({ qrConfig, saveQrSettings }: any) {
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [undoMaster, setUndoMaster] = useState<any>(null);

  const handleMasterFormat = async () => {
      if(deleteConfirm !== 'DELETE') return alert('Type DELETE exactly.');
      
      // Keep a backup before wiping
      const backupHistory = await localforage.getItem('scan_history');
      await masterCacheClean(); 
      setDeleteConfirm('');
      
      const timeout = setTimeout(() => {
          setUndoMaster(null);
          window.location.reload(); // Hard reload after 3s
      }, 3000);

      setUndoMaster({ backup: backupHistory, timeout });
  };

  const undoFormat = async () => {
      if(undoMaster) {
          clearTimeout(undoMaster.timeout);
          await localforage.setItem('scan_history', undoMaster.backup);
          setUndoMaster(null);
          alert("Vault Data Restored!");
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {undoMaster && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-full flex items-center shadow-2xl">
              <span>Formatting Vault...</span>
              <button onClick={undoFormat} className="ml-4 text-white font-bold underline">UNDO NOW</button>
          </div>
      )}

      <div className="p-5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="font-bold flex items-center mb-4"><Palette className="w-5 h-5 mr-2 text-blue-500"/> Advanced QR Design</h3>
          <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="text-xs text-gray-500 block mb-1">Film Color (Data)</label>
                  <input type="color" value={qrConfig.fg} onChange={(e)=>saveQrSettings(e.target.value, qrConfig.bg, qrConfig.level)} className="w-full h-10 rounded cursor-pointer" />
              </div>
              <div>
                  <label className="text-xs text-gray-500 block mb-1">Base Background</label>
                  <input type="color" value={qrConfig.bg} onChange={(e)=>saveQrSettings(qrConfig.fg, e.target.value, qrConfig.level)} className="w-full h-10 rounded cursor-pointer" />
              </div>
              <div className="col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">Error Correction Level (Robustness)</label>
                  <select value={qrConfig.level} onChange={(e)=>saveQrSettings(qrConfig.fg, qrConfig.bg, e.target.value)} className="w-full p-3 bg-gray-50 dark:bg-gray-950 rounded-lg outline-none border border-gray-300 dark:border-gray-700">
                      <option value="L">Low (~7% recovery) - Best for Print</option>
                      <option value="M">Medium (~15% recovery)</option>
                      <option value="Q">Quarter (~25% recovery)</option>
                      <option value="H">High (~30% recovery) - Best for Screens</option>
                  </select>
              </div>
          </div>
      </div>

      <div className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-3xl">
          <h2 className="text-lg font-bold text-red-600 dark:text-red-500 flex items-center mb-4"><Trash2 className="mr-2"/> Danger Zone</h2>
          <div className="flex justify-between items-center bg-white dark:bg-gray-950 p-3 rounded-lg border border-red-200 dark:border-red-900/50 mb-4">
              <code className="text-red-500 font-bold tracking-widest">DELETE</code>
              <button onClick={() => navigator.clipboard.writeText('DELETE')} className="text-gray-500 hover:text-gray-700 p-2"><Copy className="w-4 h-4"/></button>
          </div>
          <div className="flex space-x-2 mb-4">
              <input type="text" placeholder="Paste DELETE here" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
                className="flex-1 p-4 bg-white dark:bg-gray-950 text-red-500 font-mono rounded-xl outline-none border border-red-200 dark:border-red-900/50" />
              <button onClick={async () => setDeleteConfirm(await navigator.clipboard.readText())} className="px-4 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700"><ClipboardPaste className="w-5 h-5"/></button>
          </div>
          <button onClick={handleMasterFormat} disabled={!!undoMaster} className="w-full p-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold disabled:opacity-50">FORMAT VAULT</button>
      </div>
    </div>
  );
}
