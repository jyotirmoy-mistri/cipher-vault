"use client";
import React, { useState, useEffect } from 'react';
import localforage from 'localforage';
import { Shield, Sun, Moon, QrCode, Camera, Layers, Settings, Lock } from 'lucide-react';
import SendTab from '../components/SendTab';
import ScanTab from '../components/ScanTab';
import HistoryTab from '../components/HistoryTab';
import SettingsTab from '../components/SettingsTab';

export default function CipherVault() {
  const [activeTab, setActiveTab] = useState('send');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [qrConfig, setQrConfig] = useState({ fg: '#000000', bg: '#ffffff', level: 'M' });
  
  // Stealth Mode & Auto-Lock State
  const [isStealthLocked, setIsStealthLocked] = useState(false);

  useEffect(() => {
    // 1. Load Settings
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') setIsDarkMode(false);
    localforage.getItem('qr_config').then((savedQr: any) => { if(savedQr) setQrConfig({...qrConfig, ...savedQr}); });

    // 2. Auto-Lock Timer (Advanced Security Feature)
    let timeoutId: NodeJS.Timeout;
    const resetTimer = () => {
        clearTimeout(timeoutId);
        // Lock app after 60 seconds of inactivity
        timeoutId = setTimeout(() => setIsStealthLocked(true), 60000); 
    };

    // Listen to user activity to prevent lock
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('scroll', resetTimer);
    
    resetTimer(); // Start timer on load

    return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('mousemove', resetTimer);
        window.removeEventListener('keydown', resetTimer);
        window.removeEventListener('touchstart', resetTimer);
        window.removeEventListener('scroll', resetTimer);
    };
  }, [qrConfig]);

  const toggleTheme = () => { setIsDarkMode(!isDarkMode); localStorage.setItem('theme', !isDarkMode ? 'dark' : 'light'); };

  const saveQrSettings = async (fg: string, bg: string, level: string) => {
      const conf = { fg, bg, level };
      setQrConfig(conf);
      await localforage.setItem('qr_config', conf);
  };

  // Stealth Mode UI (Double tap to unlock)
  if (isStealthLocked) {
      return (
          <div className="min-h-screen bg-black flex flex-col items-center justify-center text-gray-800 select-none" onDoubleClick={() => setIsStealthLocked(false)}>
              <Lock className="w-16 h-16 mb-4 opacity-30 animate-pulse"/>
              <p className="text-sm opacity-30 font-mono tracking-widest">SYSTEM SECURED</p>
              <p className="text-xs opacity-20 mt-2">Double tap anywhere to unlock</p>
          </div>
      );
  }

  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
    <div className="max-w-2xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
      
      {/* Top Header - Double Tap to manually lock */}
      <div 
        onDoubleClick={() => setIsStealthLocked(true)}
        className="p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 z-50 print:hidden cursor-pointer select-none"
        title="Double tap to enter Stealth Mode"
      >
        <h1 className="text-2xl font-black flex items-center text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-600">
          <Shield className="mr-2 text-green-500" /> CipherVault
        </h1>
        <button onClick={(e) => { e.stopPropagation(); toggleTheme(); }} className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-all">
            {isDarkMode ? <Sun className="w-5 h-5 text-yellow-400"/> : <Moon className="w-5 h-5 text-gray-600"/>}
        </button>
      </div>

      <div className="flex-1 p-5 overflow-y-auto pb-24">
         <div className={activeTab === 'send' ? 'block' : 'hidden'}><SendTab qrConfig={qrConfig} /></div>
         <div className={activeTab === 'scan' ? 'block' : 'hidden'}><ScanTab isActive={activeTab === 'scan'} /></div>
         <div className={activeTab === 'history' ? 'block' : 'hidden'}><HistoryTab isActive={activeTab === 'history'} /></div>
         <div className={activeTab === 'settings' ? 'block' : 'hidden'}><SettingsTab qrConfig={qrConfig} saveQrSettings={saveQrSettings} /></div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 via-gray-50 dark:from-gray-950 dark:via-gray-950 to-transparent print:hidden pointer-events-none z-40">
        <div className="max-w-md mx-auto bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-3xl p-2 flex justify-between shadow-2xl pointer-events-auto">
            {['send', 'scan', 'history', 'settings'].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} 
                    className={`flex-1 flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${activeTab === tab ? 'bg-green-100 dark:bg-gray-800 text-green-600 dark:text-green-500 scale-105 shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                    {tab === 'send' && <QrCode className="w-6 h-6"/>}
                    {tab === 'scan' && <Camera className="w-6 h-6"/>}
                    {tab === 'history' && <Layers className="w-6 h-6"/>}
                    {tab === 'settings' && <Settings className="w-6 h-6"/>}
                </button>
            ))}
        </div>
      </div>
    </div>
    </div>
  );
}
