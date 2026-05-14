'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Clock } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { Branch } from '../types';

const getBranchCardClassName = (isOpen: boolean, isSelected: boolean) => {
  if (isOpen && isSelected) {
    return 'border-blue-500 bg-blue-50 cursor-pointer';
  }

  if (isOpen) {
    return 'border-slate-100 hover:border-blue-200 hover:bg-slate-50 cursor-pointer';
  }

  return 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed';
};

export default function BranchModal() {
  const {
    isBranchModalOpen, setIsBranchModalOpen,
    branches,
    selectedBranch, setSelectedBranch,
    cart, setCart,
    isBranchOpen
  } = useAppContext();

  const [pendingBranch, setPendingBranch] = useState<Branch | null>(null);
  const safeBranches = Array.isArray(branches) ? branches : [];

  useBodyScrollLock(isBranchModalOpen);

  return (
    <AnimatePresence>
      {isBranchModalOpen && (
        <React.Fragment key="branch-selector-modal">
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
                {safeBranches.map(branch => {
                  const isOpen = isBranchOpen(branch);
                  const isSelected = selectedBranch?.id === branch.id;
                  
                  return (
                    <button
                      type="button"
                      key={branch.id}
                      onClick={() => {
                        if (!isOpen) return;
                        if (selectedBranch?.id !== branch.id && cart.length > 0) {
                          setPendingBranch(branch);
                          return;
                        }
                        if (selectedBranch?.id !== branch.id) setCart([]);
                        setSelectedBranch(branch);
                        setIsBranchModalOpen(false);
                      }}
                      disabled={!isOpen}
                      className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${getBranchCardClassName(isOpen, isSelected)}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-slate-900">{branch.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          isOpen ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
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
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </React.Fragment>
      )}

      {/* Cart-clear confirmation when switching branches */}
      <AnimatePresence>
        {pendingBranch && (
          <React.Fragment key={`branch-confirm-${pendingBranch.id}`}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-3xl shadow-2xl z-[70] overflow-hidden"
            >
              <div className="p-7 text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <MapPin className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Switch Branch?</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-7">
                  You have <span className="font-bold text-slate-700">{cart.length} {cart.length === 1 ? 'item' : 'items'}</span> in your cart. Switching to <span className="font-bold text-slate-700">{pendingBranch.name}</span> will clear your cart.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPendingBranch(null)}
                    className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    Keep Cart
                  </button>
                  <button
                    onClick={() => {
                      setCart([]);
                      setSelectedBranch(pendingBranch);
                      setPendingBranch(null);
                      setIsBranchModalOpen(false);
                    }}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                  >
                    Switch Branch
                  </button>
                </div>
              </div>
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
