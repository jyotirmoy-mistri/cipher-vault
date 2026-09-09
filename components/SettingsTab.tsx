"use client";
import React, { useState } from 'react';
import localforage from 'localforage';
import { masterCacheClean } from '../utils/vaultLogic';
import { Palette, Trash2, Copy, ClipboardPaste, AlertCircle } from 'lucide-react';

export default function SettingsTab({ qrConfig, saveQrSettings }: any) {
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [undoMaster, setUndoMaster] = useState<any>(null);

  // Formatting and Undo Logic... (same as previous)

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="p-5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="font-bold flex items-center mb-4"><Palette className="w-5 h-5 mr-2 text-blue-500"/> Advanced QR Settings</h3>
          <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="text-xs text-gray-500 block mb-1 font-bold">Film Color</label>
                  <input type="color" value={qrConfig.fg || '#000000'} onChange={(e)=>saveQrSettings(e.target.value, qrConfig.bg, qrConfig.level, qrConfig.margin)} className="w-full h-12 rounded-lg cursor-pointer border-none p-0" />
              </div>
              <div>
                  <label className="text-xs text-gray-500 block mb-1 font-bold">Background</label>
                  <input type="color" value={qrConfig.bg || '#ffffff'} onChange={(e)=>saveQrSettings(qrConfig.fg, e.target.value, qrConfig.level, qrConfig.margin)} className="w-full h-12 rounded-lg cursor-pointer border-none p-0" />
              </div>
              <div className="col-span-2 mt-2">
                  <label className="text-xs text-gray-500 block mb-1 font-bold">Error Correction (Robustness)</label>
                  <select value={qrConfig.level || 'M'} onChange={(e)=>saveQrSettings(qrConfig.fg, qrConfig.bg, e.target.value, qrConfig.margin)} className="w-full p-3 bg-gray-50 dark:bg-gray-950 rounded-xl outline-none border border-gray-300 dark:border-gray-700 font-bold">
                      <option value="L">Low (~7% recovery) - Best for Clean Prints</option>
                      <option value="M">Medium (~15% recovery)</option>
                      <option value="Q">Quarter (~25% recovery)</option>
                      <option value="H">High (~30% recovery) - Best for Screens</option>
                  </select>
              </div>
              <div className="col-span-2 mt-2">
                  <label className="text-xs text-gray-500 block mb-1 font-bold">QR Margin / Padding</label>
                  <input type="range" min="0" max="10" value={qrConfig.margin ?? 2} onChange={(e)=>saveQrSettings(qrConfig.fg, qrConfig.bg, qrConfig.level, Number(e.target.value))} className="w-full" />
                  <p className="text-xs text-center font-bold mt-1">Value: {qrConfig.margin ?? 2}px</p>
              </div>
          </div>
      </div>
      {/* Danger Zone... */}
    </div>
  );
}
