import React, { useMemo } from 'react';
import { useSimulation } from '../store/SimulationContext';

function AnalysisSummary() {
  const { state } = useSimulation();

  // Helper to get all objects and their current location
  const allObjects = useMemo(() => {
    const objects = [];

    state.seeds.forEach(seed => {
      // Create logical objects including replicas for each type
      const logicals = [];

      // HW Wallets (Unified per Seed)
      logicals.push({ logicalId: `obj-hw-${seed.id}`, name: `Hardware Wallet (${seed.label})`, type: 'hw-wallet', seedId: seed.id });

      // Mnemonic/Shares
      if (seed.type === 'single') {
        logicals.push({ logicalId: `obj-mnemonic-${seed.id}`, name: `Mnemonic (${seed.label})`, type: 'mnemonic', seedId: seed.id });
      } else {
        for (let i = 1; i <= seed.shareCount; i++) {
          logicals.push({ logicalId: `obj-share-${seed.id}-${i}`, name: `Share #${i} (${seed.label})`, type: 'share', seedId: seed.id, threshold: seed.threshold });
        }
      }

      // Passphrases
      seed.passphrases.forEach(p => {
        logicals.push({ logicalId: `obj-pass-${p.id}`, name: `Passphrase (${p.label})`, type: 'passphrase', passphraseId: p.id, seedId: seed.id });
      });

      // Populate physical instances (Primary + Replicas)
      logicals.forEach(log => {
        // Primary
        objects.push({ ...log, id: log.logicalId });
        // Copies
        const copyCount = state.replication[log.logicalId] || 0;
        for (let i = 1; i <= copyCount; i++) {
          objects.push({ 
            ...log, 
            id: `${log.logicalId}-copy-${i}`, 
            name: `${log.name} (Copy #${i})` 
          });
        }
      });
    });

    return objects;
  }, [state.seeds, state.replication]);

  const isConfigValid = useMemo(() => {
     return state.spendingMethods.every(m => m.keySlots.every(slot => !!slot));
  }, [state.spendingMethods]);

  const simulations = useMemo(() => {
    const results = { compromise: [], disaster: [], forget: [] };

    // Centralized Helper to check if a set of objects satisfies a method
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
      // --- COMPROMISE SIMULATION (Refined 3-Tier Logic) ---
      const compromisedMethodStatuses = state.spendingMethods.map(method => {
        const checkSatisfied = getSatisfactionChecker(method);
        
        // 1. Set of objects stolen immediately (Unlocked points)
        const stolenObjects = [];
        // 2. Set of objects compromisable with cracking (Locked points + HW wallets)
        const compromisableObjects = [];
        // 3. Set of objects stored elsewhere (Safe for now)
        const externalObjects = allObjects.filter(obj => {
            const mapping = state.objectMapping[obj.id];
            return !mapping || mapping.locationId !== location.id;
        });
        
        allObjects.forEach(obj => {
          const mapping = state.objectMapping[obj.id];
          if (mapping && mapping.locationId === location.id) {
            const point = location.storagePoints.find(p => p.id === mapping.storagePointId);
            const isHw = obj.type === 'hw-wallet';
            
            if (point && (point.isLocked || isHw)) {
              compromisableObjects.push(obj);
            } else if (point) {
              stolenObjects.push(obj);
            }
          }
        });

        // STATUS LOGIC:
        // RED (Critical): Thief can spend NOW OR User loses access FOREVER
        const thiefCanSpendNow = checkSatisfied(stolenObjects);
        const userCannotRecoverBase = !checkSatisfied(externalObjects);
        const isCompromised = thiefCanSpendNow || (stolenObjects.length > 0 && userCannotRecoverBase);

        // YELLOW (Warning): Thief could spend IF crack OR User needs Locked items to survive
        const thiefCouldSpendIfCrack = !isCompromised && checkSatisfied([...stolenObjects, ...compromisableObjects]);
        const userNeedsLockedToSurvive = !isCompromised && userCannotRecoverBase && checkSatisfied([...externalObjects, ...compromisableObjects]);
        const isAtRisk = thiefCouldSpendIfCrack || userNeedsLockedToSurvive;

        let reason = 'none';
        if (thiefCanSpendNow) reason = 'thief-spend';
        else if (isCompromised && userCannotRecoverBase) reason = 'user-loss';
        else if (thiefCouldSpendIfCrack) reason = 'crack-risk';
        else if (userNeedsLockedToSurvive) reason = 'lock-survival';

        return { 
          methodLabel: method.label, 
          isCompromised, 
          isAtRisk, 
          stolen: stolenObjects, 
          risk: compromisableObjects,
          reason
        };
      });

      results.compromise.push({ location, statuses: compromisedMethodStatuses });

      // --- DISASTER SIMULATION ---
      const disasterMethodStatuses = state.spendingMethods.map(method => {
        const checkSatisfied = getSatisfactionChecker(method);
        const remainingObjects = allObjects.filter(obj => {
          const mapping = state.objectMapping[obj.id];
          return !mapping || mapping.locationId !== location.id;
        });

        const canRecover = checkSatisfied(remainingObjects);
        return { methodLabel: method.label, canRecover };
      });

      results.disaster.push({ location, statuses: disasterMethodStatuses });
    });

    // --- FORGET / MEMORY LOST SIMULATION ---
    results.forget = state.spendingMethods.map(method => {
        const checkSatisfied = getSatisfactionChecker(method);
        const rememberedObjects = allObjects.filter(obj => {
          const mapping = state.objectMapping[obj.id];
          return mapping && mapping.locationId !== 'memory';
        });

        const canRecover = checkSatisfied(rememberedObjects);
        return { methodLabel: method.label, canRecover };
    });

    return results;
  }, [state, allObjects]);

  if (!isConfigValid) {
    return (
      <div className="analysis-summary animate-fade-in invalid-state">
         <div className="analysis-blocker-card glass-card">
            <div className="blocker-icon">⚠️</div>
            <h2>การตั้งค่าไม่สมบูรณ์</h2>
            <p className="blocker-text">คุณยังระบุคีย์สำหรับ spending scheme ไม่ครบในหัวข้อที่ 3.1 ไม่สามารถสรุปผลการจำลองความเสี่ยงได้</p>
            <div className="blocker-hint">กรุณาระบุคีย์ (Accounts) ให้ครบทุกช่องในทุกกลยุทธ์การถอนเงิน</div>
         </div>
      </div>
    );
  }

  return (
    <div className="analysis-summary animate-fade-in">
      <header className="summary-header">
        <div className="risk-score">
            <span className="score-label">ภาพรวมความปลอดภัย:</span>
            <span className="score-value accent-text">High Security</span>
        </div>
      </header>

      <section className="simulation-zone">
        <h3>A - หากถูกโจรกรรม/บุกรุก (Compromise Simulation)</h3>
        <div className="sim-cards">
          {simulations.compromise.map((sim, idx) => (
            <div key={idx} className="glass-card sim-card">
              <div className="loc-title">📍 {sim.location.label}</div>
              <div className="sim-results">
                {sim.statuses.map((st, i) => (
                  <div key={i} className={`res-item ${st.isCompromised ? 'critical' : st.isAtRisk ? 'warning' : 'safe'}`}>
                    <div className="res-header">
                        <strong>วอลเล็ต: {st.methodLabel}</strong>
                        <span className="status-pill">
                            {st.isCompromised ? '🚨 วิกฤต: เงินสูญหาย' : st.isAtRisk ? '⚠️ คำเตือน: ป้องกันโดยรหัส' : '✅ ปลอดภัย'}
                        </span>
                    </div>
                    <p className="res-desc">
                        {st.isCompromised 
                            ? (st.reason === 'thief-spend' 
                                ? `โจรสามารถเข้าถึง ${st.stolen.map(o => o.name).join(', ')} และโอนเงินออกได้ทันที`
                                : `คุณสูญเสียการเข้าถึงเงิน เนื่องจากกุญแจสำคัญถูกขโมยไปและไม่มีสำเนาเหลืออยู่ที่อื่นเลย`)
                            : st.isAtRisk 
                            ? (st.reason === 'crack-risk'
                                ? `เงินยังไม่ถูกโอนออกในตอนนี้ แต่หากโจรแกะรหัส ${st.risk.map(o => o.name).join(', ')} ได้ เงินจะถูกขโมยทันที`
                                : `หากโจรแกะรหัสในจุดเก็บนี้ได้ คุณจะไม่สามารถกู้คืนเงินได้อีกต่อไป เพราะกุญแจที่เหลืออยู่ในมือโจรคือชุดสุดท้าย`)
                            : `ต่อให้โจรบุกรุกและแกะรหัสทุกอย่างในที่นี่ได้ ก็ไม่สามารถขโมยเงินของคุณไปได้ และคุณยังมีกุญแจกู้คืนสำรองไว้ในที่ปลอดภัยอื่นๆ`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>


      <section className="simulation-zone">
        <h3>B - หากเกิดภัยพิบัติ (Disaster Simulation)</h3>
        <div className="sim-cards">
          {simulations.disaster.map((sim, idx) => (
            <div key={idx} className="glass-card sim-card">
              <div className="loc-title">🔥 {sim.location.label}</div>
              <div className="sim-results">
                {sim.statuses.map((st, i) => (
                  <div key={i} className={`res-item ${st.canRecover ? 'safe' : 'critical'}`}>
                    <div className="res-header">
                        <strong>วอลเล็ต: {st.methodLabel}</strong>
                        <span className="status-pill">{st.canRecover ? '✅ สามารถกู้คืนได้' : '🚨 เงินสูญหายถาวร'}</span>
                    </div>
                    <p className="res-desc">
                        {st.canRecover 
                            ? `หากที่นี่ถูกทำลาย คุณยังสามารถกู้คืนเงินได้จากสำเนาหรือส่วนแบ่งกุญแจที่เก็บไว้ในที่ปลอดภัยอื่นๆ`
                            : `คำเตือน! หากเกิดภัยพิบัติที่นี่ คุณจะไม่สามารถกู้คืนกุญแจที่จำเป็นได้อีกต่อไป ทำให้เงินสูญหายทันที`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="simulation-zone">
        <h3>C - หากลืม (Memory Lost Simulation)</h3>
        <div className="sim-cards">
            <div className="glass-card sim-card single-full">
              <div className="loc-title">🧠 สิ่งที่จำไว้ในหัว</div>
              <div className="sim-results">
                {simulations.forget.map((st, i) => (
                  <div key={i} className={`res-item ${st.canRecover ? 'safe' : 'critical'}`}>
                    <div className="res-header">
                        <strong>วอลเล็ต: {st.methodLabel}</strong>
                        <span className="status-pill">{st.canRecover ? '✅ สามารถกู้คืนได้' : '🚨 เงินสูญหายถาวร'}</span>
                    </div>
                    <p className="res-desc">
                        {st.canRecover 
                            ? `หากคุณลืมข้อมูลทั้งหมดที่อยู่ในความจำ คุณยังสามารถกู้คืนเงินได้จากสำเนาทางกายภาพที่เก็บไว้ตามสถานที่ต่างๆ`
                            : `คำเตือน! หากคุณลืมข้อมูลในความจำ คุณจะไม่สามารถกู้คืนกุญแจที่จำเป็นได้อีกต่อไป เพราะไม่มีการจดบันทึกลงบนวัตถุทางกายภาพชุดอื่นไว้เลย`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
        </div>
      </section>
    </div>
  );
}

export default AnalysisSummary;
