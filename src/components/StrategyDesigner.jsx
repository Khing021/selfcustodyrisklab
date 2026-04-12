import React, { useMemo } from 'react';
import { useSimulation } from '../store/SimulationContext';

function StrategyDesigner() {
  const { state, dispatch } = useSimulation();

  // 1. Derive all physical objects (Logical + physical instances)
  const derivedObjectGroups = useMemo(() => {
    const groups = [];

    state.seeds.forEach(seed => {
      // Hardware Wallets (Unified per Seed)
      groups.push({
        id: `obj-hw-${seed.id}`,
        name: `Hardware Wallet (${seed.label})`,
        type: 'hw-wallet',
        seedId: seed.id,
        isCopyable: false
      });

      // Mnemonic Backup
      groups.push({
        id: `obj-mnemonic-${seed.id}`,
        name: `Mnemonic Backup (${seed.label})`,
        type: 'mnemonic',
        seedId: seed.id,
        isCopyable: true
      });

      // Passphrase Backups
      seed.passphrases.forEach(pass => {
        groups.push({
          id: `obj-pass-${pass.id}`,
          name: `Passphrase Backup (${seed.label} - ${pass.label})`,
          type: 'passphrase',
          passphraseId: pass.id,
          isCopyable: true
        });
      });
      
      // Mnemonic Shares (if Multisig seed)
      if (seed.type === 'multi') {
        for (let i = 1; i <= seed.shareCount; i++) {
          groups.push({
            id: `obj-share-${seed.id}-${i}`,
            name: `Mnemonic Share #${i} (${seed.label})`,
            type: 'share',
            seedId: seed.id,
            shareIndex: i,
            isCopyable: true // Shares can also be copied
          });
        }
      }
    });

    return groups;
  }, [state.seeds]);

  // Helper to filter objects for a specific method
  const getMethodObjects = (method) => {
    const requiredIds = new Set();
    method.keySlots.forEach(accId => {
      if (!accId) return;
      const account = state.seeds.flatMap(s => s.accounts).find(a => a.id === accId);
      const seed = state.seeds.find(s => s.accounts.some(a => a.id === accId));
      if (!account || !seed) return;

      // HW & Mnemonic always relevant if seed used
      requiredIds.add(`obj-hw-${seed.id}`);
      requiredIds.add(`obj-mnemonic-${seed.id}`);

      // Shares relevant if multisig accounts are used
      if (seed.type === 'multi') {
        for (let i = 1; i <= seed.shareCount; i++) {
          requiredIds.add(`obj-share-${seed.id}-${i}`);
        }
      }

      // Specific Passphrase only if THIS account uses it
      if (account.passphraseId) {
        requiredIds.add(`obj-pass-${account.passphraseId}`);
      }
    });

    return derivedObjectGroups.filter(obj => requiredIds.has(obj.id));
  };

  return (
    <div className="strategy-designer">
      <div className="methods-container-v3">
        {state.spendingMethods.map((method, methodIdx) => {
          const methodChar = String.fromCharCode(65 + methodIdx);
          const isInvalid = method.keySlots.some(slot => !slot);
          const selectableAccounts = state.seeds.flatMap(s => s.accounts).filter(acc => {
              if (method.type === 'single-sig') return acc.type === 'single-sig';
              return acc.type === 'multi-sig';
          });
          const relevantObjects = getMethodObjects(method);

          return (
            <div key={method.id} className={`method-container-v3 ${isInvalid ? 'invalid-config' : ''}`}>
              <header className="method-main-header">
                <h3>Spending Method {methodChar}: <span className="pencil-icon">✎</span>
                  <input 
                    className="method-label-input-v3"
                    value={method.label}
                    onChange={(e) => dispatch({ type: 'RENAME_METHOD', id: method.id, label: e.target.value })}
                  />
                </h3>
                {state.spendingMethods.length > 1 && (
                    <button className="icon-btn trash-btn" title="ลบกลยุทธ์นี้" onClick={() => dispatch({ type: 'DELETE_METHOD', id: method.id })}>🗑️</button>
                )}
              </header>

              <div className="method-inner-grid">
                {/* Sub-box 1: Spending Scheme */}
                <div className="method-sub-box glass-card sub-scheme">
                  <header className="sub-box-header">
                    <h4>1. Spending Scheme</h4>
                    <select 
                      className="scheme-select-v3"
                      value={method.type}
                      onChange={(e) => dispatch({ type: 'UPDATE_METHOD', id: method.id, updates: { type: e.target.value } })}
                    >
                      <option value="single-sig">Single Signature</option>
                      <option value="multi-sig">Multi-Signature (Multisig)</option>
                    </select>
                  </header>

                  {method.type === 'multi-sig' && (
                    <div className="multi-config-row-v3">
                      <div className="param-item">
                          <label>Threshold (m):</label>
                          <input 
                              type="number" min="1" max={method.keySlots.length}
                              value={method.threshold}
                              onChange={(e) => dispatch({ type: 'UPDATE_METHOD', id: method.id, updates: { threshold: parseInt(e.target.value) } })}
                          />
                      </div>
                      <div className="param-item">
                          <label>Total Slots (n):</label>
                          <input 
                              type="number" min="1" max="15"
                              value={method.keySlots.length}
                              onChange={(e) => dispatch({ type: 'UPDATE_METHOD', id: method.id, updates: { shareCount: parseInt(e.target.value) } })}
                          />
                      </div>
                    </div>
                  )}

                  <div className="key-slot-grid-v3">
                    {method.keySlots.map((slot, idx) => (
                       <div key={idx} className={`slot-item-v3 ${!slot ? 'slot-empty' : ''}`}>
                          <span className="slot-num">{idx + 1}.</span>
                          <select 
                            value={slot || ''}
                            onChange={(e) => {
                              const newSlots = [...method.keySlots];
                              newSlots[idx] = e.target.value;
                              dispatch({ type: 'UPDATE_METHOD', id: method.id, updates: { keySlots: newSlots } });
                            }}
                          >
                            <option value="">-- เลือก Account ({method.type === 'single-sig' ? 'Single' : 'Multi'}) --</option>
                            {selectableAccounts.map(acc => {
                               // Find seed to replicate Section 2 naming
                               const seed = state.seeds.find(s => s.accounts.some(a => a.id === acc.id));
                               const seedChar = seed ? String.fromCharCode(65 + state.seeds.indexOf(seed)) : '?';
                               const pass = seed?.passphrases.find(p => p.id === acc.passphraseId);
                               const pChar = pass ? String.fromCharCode(65 + seed.passphrases.indexOf(pass)) : '';
                               
                               // Calculate displayIdx on-the-fly to match KeyLab numbering
                               let displayIdx = '?';
                               if (seed) {
                                  const siblings = seed.accounts.filter(a => a.passphraseId === acc.passphraseId && a.type === acc.type);
                                  displayIdx = siblings.findIndex(a => a.id === acc.id) + 1;
                                }

                               let displayName = acc.label;
                               if (seed) {
                                  const groupPrefix = acc.passphraseId ? `Hidden ${pChar}` : 'standard';
                                  const typeName = acc.type === 'single-sig' ? 'SingleSig' : 'Multisig';
                                  displayName = `Seed ${seedChar}_${groupPrefix}_${typeName} #${displayIdx}`;
                               }

                               return (
                                 <option key={acc.id} value={acc.id}>{displayName}</option>
                               );
                            })}
                          </select>
                       </div>
                    ))}
                  </div>
                  {isInvalid && (
                      <div className="validation-notice-v3">
                          ⚠️ ระบุกุญแจไม่ครบ ไม่สามารถสรุปผลได้
                      </div>
                  )}
                </div>

                {/* Sub-box 2: Physical Object Storage */}
                <div className="method-sub-box glass-card sub-storage">
                  <h4>2. Physical Object Storage</h4>
                  {relevantObjects.length === 0 ? (
                    <p className="empty-hint">กรุณาเลือก Account ในส่วน Spending Scheme เพื่อระบุสิ่งของที่ต้องเก็บรักษา</p>
                  ) : (
                    <div className="object-table-container-v3">
                       <table className="object-table-v3">
                         <thead>
                           <tr>
                             <th>วัตถุทางกายภาพ</th>
                             <th>สถานที่เก็บรักษา</th>
                           </tr>
                         </thead>
                         <tbody>
                           {relevantObjects.map(obj => {
                             const totalInstances = (state.replication[obj.id] || 0) + 1;
                             const hasCopies = totalInstances > 1;

                             return (
                               <React.Fragment key={obj.id}>
                                 <tr className="object-row-primary-v3">
                                   <td>
                                      <div className="obj-name-cell">
                                         <span className="obj-icon">
                                           {obj.type === 'hw-wallet' ? '📟' : obj.type === 'passphrase' ? '🧠' : '📄'}
                                         </span>
                                         <strong>{obj.name}</strong>
                                      </div>
                                   </td>
                                   <td>
                                      <div className="obj-actions-cell">
                                         {!hasCopies && (
                                            <select 
                                                value={state.objectMapping[obj.id]?.storagePointId || ''}
                                                onChange={(e) => {
                                                  const pointId = e.target.value;
                                                  const point = state.locations.flatMap(l => l.storagePoints).find(p => p.id === pointId);
                                                  const cloud = state.clouds.find(c => c.id === pointId);
                                                  dispatch({ 
                                                    type: 'MAP_OBJECT', 
                                                    objectId: obj.id, 
                                                    locationId: point ? state.locations.find(l => l.storagePoints.some(sp => sp.id === pointId)).id : (cloud ? cloud.id : 'memory'),
                                                    storagePointId: pointId
                                                  });
                                                }}
                                              >
                                                <option value="">
                                                  {obj.type === 'hw-wallet' ? '-- ไม่ใช้ --' : '-- ไม่บันทึก (จำ) --'}
                                                </option>
                                                {state.locations.flatMap((loc, lIdx) => {
                                                  const locChar = String.fromCharCode(65 + lIdx);
                                                  return loc.storagePoints.map((p, pIdx) => (
                                                    <option key={p.id} value={p.id}>{loc.label} - {p.label.replace(/\(.*\)/, '').trim()} ({locChar}{pIdx + 1})</option>
                                                  ));
                                                })}
                                                {state.clouds.length > 0 && obj.type !== 'hw-wallet' && (
                                                  <>
                                                    <optgroup label="Cloud Storage">
                                                      {state.clouds.map((cloud, cIdx) => {
                                                        const cloudChar = String.fromCharCode(65 + cIdx);
                                                        return (
                                                          <option key={cloud.id} value={cloud.id}>{cloud.label} ({cloudChar})</option>
                                                        );
                                                      })}
                                                    </optgroup>
                                                  </>
                                                )}
                                              </select>
                                         )}
                                         {obj.isCopyable && (
                                             <button className="add-copy-mini" onClick={() => dispatch({ type: 'ADD_OBJECT_COPY', logicalId: obj.id })}>
                                                 + เพิ่มสำเนา
                                             </button>
                                         )}
                                      </div>
                                   </td>
                                 </tr>
                                 {hasCopies && Array.from({ length: totalInstances }).map((_, i) => {
                                     const copyIdx = i + 1;
                                     const instanceId = i === 0 ? obj.id : `${obj.id}-copy-${i}`;
                                     const mapping = state.objectMapping[instanceId] || { locationId: '', storagePointId: '' };
                                     return (
                                        <tr key={instanceId} className="object-row-replica-v3">
                                            <td>
                                                <div className="replica-label">
                                                    <span className="tree-branch">{copyIdx === totalInstances ? '└─' : '├─'}</span>
                                                    <span>สำเนา #{copyIdx}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="obj-actions-cell">
                                                    <select 
                                                        value={mapping.storagePointId}
                                                        onChange={(e) => {
                                                            const pointId = e.target.value;
                                                            const point = state.locations.flatMap(l => l.storagePoints).find(p => p.id === pointId);
                                                            const cloud = state.clouds.find(c => c.id === pointId);
                                                            dispatch({ 
                                                                type: 'MAP_OBJECT', 
                                                                objectId: instanceId, 
                                                                locationId: point ? state.locations.find(l => l.storagePoints.some(sp => sp.id === pointId)).id : (cloud ? cloud.id : 'memory'),
                                                                storagePointId: pointId
                                                            });
                                                        }}
                                                    >
                                                        <option value="">-- ไม่บันทึก (จำ) --</option>
                                                        {state.locations.flatMap((loc, lIdx) => {
                                                            const locChar = String.fromCharCode(65 + lIdx);
                                                            return loc.storagePoints.map((p, pIdx) => (
                                                                <option key={p.id} value={p.id}>{loc.label} - {p.label.replace(/\(.*\)/, '').trim()} ({locChar}{pIdx + 1})</option>
                                                            ));
                                                        })}
                                                        {state.clouds.length > 0 && obj.type !== 'hw-wallet' && (
                                                            <optgroup label="Cloud Storage">
                                                                {state.clouds.map((cloud, cIdx) => {
                                                                    const cloudChar = String.fromCharCode(65 + cIdx);
                                                                    return (
                                                                        <option key={cloud.id} value={cloud.id}>{cloud.label} ({cloudChar})</option>
                                                                    );
                                                                })}
                                                            </optgroup>
                                                        )}
                                                    </select>
                                                    <button className="icon-btn trash-btn mini-trash" title="ลบสำเนานี้" onClick={() => dispatch({ type: 'DELETE_OBJECT_COPY', logicalId: obj.id, copyIdx: i })}>
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                     )
                                 })}
                               </React.Fragment>
                             );
                           })}
                         </tbody>
                       </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {(() => {
        const hasDescriptor = state.spendingMethods.length > 1 || 
                             (state.spendingMethods.length === 1 && state.spendingMethods[0].type === 'multi-sig');
        
        if (!hasDescriptor) return null;

        const descriptorObj = {
          id: 'obj-wallet-descriptor',
          name: 'Wallet Descriptor (Miniscript / Config File)',
          type: 'descriptor',
          isCopyable: true
        };

        const totalInstances = (state.replication[descriptorObj.id] || 0) + 1;
        
        // Validation: Every instance must have a storage point selected
        const descriptorInstances = Array.from({ length: totalInstances }).map((_, i) => 
          i === 0 ? descriptorObj.id : `${descriptorObj.id}-copy-${i}`
        );
        const isDescriptorInvalid = descriptorInstances.some(instId => !state.objectMapping[instId]?.storagePointId);

        return (
          <div className="descriptor-section animate-fade-in">
             <div className={`descriptor-card glass-card ${isDescriptorInvalid ? 'invalid-config' : ''}`}>
                <header className="descriptor-header">
                   <div className="title-group">
                      <span className="descriptor-icon">📜</span>
                      <h4>Wallet Descriptor</h4>
                   </div>
                   <div className="descriptor-info">
                      สิ่งประดิษฐ์ที่บอกโครงสร้างของกระเป๋า จำเป็นสำหรับการกู้คืนหากใช้ Multisig หรือมีหลายบัญชี
                   </div>
                </header>
                
                <div className="object-table-container-v3">
                   <table className="object-table-v3">
                     <thead>
                       <tr>
                         <th>กุญแจสำคัญด้านโครงสร้าง</th>
                         <th>สถานที่เก็บรักษา</th>
                       </tr>
                     </thead>
                     <tbody>
                        <tr className="object-row-primary-v3">
                          <td><strong>{descriptorObj.name}</strong></td>
                          <td>
                            <div className="obj-actions-cell">
                               {totalInstances === 1 && (
                                  <select 
                                      value={state.objectMapping[descriptorObj.id]?.storagePointId || ''}
                                      onChange={(e) => {
                                        const pointId = e.target.value;
                                        const point = state.locations.flatMap(l => l.storagePoints).find(p => p.id === pointId);
                                        const cloud = state.clouds.find(c => c.id === pointId);
                                        dispatch({ 
                                          type: 'MAP_OBJECT', 
                                          objectId: descriptorObj.id, 
                                          locationId: point ? state.locations.find(l => l.storagePoints.some(sp => sp.id === pointId)).id : (cloud ? cloud.id : 'memory'),
                                          storagePointId: pointId
                                        });
                                      }}
                                    >
                                      <option value="">-- โปรดเลือกจุดเก็บ --</option>
                                      {state.locations.flatMap((loc, lIdx) => {
                                        const locChar = String.fromCharCode(65 + lIdx);
                                        return loc.storagePoints.map((p, pIdx) => (
                                          <option key={p.id} value={p.id}>{loc.label} - {p.label.replace(/\(.*\)/, '').trim()} ({locChar}{pIdx + 1})</option>
                                        ));
                                      })}
                                      {state.clouds.length > 0 && (
                                          <optgroup label="Cloud Storage">
                                              {state.clouds.map((cloud, cIdx) => {
                                                  const cloudChar = String.fromCharCode(65 + cIdx);
                                                  return (
                                                      <option key={cloud.id} value={cloud.id}>{cloud.label} ({cloudChar})</option>
                                                  );
                                              })}
                                          </optgroup>
                                      )}
                                    </select>
                               )}
                               <button className="add-copy-mini" onClick={() => dispatch({ type: 'ADD_OBJECT_COPY', logicalId: descriptorObj.id })}>
                                   + เพิ่มสำเนา
                               </button>
                            </div>
                          </td>
                        </tr>
                        {totalInstances > 1 && Array.from({ length: totalInstances }).map((_, i) => {
                           const copyIdx = i + 1;
                           const instanceId = i === 0 ? descriptorObj.id : `${descriptorObj.id}-copy-${i}`;
                           const mapping = state.objectMapping[instanceId] || { locationId: '', storagePointId: '' };
                           return (
                              <tr key={instanceId} className="object-row-replica-v3">
                                  <td>
                                      <div className="replica-label">
                                          <span className="tree-branch">{copyIdx === totalInstances ? '└─' : '├─'}</span>
                                          <span>สำเนา #{copyIdx}</span>
                                      </div>
                                  </td>
                                  <td>
                                      <div className="obj-actions-cell">
                                          <select 
                                              value={mapping.storagePointId}
                                              onChange={(e) => {
                                                  const pointId = e.target.value;
                                                  const point = state.locations.flatMap(l => l.storagePoints).find(p => p.id === pointId);
                                                  const cloud = state.clouds.find(c => c.id === pointId);
                                                  dispatch({ 
                                                      type: 'MAP_OBJECT', 
                                                      objectId: instanceId, 
                                                      locationId: point ? state.locations.find(l => l.storagePoints.some(sp => sp.id === pointId)).id : (cloud ? cloud.id : 'memory'),
                                                      storagePointId: pointId
                                                  });
                                              }}
                                          >
                                              <option value="">-- โปรดเลือกจุดเก็บ --</option>
                                              {state.locations.flatMap((loc, lIdx) => {
                                                  const locChar = String.fromCharCode(65 + lIdx);
                                                  return loc.storagePoints.map((p, pIdx) => (
                                                      <option key={p.id} value={p.id}>{loc.label} - {p.label.replace(/\(.*\)/, '').trim()} ({locChar}{pIdx + 1})</option>
                                                  ));
                                              })}
                                              {state.clouds.length > 0 && (
                                                  <optgroup label="Cloud Storage">
                                                      {state.clouds.map((cloud, cIdx) => {
                                                          const cloudChar = String.fromCharCode(65 + cIdx);
                                                          return (
                                                              <option key={cloud.id} value={cloud.id}>{cloud.label} ({cloudChar})</option>
                                                          );
                                                      })}
                                                  </optgroup>
                                              )}
                                          </select>
                                          <button className="icon-btn trash-btn mini-trash" title="ลบสำเนานี้" onClick={() => dispatch({ type: 'DELETE_OBJECT_COPY', logicalId: descriptorObj.id, copyIdx: i })}>
                                              🗑️
                                          </button>
                                      </div>
                                  </td>
                              </tr>
                           );
                        })}
                     </tbody>
                   </table>
                </div>

                {isDescriptorInvalid && (
                    <div className="validation-notice-v3" style={{ margin: '12px 24px 24px' }}>
                        ⚠️ โปรดเลือกจุดเก็บเพื่อสำรองไฟล์ Wallet Descriptor นอกความจำ
                    </div>
                )}
             </div>
          </div>
        );

      })()}
      
      <div className="methods-footer">
          <button className="add-btn" onClick={() => dispatch({ type: 'ADD_SPENDING_METHOD' })}>
            <span className="add-icon">+</span>
            เพิ่ม spending method ใหม่
          </button>
      </div>
    </div>
  );
}

export default StrategyDesigner;
