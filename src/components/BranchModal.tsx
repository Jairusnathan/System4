'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Clock } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

export default function BranchModal() {
  const { 
    isBranchModalOpen, setIsBranchModalOpen,
    branches,
    selectedBranch, setSelectedBranch,
    setCart,
    isBranchOpen
  } = useAppContext();

  useBodyScrollLock(isBranchModalOpen);

  return (
    <AnimatePresence>
      {isBranchModalOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsBranchModalOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-3xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Select a Branch</h2>
                <p className="text-slate-500 text-sm mt-1">Choose an open branch to see available products</p>
              </div>
              <button 
                onClick={() => setIsBranchModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="grid gap-4">
                {branches.map(branch => {
                  const isOpen = isBranchOpen(branch);
                  const isSelected = selectedBranch?.id === branch.id;
                  
                  return (
                    <div 
                      key={branch.id}
                      onClick={() => {
                        if (!isOpen) return;
                        if (selectedBranch?.id !== branch.id) {
                          setCart([]);
                        }
                        setSelectedBranch(branch);
                        setIsBranchModalOpen(false);
                      }}
                      className={`p-4 rounded-2xl border-2 transition-all ${
                        !isOpen 
                          ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed' 
                          : isSelected 
                            ? 'border-emerald-500 bg-emerald-50 cursor-pointer' 
                            : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-slate-900">{branch.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isOpen ? 'Open Now' : 'Closed'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                          <span>{branch.address}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>{branch.opening_time} - {branch.closing_time}</span>
                        </div>
                      </div>

                      {!isOpen && (
                        <div className="mt-3 pt-3 border-t border-red-100">
                          <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                            <X className="w-3 h-3" />
                            This branch is currently closed and cannot be selected.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
