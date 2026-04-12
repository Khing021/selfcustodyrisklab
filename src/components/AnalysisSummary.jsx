import React, { useMemo, useState } from 'react';
import { useSimulation } from '../store/SimulationContext';

function AnalysisSummary() {
  const { state } = useSimulation();
  const [expandedItems, setExpandedItems] = useState(new Set());

  const toggleExpand = (itemId) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // Helper to get all objects and their current location
  const allObjects = useMemo(() => {
    const objects = [];

    state.seeds.forEach(seed => {
      const logicals = [];
      logicals.push({ logicalId: `obj-hw-${seed.id}`, name: `Hardware Wallet (${seed.label})`, type: 'hw-wallet', seedId: seed.id });
      if (seed.type === 'single') {
        logicals.push({ logicalId: `obj-mnemonic-${seed.id}`, name: `Mnemonic (${seed.label})`, type: 'mnemonic', seedId: seed.id });
      } else {
        for (let i = 1; i <= seed.shareCount; i++) {
          logicals.push({ logicalId: `obj-share-${seed.id}-${i}`, name: `Share #${i} (${seed.label})`, type: 'share', seedId: seed.id, threshold: seed.threshold });
        }
      }
      seed.passphrases.forEach(p => {
        logicals.push({ logicalId: `obj-pass-${p.id}`, name: `Passphrase (${p.label})`, type: 'passphrase', passphraseId: p.id, seedId: seed.id });
      });

      logicals.forEach(log => {
        objects.push({ ...log, id: log.logicalId });
        const copyCount = state.replication[log.logicalId] || 0;
        for (let i = 1; i <= copyCount; i++) {
          objects.push({ ...log, id: `${log.logicalId}-copy-${i}`, name: `${log.name} (Copy #${i})` });
        }
      });
    });

    // Add Wallet Descriptor if applicable
    const hasDescriptor = state.spendingMethods.length > 1 || 
                         (state.spendingMethods.length === 1 && state.spendingMethods[0].type === 'multi-sig');
    if (hasDescriptor) {
      const log = { logicalId: 'obj-wallet-descriptor', name: 'Wallet Descriptor', type: 'descriptor' };
      objects.push({ ...log, id: log.logicalId });
      const copyCount = state.replication[log.logicalId] || 0;
      for (let i = 1; i <= copyCount; i++) {
        objects.push({ ...log, id: `${log.logicalId}-copy-${i}`, name: `${log.name} (Copy #${i})` });
      }
    }

    return objects;
  }, [state.seeds, state.replication, state.spendingMethods, state.clouds]);

  const configValidation = useMemo(() => {
    const isMethodsValid = state.spendingMethods.every(m => m.keySlots.every(slot => !!slot));
    
    let isDescriptorValid = true;
    const hasDescriptor = state.spendingMethods.length > 1 || 
                         (state.spendingMethods.length === 1 && state.spendingMethods[0].type === 'multi-sig');
    
    if (hasDescriptor) {
      const descriptorId = 'obj-wallet-descriptor';
      const totalInstances = (state.replication[descriptorId] || 0) + 1;
      for (let i = 0; i < totalInstances; i++) {
        const instId = i === 0 ? descriptorId : `${descriptorId}-copy-${i}`;
        if (!state.objectMapping[instId]?.storagePointId) {
          isDescriptorValid = false;
          break;
        }
      }
    }

    return {
      isValid: isMethodsValid && isDescriptorValid,
      reason: !isMethodsValid ? 'missing-accounts' : (!isDescriptorValid ? 'missing-descriptor-storage' : 'none')
    };
  }, [state.spendingMethods, state.replication, state.objectMapping]);

  const isConfigValid = configValidation.isValid;


  const hasDescriptorRequirement = useMemo(() => {
    return state.spendingMethods.length > 1 || 
           (state.spendingMethods.length === 1 && state.spendingMethods[0].type === 'multi-sig');
  }, [state.spendingMethods]);

  const getRelevantObjectsForMethod = (method) => {
    const logicalIds = new Set();
    method.keySlots.forEach(accId => {
       const account = state.seeds.flatMap(s => s.accounts).find(a => a.id === accId);
       const seed = state.seeds.find(s => s.accounts.some(a => a.id === accId));
       if (seed) {
          logicalIds.add(`obj-hw-${seed.id}`);
          if (seed.type === 'single') logicalIds.add(`obj-mnemonic-${seed.id}`);
          else {
             for (let i = 1; i <= seed.shareCount; i++) logicalIds.add(`obj-share-${seed.id}-${i}`);
          }
       }
       if (account?.passphraseId) logicalIds.add(`obj-pass-${account.passphraseId}`);
    });
    if (hasDescriptorRequirement) logicalIds.add('obj-wallet-descriptor');
    
    return allObjects.filter(obj => logicalIds.has(obj.logicalId));
  };

  const simulations = useMemo(() => {
    const results = { normal: [], compromise: [], disaster: [], forget: [] };

    const getSatisfactionChecker = (method) => (availableObjects) => {
        const satisfiedKeys = method.keySlots.filter(accId => {
          if (!accId) return false;
          const account = state.seeds.flatMap(s => s.accounts).find(a => a.id === accId);
          const seed = state.seeds.find(s => s.accounts.some(a => a.id === accId));
          if (!account || !seed) return false;
          const hasHW = availableObjects.some(o => o.type === 'hw-wallet' && o.seedId === seed.id);
          const hasPass = account.passphraseId ? availableObjects.some(o => o.passphraseId === account.passphraseId) : true;
          let hasSeed = false;
          if (seed.type === 'single') {
            hasSeed = availableObjects.some(o => o.seedId === seed.id && o.type === 'mnemonic');
          } else {
            const sharesAtLocations = availableObjects.filter(o => o.seedId === seed.id && o.type === 'share');
            const uniqueShares = new Set(sharesAtLocations.map(s => s.logicalId)).size;
            hasSeed = uniqueShares >= seed.threshold;
          }
          return (hasHW || hasSeed) && hasPass;
        });
        return satisfiedKeys.length >= method.threshold;
    };

    state.locations.forEach(location => {
      {
        const compromisedMethodStatuses = state.spendingMethods.map(method => {
        const checkSatisfied = getSatisfactionChecker(method);
        const stolenObjects = [];
        const compromisableObjects = [];
        const externalObjects = allObjects.filter(obj => {
            const mapping = state.objectMapping[obj.id];
            return !mapping || mapping.locationId !== location.id;
        });
        
        allObjects.forEach(obj => {
          const mapping = state.objectMapping[obj.id];
          if (mapping && mapping.locationId === location.id) {
            const point = location.storagePoints.find(p => p.id === mapping.storagePointId);
            const isHw = obj.type === 'hw-wallet';
            const isLocked = point && point.isLocked;
            if (isLocked || isHw) compromisableObjects.push(obj);
            else stolenObjects.push(obj);
          } else if (mapping && mapping.locationId.startsWith('Cloud-')) {
            const cloud = (state.clouds || []).find(c => c.id === mapping.locationId);
            if (cloud && !cloud.isLocked) stolenObjects.push(obj);
            else if (cloud && cloud.isLocked) compromisableObjects.push(obj);
          }
        });

        const thiefCanSpendNow = checkSatisfied(stolenObjects);
        const userCannotRecoverBase = !checkSatisfied(externalObjects);
        const isCompromised = thiefCanSpendNow || (stolenObjects.length > 0 && userCannotRecoverBase);

        const thiefHasDescriptor = hasDescriptorRequirement && 
                                   [...stolenObjects, ...compromisableObjects].some(o => o.type === 'descriptor');

        const thiefCouldSpendIfCrack = !isCompromised && checkSatisfied([...stolenObjects, ...compromisableObjects]);
        const userNeedsLockedToSurvive = !isCompromised && userCannotRecoverBase && checkSatisfied([...externalObjects, ...compromisableObjects]);
        
        let isAtRisk = thiefCouldSpendIfCrack || userNeedsLockedToSurvive || thiefHasDescriptor;

        let reason = 'none';
        if (thiefCanSpendNow) reason = 'thief-spend';
        else if (isCompromised && userCannotRecoverBase) reason = 'user-loss';
        else if (thiefHasDescriptor) reason = 'privacy-loss';
        else if (thiefCouldSpendIfCrack) reason = 'crack-risk';
        else if (userNeedsLockedToSurvive) reason = 'lock-survival';

        // Attach details for DRILL-DOWN
        const relevant = getRelevantObjectsForMethod(method);
        const details = relevant.map(obj => {
           const isStolenNow = stolenObjects.some(s => s.id === obj.id);
           const isAtRiskHere = compromisableObjects.some(r => r.id === obj.id);
           const mapping = state.objectMapping[obj.id];
           const isCloud = mapping?.locationId.startsWith('Cloud-');
           
           let statusLabel = '✅ ปลอดภัย (อยู่นอกพื้นที่)';
           let icon = '✅';

           if (isStolenNow) {
              if (isCloud) {
                statusLabel = '🚨 เข้าถึงได้โดยแฮ็กเกอร์หรือผู้ให้บริการคลาวด์';
                icon = '🚨';
              } else {
                statusLabel = obj.type === 'hw-wallet' ? '⚠️ ตกอยู่ในมือโจร (ถูกปกป้องด้วย PIN)' : '🚨 ตกอยู่ในมือโจร';
                icon = isStolenNow && obj.type === 'hw-wallet' ? '⚠️' : '🚨';
              }
           } else if (isAtRiskHere) {
              if (isCloud) {
                statusLabel = '⚠️ เสี่ยงถูกแกะรหัส (อยู่ในที่ที่แฮ็กเกอร์อาจบุกถึง)';
                icon = '⚠️';
              } else {
                statusLabel = '⚠️ เสี่ยงถูกแกะรหัส (อยู่ในจุดที่โจรบุกถึง)';
                icon = '⚠️';
              }
           }
           return { ...obj, statusLabel, icon };
        });

        const canSpend = !userCannotRecoverBase;
        return { methodLabel: method.label, isCompromised, isAtRisk, canSpend, reason, details };
      });

      const isCompromised = compromisedMethodStatuses.some(s => s.isCompromised);
      const isAtRisk = compromisedMethodStatuses.some(s => s.isAtRisk);
      const workingMethods = compromisedMethodStatuses.filter(s => s.canSpend).map(s => s.methodLabel);
      const isRecoverable = workingMethods.length > 0;

      let outcome = 'safe';
      if (isCompromised) outcome = 'critical';
      else if (isAtRisk) outcome = 'warning';
      else if (!isRecoverable) outcome = 'critical';

        results.compromise.push({ location, statuses: compromisedMethodStatuses, outcome, workingMethods, isRecoverable });
      }

      // --- DISASTER SIMULATION ---
      {
        const disasterMethodStatuses = state.spendingMethods.map(method => {
        const checkSatisfied = getSatisfactionChecker(method);
        const remainingObjects = allObjects.filter(obj => {
          const mapping = state.objectMapping[obj.id];
          return !mapping || mapping.locationId !== location.id;
        });

        const userHasDescriptor = !hasDescriptorRequirement || remainingObjects.some(o => o.type === 'descriptor');
        const canSpendDirectly = checkSatisfied(remainingObjects);

        const involvedSeedIds = [...new Set(method.keySlots.map(accId => {
            const seed = state.seeds.find(s => s.accounts.some(a => a.id === accId));
            return seed?.id;
        }).filter(id => !!id))];
        
        const hasAllSeeds = involvedSeedIds.every(sid => {
            const seed = state.seeds.find(s => s.id === sid);
            if (!seed) return false;
            if (seed.type === 'single') return remainingObjects.some(o => o.seedId === sid && o.type === 'mnemonic');
            const uniqueShares = new Set(remainingObjects.filter(o => o.seedId === sid && o.type === 'share').map(s => s.logicalId)).size;
            return uniqueShares === seed.shareCount;
        });

        let status = 'safe';
        if (!canSpendDirectly) status = 'critical';
        else if (canSpendDirectly && !userHasDescriptor) {
            status = hasAllSeeds ? 'warning' : 'critical';
        }

        const relevant = getRelevantObjectsForMethod(method);
        const details = relevant.map(obj => {
            const isAtLocation = state.objectMapping[obj.id]?.locationId === location.id;
            const statusLabel = isAtLocation ? '🚨 ถูกทำลาย' : '✅ ปลอดภัย (อยู่นอกพื้นที่)';
            const icon = isAtLocation ? '🚨' : '✅';
            return { ...obj, statusLabel, icon };
        });

        return { methodLabel: method.label, status, hasDescriptor: userHasDescriptor, hasAllSeeds, details };
      });

      const workingMethods = disasterMethodStatuses.filter(s => s.status !== 'critical').map(s => s.methodLabel);
      const isRecoverable = workingMethods.length > 0;
      const outcome = isRecoverable ? 'safe' : 'critical';

        results.disaster.push({ location, statuses: disasterMethodStatuses, outcome, workingMethods, isRecoverable });
      }
    });

    // --- FORGET / MEMORY LOST SIMULATIONS (C.1 - C.4) ---
    const runForgetScenario = (typeFilter) => {
        return state.spendingMethods.map(method => {
            const checkSatisfied = getSatisfactionChecker(method);
            const availableObjects = allObjects.filter(obj => {
                const mapping = state.objectMapping[obj.id];
                if (!mapping) return true; // Unassigned objects are implicitly available if not in memory? 
                // Wait, if unassigned, it's not even a thing. But let's follow the filter.
                
                const isInMemory = mapping.locationId === 'memory';
                const isCloud = mapping.locationId.startsWith('Cloud-');
                
                // Scenario Logic
                if (typeFilter === 'secrets' && isInMemory && (obj.type === 'mnemonic' || obj.type === 'share' || obj.type === 'passphrase')) return false;
                if (typeFilter === 'pin' && isInMemory && obj.type === 'hw-wallet') return false;
                if (typeFilter === 'cloud' && isCloud) {
                    const cloud = (state.clouds || []).find(c => c.id === mapping.locationId);
                    if (cloud && cloud.isLocked) return false; // Encrypted = Lost
                    return true; // Unencrypted = Warning but available
                }
                if (typeFilter === 'everything') {
                    if (isInMemory) return false; // Traditional "forget everything in head"
                    if (isCloud) {
                        const cloud = (state.clouds || []).find(c => c.id === mapping.locationId);
                        if (cloud && cloud.isLocked) return false; 
                    }
                }
                
                return true;
            });

            const userHasDescriptor = !hasDescriptorRequirement || availableObjects.some(o => o.type === 'descriptor');
            const canSpendDirectly = checkSatisfied(availableObjects);

            const involvedSeedIds = [...new Set(method.keySlots.map(accId => {
                const seed = state.seeds.find(s => s.accounts.some(a => a.id === accId));
                return seed?.id;
            }).filter(id => !!id))];
            
            const hasAllSeeds = involvedSeedIds.every(sid => {
                const seed = state.seeds.find(s => s.id === sid);
                if (!seed) return false;
                if (seed.type === 'single') return availableObjects.some(o => o.seedId === sid && o.type === 'mnemonic');
                const uniqueShares = new Set(availableObjects.filter(o => o.seedId === sid && o.type === 'share').map(s => s.logicalId)).size;
                return uniqueShares === seed.shareCount;
            });

            let status = 'safe';
            if (!canSpendDirectly) status = 'critical';
            else if (canSpendDirectly && !userHasDescriptor) {
                status = hasAllSeeds ? 'warning' : 'critical';
            }

            const relevant = getRelevantObjectsForMethod(method);
            const details = relevant.map(obj => {
                const mapping = state.objectMapping[obj.id];
                const isInMemory = mapping?.locationId === 'memory';
                const isCloud = mapping?.locationId.startsWith('Cloud-');
                let isLost = !availableObjects.some(o => o.id === obj.id);
                let isWarning = false;

                if (typeFilter === 'cloud' && isCloud) {
                    const cloud = (state.clouds || []).find(c => c.id === mapping.locationId);
                    if (cloud && !cloud.isLocked) isWarning = true;
                }
                if (typeFilter === 'everything' && isCloud) {
                    const cloud = (state.clouds || []).find(c => c.id === mapping.locationId);
                    if (cloud && !cloud.isLocked) isWarning = true;
                }

                const statusLabel = isLost ? '🚨 สูญหาย/จำไม่ได้' : (isWarning ? '⚠️ กู้คืนได้ผ่านคลาวด์' : '✅ ยังคงปลอดภัย');
                const icon = isLost ? '🚨' : (isWarning ? '⚠️' : '✅');
                return { ...obj, statusLabel, icon };
            });

            return { methodLabel: method.label, status, details };
        });
    };

    const aggregateForget = (statuses) => {
        const workingMethods = statuses.filter(s => s.status !== 'critical').map(s => s.methodLabel);
        const isRecoverable = workingMethods.length > 0;
        const outcome = isRecoverable ? 'safe' : 'critical';
        return { statuses, outcome, workingMethods, isRecoverable };
    };

    results.forget = {
        secrets: aggregateForget(runForgetScenario('secrets')),
        pin: aggregateForget(runForgetScenario('pin')),
        clouds: aggregateForget(runForgetScenario('cloud')),
        everything: aggregateForget(runForgetScenario('everything'))
    };

    // --- NORMAL SCENARIO SIMULATION (A) ---
    const unencryptedCloudObjects = allObjects.filter(obj => {
        const mapping = state.objectMapping[obj.id];
        if (!mapping || !mapping.locationId.startsWith('Cloud-')) return false;
        const cloud = (state.clouds || []).find(c => c.id === mapping.locationId);
        return cloud && !cloud.isLocked;
    });

    const cloudObjects = allObjects.filter(obj => {
        const mapping = state.objectMapping[obj.id];
        return mapping && mapping.locationId.startsWith('Cloud-');
    });

    const normalMethodStatuses = state.spendingMethods.map(method => {
        const checkSatisfied = getSatisfactionChecker(method);
        const relevantObjects = getRelevantObjectsForMethod(method);
        
        // 1. DANGER: External party can spend now
        const canExposedSpend = checkSatisfied(unencryptedCloudObjects);
        
        // 2. WARNING
        const exposedDescriptor = unencryptedCloudObjects.some(o => o.type === 'descriptor');
        const exposedSomeSecrets = unencryptedCloudObjects.some(o => ['mnemonic', 'seed', 'share', 'passphrase'].includes(o.type));
        
        const methodInvolvedLogicals = new Set(relevantObjects.map(o => o.logicalId));
        const relevantCloudObjects = cloudObjects.filter(o => methodInvolvedLogicals.has(o.logicalId));
        const allRelevantAreInCloud = relevantObjects.every(robj => 
            relevantCloudObjects.some(cobj => cobj.logicalId === robj.logicalId)
        );

        let status = 'safe';
        let reason = 'none';

        if (canExposedSpend) {
            status = 'critical';
            reason = 'exposed-spend';
        } else if (exposedDescriptor) {
            status = 'warning';
            reason = 'exposed-privacy';
        } else if (exposedSomeSecrets) {
            status = 'warning';
            reason = 'exposed-partial';
        } else if (allRelevantAreInCloud) {
            status = 'warning';
            reason = 'cloud-dependency';
        }

        // Details for drill-down (Normal condition: objects are at their assigned locations)
        const details = relevantObjects.map(obj => {
            const mapping = state.objectMapping[obj.id];
            const isCloud = mapping?.locationId.startsWith('Cloud-');
            const cloud = isCloud ? state.clouds.find(c => c.id === mapping.locationId) : null;
            const isUnencrypted = isCloud && cloud && !cloud.isLocked;

            let icon = '✅';
            let statusLabel = '✅ พร้อมใช้งาน';
            if (isUnencrypted) {
                icon = '⚠️';
                statusLabel = '⚠️ เปิดเผยบนคลาวด์ (ไม่ได้ Encrypt)';
            } else if (isCloud) {
                icon = '☁️';
                statusLabel = '☁️ เก็บไว้บนคลาวด์ (Encrypted)';
            }

            return { ...obj, statusLabel, icon };
        });

        return { methodLabel: method.label, status, reason, details };
    });

    const normalOutcome = normalMethodStatuses.some(s => s.status === 'critical') ? 'critical' : 
                          (normalMethodStatuses.some(s => s.status === 'warning') ? 'warning' : 'safe');
    const normalWorkingMethods = normalMethodStatuses.filter(s => s.status !== 'critical').map(s => s.methodLabel);
    
    results.normal = { statuses: normalMethodStatuses, outcome: normalOutcome, workingMethods: normalWorkingMethods, isRecoverable: normalWorkingMethods.length > 0 };

    return results;
  }, [state, allObjects, hasDescriptorRequirement]);

  const overallStatus = useMemo(() => {
    const outcomes = [
      simulations.normal.outcome,
      ...simulations.compromise.map(s => s.outcome),
      ...simulations.disaster.map(s => s.outcome),
      simulations.forget.secrets.outcome,
      simulations.forget.pin.outcome,
      simulations.forget.clouds.outcome,
      simulations.forget.everything.outcome
    ];

    if (outcomes.includes('critical')) return { label: 'วิกฤต (CRITICAL)', colorClass: 'critical-text' };
    if (outcomes.includes('warning')) return { label: 'ควรระวัง (WARNING)', colorClass: 'warning-text' };
    return { label: 'ปลอดภัยสูง (HIGH SECURITY)', colorClass: 'safe-text' };
  }, [simulations]);

  if (!isConfigValid) {
    const isMissingDescriptor = configValidation.reason === 'missing-descriptor-storage';
    return (
      <div className="analysis-summary animate-fade-in invalid-state">
         <div className="analysis-blocker-card glass-card">
            <div className="blocker-icon">⚠️</div>
            <h2>การตั้งค่าไม่สมบูรณ์</h2>
            <p className="blocker-text">
                {isMissingDescriptor 
                    ? 'คุณยังไม่ได้ระบุจุดเก็บรักษาสำหรับ Wallet Descriptor ในหัวข้อที่ 3.2 ไม่สามารถสรุปผลการจำลองความเสี่ยงได้'
                    : 'คุณยังระบุคีย์สำหรับ spending scheme ไม่ครบในหัวข้อที่ 3.1 ไม่สามารถสรุปผลการจำลองความเสี่ยงได้'
                }
            </p>
            <div className="blocker-hint">
                {isMissingDescriptor
                    ? 'กรุณาเลือกสถานที่เก็บไฟล์สำรอง Wallet Descriptor ให้ครบทุกสำเนา'
                    : 'กรุณาระบุคีย์ (Accounts) ให้ครบทุกช่องในทุกกลยุทธ์การถอนเงิน'
                }
            </div>
         </div>
      </div>
    );
  }


  const renderDetailedList = (details) => {
    // Group details by logical object
    const groups = [];
    details.forEach(item => {
      const existing = groups.find(g => g.logicalId === item.logicalId);
      if (existing) existing.instances.push(item);
      else groups.push({ ...item, instances: [item] });
    });

    return (
      <div className="res-details-drilldown animate-slide-down">
         {groups.map(group => {
           const isComplex = group.instances.length > 1;
           return (
             <div key={group.logicalId} className="detail-group">
                <div className="detail-row logical">
                   <span className="det-icon">{group.type === 'hw-wallet' ? '📟' : group.type === 'descriptor' ? '📜' : group.type === 'passphrase' ? '🧠' : '📄'}</span>
                   {(() => {
                        const inst = group.instances[0];
                        const mapping = state.objectMapping[inst.id];
                        const loc = state.locations.find(l => l.id === mapping?.locationId);
                        const cloud = state.clouds.find(c => c.id === mapping?.locationId);
                        const point = loc?.storagePoints.find(p => p.id === mapping?.storagePointId);
                        const locationLabel = mapping?.locationId === 'memory' ? 'ความจำ' : (loc?.label || cloud?.label || 'ไม่ได้ระบุ');
                        const pointLabel = point?.label || (cloud ? 'Cloud' : '--');
                        const title = `พิกัดปัจจุบัน: ${locationLabel} (${pointLabel})`;
                        
                        return (
                            <>
                                <span className="det-name" title={!isComplex ? title : undefined}>{group.name}</span>
                                {!isComplex && (
                                    <span 
                                        className={`det-status ${inst.icon === '✅' ? 'safe' : inst.icon === '⚠️' ? 'warning' : 'danger'}`} 
                                        title={title}
                                    >
                                        {inst.statusLabel}
                                    </span>
                                )}
                            </>
                        );
                   })()}
                </div>
                {isComplex && group.instances.map((inst, idx) => {
                    const mapping = state.objectMapping[inst.id];
                    const loc = state.locations.find(l => l.id === mapping?.locationId);
                    const cloud = state.clouds.find(c => c.id === mapping?.locationId);
                    const point = loc?.storagePoints.find(p => p.id === mapping?.storagePointId);
                    const locationLabel = mapping?.locationId === 'memory' ? 'ความจำ' : (loc?.label || cloud?.label || 'ไม่ได้ระบุ');
                    const pointLabel = point?.label || (cloud ? 'Cloud' : '--');
                    const title = `พิกัดปัจจุบัน: ${locationLabel} (${pointLabel})`;

                    return (
                        <div key={inst.id} className="detail-row replica">
                            <span className="tree-branch">{idx === group.instances.length - 1 ? '└─' : '├─'}</span>
                            <span className="det-name" title={title}>สำเนา #{idx + 1}</span>
                            <span 
                                className={`det-status ${inst.icon === '✅' ? 'safe' : inst.icon === '⚠️' ? 'warning' : 'danger'}`} 
                                title={title}
                            >
                                {inst.statusLabel}
                            </span>
                        </div>
                    );
                })}
             </div>
           );
         })}
      </div>
    );
  };

  return (
    <div className="analysis-summary animate-fade-in">
      <header className="summary-header">
        <div className="risk-score">
            <span className="score-label">ภาพรวมความปลอดภัย:</span>
            <span className={`score-value accent-text ${overallStatus.colorClass}`}>{overallStatus.label}</span>
        </div>
      </header>

      <section className="simulation-zone">
        <h3>A - สถานการณ์ปกติ (Normal Scenario)</h3>
        <div className="sim-cards">
            <div className={`glass-card sim-card single-full outcome-${simulations.normal.outcome}`}>
              <div className="loc-title">✅ วิเคราะห์ความพร้อมของระบบ</div>
              <div className={`outcome-badge ${simulations.normal.outcome}`}>
                 {simulations.normal.outcome === 'safe' ? '✅ ปลอดภัย' : simulations.normal.outcome === 'warning' ? '⚠️ ควรระวัง' : '🚨 อันตราย'}
              </div>
              <div className="sim-results">
                {simulations.normal.statuses.map((st, i) => {
                  const itemId = `normal-A-${i}`;
                  const isExpanded = expandedItems.has(itemId);
                  return (
                    <div 
                      key={i} 
                      className={`res-item res-expandable ${st.status === 'critical' ? 'critical' : st.status === 'warning' ? 'warning' : 'safe'} ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleExpand(itemId)}
                    >
                      <div className="res-header">
                          <strong>วอลเล็ต: {st.methodLabel}</strong>
                          <span className="status-pill">
                              {st.status === 'safe' ? '✅ ปลอดภัย' : st.status === 'warning' ? '⚠️ ควรระวัง' : '🚨 อันตราย'}
                          </span>
                      </div>
                      <p className="res-desc">
                          {st.status === 'critical' 
                              ? 'ตรวจพบความเสี่ยงขั้นสูงสุด: ข้อมูลความลับของคุณรั่วไหลบนคลาวด์ในสถานะที่บุคคลภายนอกสามารถขโมยเงินออกไปได้ทันที'
                              : st.status === 'warning'
                              ? (st.reason === 'cloud-dependency' 
                                  ? 'แม้จะเครื่องมือจะครบ แต่ระบบถูกตั้งไว้บนคลาวด์ทั้งหมด (แม้จะ Encrypted) ซึ่งถือว่ามีความเสี่ยงในระยะยาวหากระบบคลาวด์มีปัญหา'
                                  : st.reason === 'exposed-privacy'
                                  ? 'ความเป็นส่วนตัวรั่วไหล: Wallet Descriptor ถูกพบบนคลาวด์โดยไม่ได้เข้ารหัสไว้'
                                  : 'ตรวจพบความเสี่ยง: กุญแจบางส่วนถูกพบบนคลาวด์โดยไม่ได้เข้ารหัสไว้ แม้จะโอนเงินไม่ได้ทันทีแต่ถือว่าข้อมูลรั่วไหลแล้ว')
                              : 'ระบบของคุณถูกจัดเก็บไว้อย่างปลอดภัยและมิดชิด ความลับสำคัญไม่ได้อยู่นอกการควบคุมในสถานะที่เสี่ยงต่อการถูกเข้าถึง'}
                      </p>
                      {isExpanded && renderDetailedList(st.details)}
                    </div>
                  );
                })}
              </div>
            </div>
        </div>
      </section>

      <section className="simulation-zone">
        <h3>B - หากถูกโจรกรรม/บุกรุก (Compromise Simulation)</h3>
        <div className="sim-cards">
          {simulations.compromise.map((sim, idx) => (
            <div key={idx} className={`glass-card sim-card outcome-${sim.outcome}`}>
              <div className="loc-title">📍 {sim.location.label}</div>
              <div className={`outcome-badge ${sim.outcome}`}>
                 {sim.outcome === 'safe' ? '✅ ปลอดภัย' : sim.outcome === 'warning' ? '⚠️ มีความเสี่ยง' : '🚨 วิกฤต'}
              </div>
              {sim.workingMethods.length > 0 && (
                <div className="card-working-methods">
                  ยังคงเข้าถึงเงินได้ด้วยวิธี: {sim.workingMethods.join(', ')}
                </div>
              )}
              <div className="sim-results">
                {sim.statuses.map((st, i) => {
                  const itemId = `${sim.location.id}-B-${i}`;
                  const isExpanded = expandedItems.has(itemId);
                  return (
                    <div 
                      key={i} 
                      className={`res-item res-expandable ${st.isCompromised ? 'critical' : st.isAtRisk ? 'warning' : 'safe'} ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleExpand(itemId)}
                    >
                      <div className="res-header">
                          <strong>วอลเล็ต: {st.methodLabel}</strong>
                          <span className="status-pill">
                              {st.isCompromised ? '🚨 วิกฤต: เงินสูญหาย' : st.isAtRisk ? '⚠️ คำเตือน: ป้องกันโดยรหัส' : '✅ ปลอดภัย'}
                          </span>
                      </div>
                      <p className="res-desc">
                          {st.isCompromised 
                              ? (st.reason === 'thief-spend' 
                                  ? `โจรสามารถเข้าถึง ${st.stolen?.map(o => o.name).join(', ')} และโอนเงินออกได้ทันที`
                                  : `คุณสูญเสียการเข้าถึงเงิน เนื่องจากกุญแจสำคัญถูกขโมยไปและไม่มีสำเนาเหลืออยู่ที่อื่นเลย`)
                              : st.isAtRisk 
                              ? (st.reason === 'privacy-loss'
                                  ? `โจรเข้าถึง Wallet Descriptor ได้ แม้จะขโมยเงินไม่ได้ในตอนนี้ แต่ข้อมูลความเป็นส่วนตัวของคุณรั่วไหล และโจรจะสามารถติดตามยอดเงินของคุณได้`
                                  : st.reason === 'crack-risk'
                                  ? `เงินยังไม่ถูกโอนออกในตอนนี้ แต่หากโจรแกะรหัสได้ เงินจะถูกขโมยทันที`
                                  : `หากโจรแกะรหัสในจุดเก็บนี้ได้ คุณจะไม่สามารถกู้คืนเงินได้อีกต่อไป เพราะกุญแจที่เหลืออยู่ในมือโจรคือชุดสุดท้าย`)
                              : `ต่อให้โจรบุกรุกและแกะรหัสทุกอย่างในที่นี่ได้ ก็ไม่สามารถขโมยเงินของคุณไปได้ และคุณยังมีกุญแจกู้คืนสำรองไว้ในที่ปลอดภัยอื่นๆ`}
                      </p>
                      {isExpanded && renderDetailedList(st.details)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="simulation-zone">
        <h3>C - หากเกิดภัยพิบัติ (Disaster Simulation)</h3>
        <div className="sim-cards">
          {simulations.disaster.map((sim, idx) => (
            <div key={idx} className={`glass-card sim-card outcome-${sim.outcome}`}>
              <div className="loc-title">🔥 {sim.location.label}</div>
              <div className={`outcome-badge ${sim.outcome}`}>
                 {sim.outcome === 'safe' ? '✅ กู้คืนได้' : '🚨 สูญหายถาวร'}
              </div>
              {sim.workingMethods.length > 0 && (
                <div className="card-working-methods">
                  กู้คืนได้ด้วยวิธี: {sim.workingMethods.join(', ')}
                </div>
              )}
              <div className="sim-results">
                {sim.statuses.map((st, i) => {
                  const itemId = `${sim.location.id}-C-${i}`;
                  const isExpanded = expandedItems.has(itemId);
                  return (
                    <div 
                      key={i} 
                      className={`res-item res-expandable ${st.status} ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleExpand(itemId)}
                    >
                      <div className="res-header">
                          <strong>วอลเล็ต: {st.methodLabel}</strong>
                          <span className="status-pill">
                              {st.status === 'safe' ? '✅ ปลอดภัย' : st.status === 'warning' ? '⚠️ คำเตือน' : '🚨 เงินสูญหายถาวร'}
                          </span>
                      </div>
                      <p className="res-desc">
                          {st.status === 'safe' 
                              ? `หากที่นี่ถูกทำลาย คุณยังสามารถกู้คืนเงินได้จากสำเนาหรือส่วนแบ่งกุญแจที่เก็บไว้ในที่ปลอดภัยอื่นๆ`
                              : st.status === 'warning'
                              ? `Wallet Descriptor สูญหาย แต่คุณยังมีกุญแจ (Seeds) ครบถ้วนพอที่จะสร้าง Descriptor ขึ้นมาใหม่และกู้คืนกระเป๋าได้ (มีความเสี่ยงหากคุณจำโครงสร้างเดิมไม่ได้)`
                              : `คำเตือน! หากเกิดภัยพิบัติที่นี่ คุณจะไม่สามารถกู้คืนกุญแจที่จำเป็นได้อีกต่อไป ทำให้เงินสูญหายทันที`}
                      </p>
                      {isExpanded && renderDetailedList(st.details)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="simulation-zone">
        <h3>D - หากลืม (Memory Lost Simulation)</h3>
        <div className="sim-cards-vertical">
          {[
            { id: 'secrets', title: 'D.1 - หากลืมความลับ (Forget Secrets)', desc: 'ลืม Mnemonic หรือ Passphrase ทั้งหมดที่อยู่ในความจำ (ของที่จดไว้ยังคงอยู่)', data: simulations.forget.secrets },
            { id: 'pin', title: 'D.2 - หากลืม PIN (Forget PIN)', desc: 'ลืมรหัส PIN ของ Hardware Wallet ทั้งหมด (ตัวเครื่องยังอยู่แต่เข้าถึงไม่ได้)', data: simulations.forget.pin },
            { id: 'cloud', title: 'D.3 - หากลืม Cloud Password', desc: 'ลืมพาสเวิร์ดคลาวด์: คลาวด์ที่เข้ารหัสลับจะสูญเสียข้อมูล ส่วนที่ไม่เข้ารหัสลับยังกู้คืนสิทธิ์ได้', data: simulations.forget.clouds },
            { id: 'everything', title: 'D.4 - ลืมทุกอย่าง (Total Memory Loss)', desc: 'สมมติว่าเกิดเหตุการณ์ในข้อ 1, 2 และ 3 พร้อมกันทั้งหมด', data: simulations.forget.everything }
          ].map(scenario => (
            <div key={scenario.id} className={`glass-card sim-card single-full scenario-block outcome-${scenario.data.outcome}`}>
              <div className="loc-title">🧠 {scenario.title}</div>
              <div className={`outcome-badge ${scenario.data.outcome}`}>
                 {scenario.data.outcome === 'safe' ? '✅ กู้คืนได้' : '🚨 สูญหายถาวร'}
              </div>
              {scenario.data.workingMethods.length > 0 && (
                 <div className="card-working-methods">
                   กู้คืนได้ด้วยวิธี: {scenario.data.workingMethods.join(', ')}
                 </div>
              )}
              <p className="scenario-intro">{scenario.desc}</p>
              <div className="sim-results">
                {scenario.data.statuses.map((st, i) => {
                  const itemId = `memory-D-${scenario.id}-${i}`;
                  const isExpanded = expandedItems.has(itemId);
                  return (
                    <div 
                      key={i}
                      className={`res-item res-expandable ${st.status} ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleExpand(itemId)}
                    >
                      <div className="res-header">
                          <strong>วอลเล็ต: {st.methodLabel}</strong>
                          <span className="status-pill">
                              {st.status === 'safe' ? '✅ ปลอดภัย' : st.status === 'warning' ? '⚠️ คำเตือน' : '🚨 เงินสูญหาย'}
                          </span>
                      </div>
                      <p className="res-desc">
                          {st.status === 'safe' 
                              ? `คุณยังปลอดภัย เพราะมีสิ่งของทางกายภาพเพียงพอที่จะกู้คืนเงินได้แม้จะลืมข้อมูลในหัวไป`
                              : st.status === 'warning'
                              ? `กุญแจหลักยังครบ แต่ต้องใช้เวลาและความพยายามในการสร้างโครงสร้างกระเป๋าใหม่ (เช่น ลืม Descriptor)`
                              : `คำเตือน! เงินสูญหายถาวร เนื่องจากข้อมูลที่เหลืออยู่ไม่เพียงพอที่จะประกอบกุญแจคืนได้`}
                      </p>
                      {isExpanded && renderDetailedList(st.details)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AnalysisSummary;
