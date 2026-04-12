import React from 'react';
import { useSimulation } from '../store/SimulationContext';

function KeyLab() {
  const { state, dispatch } = useSimulation();

  return (
    <div className="key-lab">
      <div className="card-grid">
        {state.seeds.map((seed, seedIndex) => {
          const seedChar = String.fromCharCode(65 + seedIndex);
          
          return (
            <div key={seed.id} className="glass-card seed-card animate-fade-in">
              <div className="card-header">
                <div className="title-area">
                  <span className="static-id">Seed {seedChar}</span>
                  <span className="pencil-icon" title="แก้ไขชื่อเรียก">✎</span>
                  <input 
                    className="editable-title"
                    value={seed.label}
                    onChange={(e) => dispatch({ type: 'UPDATE_SEED_LABEL', id: seed.id, label: e.target.value })}
                  />
                </div>
                <button 
                  className="icon-btn trash-btn"
                  title="ลบคีย์ชุดนี้"
                  onClick={() => dispatch({ type: 'DELETE_SEED', id: seed.id })}
                >
                  🗑️
                </button>
              </div>

              <div className="seed-config">
                  <div className="config-row">
                    <label>ลักษณะการสร้าง Share:</label>
                    <select 
                        className="type-select"
                        value={seed.type}
                        onChange={(e) => dispatch({ 
                            type: 'UPDATE_SEED_TYPE', 
                            id: seed.id, 
                            seedType: e.target.value,
                            threshold: e.target.value === 'multi' ? 2 : 1,
                            shareCount: e.target.value === 'multi' ? 3 : 1
                        })}
                    >
                        <option value="single">Single Share (Standard)</option>
                        <option value="multi">Multi Share (SSS / Shamir)</option>
                    </select>
                  </div>

                  {seed.type === 'multi' && (
                      <div className="multi-params">
                          <div className="param">
                              <label>Threshold (m):</label>
                              <input 
                                  type="number" min="1" max={seed.shareCount} 
                                  value={seed.threshold}
                                  onChange={(e) => dispatch({ 
                                      type: 'UPDATE_SEED_TYPE', 
                                      id: seed.id, 
                                      threshold: Math.max(1, parseInt(e.target.value))
                                  })}
                              />
                          </div>
                          <div className="param">
                              <label>Total Shares (n):</label>
                              <input 
                                  type="number" min="2" max="15"
                                  value={seed.shareCount}
                                  onChange={(e) => dispatch({ 
                                      type: 'UPDATE_SEED_TYPE', 
                                      id: seed.id, 
                                      shareCount: parseInt(e.target.value)
                                  })}
                              />
                          </div>
                      </div>
                  )}
              </div>

              <div className="wallet-tree">
                {/* 1. Standard Wallet (No Passphrase) */}
                <div className="wallet-group">
                  <div className="wallet-group-header">
                    <div className="wallet-header-info">
                      <span className="wallet-icon">📁</span>
                      <strong>Standard Wallet</strong>
                      <span className="sub-hint">(no passphrase)</span>
                    </div>
                  </div>
                  <div className="account-list">
                    {(() => {
                      const standardAccounts = seed.accounts.filter(a => !a.passphraseId);
                      const singles = standardAccounts.filter(a => a.type === 'single-sig').map((a, i) => ({ ...a, displayIdx: i + 1 }));
                      const multis = standardAccounts.filter(a => a.type === 'multi-sig').map((a, i) => ({ ...a, displayIdx: i + 1 }));
                      const sorted = [...singles, ...multis];
                      const hasHidden = seed.passphrases.length > 0;

                      return sorted.map((acc, idx) => (
                        <div key={acc.id} className={`tree-row type-${acc.type}`}>
                          <span className="tree-branch">{idx === sorted.length - 1 ? '└─' : '├─'}</span>
                          <div className={`acc-node type-${acc.type}`}>
                            <div className="acc-meta">
                              <span className="acc-name">{seed.label}_standard_{acc.type === 'single-sig' ? 'SingleSig' : 'Multisig'} #{acc.displayIdx}</span>
                              <select 
                                  className="acc-type-select"
                                  value={acc.type}
                                  onChange={(e) => dispatch({ type: 'UPDATE_ACCOUNT_TYPE', id: acc.id, accType: e.target.value })}
                              >
                                  <option value="single-sig">SingleSig</option>
                                  <option value="multi-sig">Multisig Part</option>
                              </select>
                            </div>
                            <button className="node-delete" title="ลบบัญชี" onClick={() => dispatch({ type: 'DELETE_ACCOUNT', id: acc.id })}>🗑️</button>
                          </div>
                        </div>
                      ));
                    })()}
                    <button className="add-node-btn" onClick={() => dispatch({ type: 'ADD_ACCOUNT', seedId: seed.id, passphraseId: null })}>
                      + เพิ่ม Account (Standard)
                    </button>
                  </div>
                </div>

                {/* 2. Hidden Wallets (With Passphrases) */}
                {seed.passphrases.map((pass, passIdx, passArr) => {
                  const pChar = String.fromCharCode(65 + passIdx);
                  const passAccounts = seed.accounts.filter(a => a.passphraseId === pass.id);
                  
                  return (
                    <div key={pass.id} className="wallet-group">
                      <div className="wallet-group-header">
                        <div className="wallet-header-info">
                          <span className="wallet-icon">🕵️</span>
                          <div className="pass-editor">
                            <span className="static-id small">Passphrase {pChar}</span>
                            <span className="pencil-icon small">✎</span>
                            <input 
                              className="pass-input"
                              value={pass.label}
                              onChange={(e) => dispatch({ type: 'UPDATE_PASSPHRASE_LABEL', id: pass.id, label: e.target.value })}
                            />
                          </div>
                        </div>
                        <button className="node-delete" title="ลบ Passphrase (และบัญชีทั้งหมดข้างใน)" onClick={() => dispatch({ type: 'DELETE_PASSPHRASE', id: pass.id })}>🗑️</button>
                      </div>
                      <div className="account-list">
                        <div className="tree-guide-line"></div>
                        {(() => {
                          const passAccounts = seed.accounts.filter(a => a.passphraseId === pass.id);
                          const singles = passAccounts.filter(a => a.type === 'single-sig').map((a, i) => ({ ...a, displayIdx: i + 1 }));
                          const multis = passAccounts.filter(a => a.type === 'multi-sig').map((a, i) => ({ ...a, displayIdx: i + 1 }));
                          const sorted = [...singles, ...multis];

                          return sorted.map((acc, idx) => (
                            <div key={acc.id} className={`tree-row type-${acc.type}`}>
                              <span className="tree-branch">{idx === sorted.length - 1 ? '└─' : '├─'}</span>
                              <div className={`acc-node type-${acc.type}`}>
                                <div className="acc-meta">
                                  <span className="acc-name">{seed.label}_Hidden {pChar}_{acc.type === 'single-sig' ? 'SingleSig' : 'Multisig'} #{acc.displayIdx}</span>
                                  <select 
                                      className="acc-type-select"
                                      value={acc.type}
                                      onChange={(e) => dispatch({ type: 'UPDATE_ACCOUNT_TYPE', id: acc.id, accType: e.target.value })}
                                  >
                                      <option value="single-sig">SingleSig</option>
                                      <option value="multi-sig">Multisig Part</option>
                                  </select>
                                </div>
                                <button className="node-delete" title="ลบบัญชี" onClick={() => dispatch({ type: 'DELETE_ACCOUNT', id: acc.id })}>🗑️</button>
                              </div>
                            </div>
                          ));
                        })()}
                        <button className="add-node-btn" onClick={() => dispatch({ type: 'ADD_ACCOUNT', seedId: seed.id, passphraseId: pass.id })}>
                          + เพิ่ม Account (สำหรับ {pass.label})
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button className="add-wallet-btn" onClick={() => dispatch({ type: 'ADD_PASSPHRASE', seedId: seed.id })}>
                  + เพิ่ม Passphrase (สร้าง Hidden Wallet ใหม่)
                </button>
              </div>
            </div>
          );
        })}

        <button className="add-btn" onClick={() => dispatch({ type: 'ADD_SEED' })}>
          <span className="add-icon">+</span>
          เพิ่มชุด Seed ใหม่
        </button>
      </div>
    </div>
  );
}

export default KeyLab;
