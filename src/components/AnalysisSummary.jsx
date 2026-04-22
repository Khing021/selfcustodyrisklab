import React, { useMemo, useState } from 'react';
import { useSimulation } from '../store/SimulationContext';
import { RiskEngine } from '../utils/RiskEngine';

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

    (state.seeds || []).forEach(seed => {
      const logicals = [];
      logicals.push({ logicalId: `obj-hw-${seed.id}`, name: `Hardware Wallet (${seed.id.replace('Seed-', 'Seed ')}_${seed.label})`, type: 'hw-wallet', seedId: seed.id });
      if (seed.type === 'single') {
        logicals.push({ logicalId: `obj-mnemonic-${seed.id}`, name: `Mnemonic Backup (${seed.id.replace('Seed-', 'Seed ')}_${seed.label})`, type: 'mnemonic', seedId: seed.id });
      } else {
        for (let i = 1; i <= (seed.shareCount || 0); i++) {
          logicals.push({ logicalId: `obj-share-${seed.id}-${i}`, name: `Share #${i} (${seed.id.replace('Seed-', 'Seed ')}_${seed.label})`, type: 'share', seedId: seed.id, threshold: seed.threshold });
        }
      }
      (seed.passphrases || []).forEach(p => {
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
    const spendingMethods = state.spendingMethods || [];
    const hasDescriptor = spendingMethods.length > 1 || 
                         (spendingMethods.length === 1 && spendingMethods[0].type === 'multi-sig');
    if (hasDescriptor) {
      const log = { logicalId: 'obj-wallet-descriptor', name: 'Wallet Descriptor', type: 'descriptor' };
      objects.push({ ...log, id: log.logicalId });
      const copyCount = state.replication['obj-wallet-descriptor'] || 0;
      for (let i = 1; i <= copyCount; i++) {
        objects.push({ ...log, id: `obj-wallet-descriptor-copy-${i}`, name: `${log.name} (Copy #${i})` });
      }
    }

    return objects;
  }, [state.seeds, state.replication, state.spendingMethods, state.clouds]);

  const configValidation = useMemo(() => {
    const spendingMethods = state.spendingMethods || [];
    const isMethodsValid = spendingMethods.every(m => (m.keySlots || []).every(slot => !!slot));
    
    let isDescriptorValid = true;
    const hasDescriptor = spendingMethods.length > 1 || 
                         (spendingMethods.length === 1 && spendingMethods[0].type === 'multi-sig');
    
    if (hasDescriptor) {
      const descriptorId = 'obj-wallet-descriptor';
      const totalInstances = ((state.replication || {})[descriptorId] || 0) + 1;
      for (let i = 0; i < totalInstances; i++) {
        const instId = i === 0 ? descriptorId : `${descriptorId}-copy-${i}`;
        if (!(state.objectMapping || {})[instId]?.storagePointId) {
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
    if (!method || !method.keySlots) return [];
    const logicalIds = new Set();
    (method.keySlots || []).forEach(accId => {
       if (!accId) return;
       const account = (state.seeds || []).flatMap(s => s.accounts || []).find(a => a.id === accId);
       const seed = (state.seeds || []).find(s => (s.accounts || []).some(a => a.id === accId));
       if (seed) {
          logicalIds.add(`obj-hw-${seed.id}`);
          if (seed.type === 'single') logicalIds.add(`obj-mnemonic-${seed.id}`);
          else {
             for (let i = 1; i <= (seed.shareCount || 0); i++) logicalIds.add(`obj-share-${seed.id}-${i}`);
          }
       }
       if (account?.passphraseId) logicalIds.add(`obj-pass-${account.passphraseId}`);
    });
    if (hasDescriptorRequirement) logicalIds.add('obj-wallet-descriptor');
    
    return (allObjects || []).filter(obj => {
       const mapping = (state.objectMapping || {})[obj.id];
       if (!mapping) return false;
       if (mapping.locationId === 'memory') return true;
       return !!mapping.storagePointId;
    }).filter(obj => logicalIds.has(obj.logicalId));
  };


  const simulations = useMemo(() => {
    try {
      const engine = new RiskEngine(state, allObjects);
      return engine.runSimulations();
    } catch(err) {
      console.error(err);
      return { 
        normal: { statuses: [], outcome: 'safe' }, 
        compromise: [], 
        disaster: [], 
        forget: { secrets: { statuses: [], workingMethods: [] }, pin: { statuses: [], workingMethods: [] }, clouds: { statuses: [], workingMethods: [] }, everything: { statuses: [], workingMethods: [] } }, 
        blackSwanCompromise: { statuses: [], outcome: 'safe' }, 
        blackSwanDisaster: { statuses: [], outcome: 'safe' }, 
        overall: 'ERROR' 
      };
    }
  }, [state, allObjects, hasDescriptorRequirement]);

  const overallStatus = useMemo(() => {
    const o = simulations.overall;
    
    if (o === 'CRITICAL') {
      return { 
        label: 'วิกฤต (CRITICAL)', 
        colorClass: 'critical-text',
        desc: 'วอลเล็ตนี้ไม่ปลอดภัยเลยแม้แต่ในสภาวะปกติ ไม่ควรใช้งานโดยเด็ดขาด'
      };
    }
    if (o === 'FAIR') {
      return { 
        label: 'พอใช้ได้ (FAIR)', 
        colorClass: 'orange-text',
        desc: 'บางสถานที่หรือความทรงจำของคุณคือจุดอ่อน หากเกิดอะไรขึ้นที่จุดนั้น คุณจะสูญเสียเงินทั้งหมดได้'
      };
    }
    if (o === 'PEACEFUL') {
      return { 
        label: 'สบายใจ (PEACEFUL)', 
        colorClass: 'warning-text',
        desc: 'ไม่มีจุดใดเลยที่เป็นจุดอ่อนที่อาจทำให้คุณสูญเสียเงิน อย่างมากอาจถูกเปิดเผย ข้อมูลเสียความเป็นส่วนตัว หรือต้องรวบรวมคีย์ทั้งหมดเพื่อสร้างระบบขึ้นมาใหม่'
      };
    }
    if (o === 'ULTRA SECURITY') {
      return { 
        label: 'ระดับสูงสุด (ULTRA SECURITY)', 
        colorClass: 'purple-text',
        desc: 'กูถามจริง? มึงทำไปทำไม? ทำเพื่ออะไร? ห่ะ!?'
      };
    }
    if (o === 'HIGH SECURITY') {
      return { 
        label: 'ปลอดภัยมาก (HIGH SECURITY)', 
        colorClass: 'blue-text',
        desc: 'บ้าไปแล้ว ต่อให้เกิดเหตุไม่คาดฝันขึ้นหลาย ๆ จุดพร้อมกันก็ทำให้คุณเสียเงินไม่ได้'
      };
    }
    return { 
      label: 'ปลอดภัย (SECURE)', 
      colorClass: 'safe-text',
      desc: 'ยอดเยี่ยม คุณไม่สูญเงินหรือเสียความเป็นส่วนตัวเลยแม้ว่าจะเกิดเหตุร้ายขึ้น ณ จุดใดก็ตาม'
    };
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
    (details || []).forEach(item => {
      const existing = groups.find(g => g.logicalId === item.logicalId);
      if (existing) existing.instances.push(item);
      else groups.push({ ...item, instances: [item] });
    });

    return (
      <div className="res-details-drilldown animate-slide-down">
         {(groups || []).map(group => {
           const isComplex = (group.instances || []).length > 1;
           return (
             <div key={group.logicalId} className="detail-group">
                <div className="detail-row logical">
                   <span className="det-icon">{group.type === 'hw-wallet' ? '📟' : group.type === 'descriptor' ? '📜' : group.type === 'passphrase' ? '🧠' : '📄'}</span>
                   {(() => {
                        const inst = group.instances[0];
                        const mapping = (state.objectMapping || {})[inst.id];
                        const loc = (state.locations || []).find(l => l.id === mapping?.locationId);
                        const cloud = (state.clouds || []).find(c => c.id === mapping?.locationId);
                        const point = loc?.storagePoints.find(p => p.id === mapping?.storagePointId);
                        let title = 'พิกัดปัจจุบัน: ไม่ได้ระบุ';
                        if (mapping?.locationId === 'memory') {
                            title = 'พิกัดปัจจุบัน: 🧠 ความจำ';
                        } else if (loc && point) {
                            title = `พิกัดปัจจุบัน: 🏠 ${loc.label} - ${point.label.replace(/\(.*\)/, '').trim()}${point.isLocked ? ' 🔒' : ''}`;
                        } else if (cloud) {
                            title = `พิกัดปัจจุบัน: ☁️ ${cloud.label}${cloud.isLocked ? ' 🔒' : ''}`;
                        }
                        
                        return (
                            <>
                                <span className="det-name" title={!isComplex ? title : undefined}>{group.name}</span>
                                {!isComplex && (
                                    <span 
                                        className={`det-status ${inst.icon === '✅' ? 'safe' : inst.icon === '⚠️' ? 'warning' : 'danger'}`} 
                                        title={title}
                                    >
                                        {RiskEngine.getStatusThai(inst.statusLabel)}
                                    </span>
                                )}
                            </>
                        );
                   })()}
                </div>
                {isComplex && (group.instances || []).map((inst, idx) => {
                    const mapping = state.objectMapping[inst.id];
                    const loc = (state.locations || []).find(l => l.id === mapping?.locationId);
                    const cloud = (state.clouds || []).find(c => c.id === mapping?.locationId);
                    const point = loc?.storagePoints.find(p => p.id === mapping?.storagePointId);
                    let title = 'พิกัดปัจจุบัน: ไม่ได้ระบุ';
                    if (mapping?.locationId === 'memory') {
                        title = 'พิกัดปัจจุบัน: 🧠 ความจำ';
                    } else if (loc && point) {
                        title = `พิกัดปัจจุบัน: 🏠 ${loc.label} - ${point.label.replace(/\(.*\)/, '').trim()}${point.isLocked ? ' 🔒' : ''}`;
                    } else if (cloud) {
                        title = `พิกัดปัจจุบัน: ☁️ ${cloud.label}${cloud.isLocked ? ' 🔒' : ''}`;
                    }

                    return (
                        <div key={inst.id} className="detail-row replica">
                            <span className="tree-branch">{idx === group.instances.length - 1 ? '└─' : '├─'}</span>
                            <span className="det-name" title={title}>{`สำเนา #${idx + 1}`}</span>
                            <span 
                                className={`det-status ${inst.icon === '✅' ? 'safe' : inst.icon === '⚠️' ? 'warning' : 'danger'}`} 
                                title={title}
                            >
                                {RiskEngine.getStatusThai(inst.statusLabel)}
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
            <p className="score-desc">{overallStatus.desc}</p>
        </div>
      </header>

      <section className="simulation-zone">
        <h3>A - สถานการณ์ปกติ (Normal Scenario)</h3>
        <div className="sim-cards">
            <div className={`glass-card sim-card single-full outcome-${simulations.normal.outcome}`}>
              <div className="loc-title">✅ วิเคราะห์ความพร้อมของระบบ</div>
              <div className={`outcome-badge ${simulations.normal.outcome}`}>
                 {simulations.normal.outcome === 'safe' ? '✅ ปลอดภัย' : simulations.normal.outcome === 'warning' ? '⚠️ อันตราย' : '🚨 วิกฤติ'}
              </div>
              <div className="sim-results">
                {(simulations.normal?.statuses || []).map((st, i) => {
                  const itemId = `normal-A-${i}`;
                  const isExpanded = expandedItems.has(itemId);
                  return (
                    <div 
                      key={i} 
                      className={`res-item res-expandable ${st.status === 'critical' ? 'critical' : st.status === 'warning' ? 'warning' : 'safe'} ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleExpand(itemId)}
                    >
                      <div className="res-header">
                          <strong>{st.methodLabel}</strong>
                          <span className="status-pill">
                              {st.status === 'safe' ? '✅ ปลอดภัย' : st.status === 'warning' ? '⚠️ อันตราย' : '🚨 วิกฤติ'}
                          </span>
                      </div>
                      <p className="res-desc">
                          {st.status === 'critical' 
                              ? 'ตรวจพบความเสี่ยงขั้นสูงสุด: ข้อมูลความลับของคุณถูกเก็บไว้อย่างครบถ้วนอยู่บนคลาวด์ในสภาพพร้อมใช้งาน ทำให้บุคคลภายนอกสามารถขโมยเงินออกไปได้ทันที'
                              : st.status === 'warning'
                              ? (st.reason === 'cloud-dependency' 
                                  ? 'แม้ข้อมูลทุกอย่างที่จำเป็นสำหรับการโอนเงินออกจะอยู่บนคลาวด์ แต่เนื่องจากอยู่ในสภาพเข้ารหัส ผู้ไม่หวังดีจึงไม่สามารถโอนเงินออกไปได้จนกว่าจะถอดรหัสได้สำเร็จ'
                                  : st.reason === 'exposed-privacy'
                                  ? 'Wallet Descriptor ถูกเก็บไว้บนคลาวด์โดยไม่ได้เข้ารหัส ทำให้อาจมีบุคคลภายนอกสามารถเฝ้าจับตาความเคลื่อนไหวของเงินเราได้ และรู้ว่าเรามีเงินอยู่เท่าไร'
                                  : st.reason === 'exposed-partial'
                                  ? 'พบความลับบางส่วนถูกเก็บไว้บนคลาวด์โดยไม่ได้เข้ารหัสลับ (Plaintext) แม้จะยังไม่เพียงพอให้โอนเงินออกได้ทันที แต่ถือว่าความปลอดภัยของระบบลดลงอย่างมาก'
                                  : st.reason === 'exposed-crack-risk'
                                  ? 'ข้อมูลกุญแจสำคัญถูกเก็บไว้บนคลาวด์ถึงแม้จะมีการเข้ารหัสไว้ แต่ถือว่ามีความเสี่ยงหากโจรสามารถเดารหัสหรือเจาะระบบคลาวด์ได้'
                                  : 'ความลับบางส่วนถูกเก็บไว้บนคลาวด์โดยไม่ได้เข้ารหัสไว้ แม้จะโอนเงินไม่ได้ทันทีแต่ถือว่าข้อมูลรั่วไหลแล้ว')
                              : 'ความลับทั้งหมดถูกเก็บไว้นอกคลาวด์ หรือแม้มีบางส่วนอยู่บนคลาวด์ก็อยู่ในสภาพเข้ารหัส'}
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
          {(simulations.compromise || []).map((sim, idx) => (
            <div key={idx} className={`glass-card sim-card outcome-${sim.outcome}`}>
              <div className="loc-title">📍 {sim.location.label}</div>
              <div className={`outcome-badge ${sim.outcome}`}>
                 {sim.outcome === 'safe' ? '✅ ปลอดภัย' : (sim.outcome === 'warning' ? '⚠️ มีความเสี่ยง' : '🚨 วิกฤต')}
              </div>
              {sim.workingMethods.length > 0 && (
                <div className="card-working-methods">
                  ยังคงเข้าถึงเงินได้ด้วยวิธี: {sim.workingMethods.join(', ')}
                </div>
              )}
              <div className="sim-results">
                {(sim?.statuses || []).map((st, i) => {
                  const itemId = `${sim.location.id}-B-${i}`;
                  const isExpanded = expandedItems.has(itemId);
                  return (
                    <div 
                      key={i} 
                      className={`res-item res-expandable ${st.isCompromised ? 'critical' : st.isAtRisk ? 'warning' : 'safe'} ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleExpand(itemId)}
                    >
                      <div className="res-header">
                          <strong>{st.methodLabel}</strong>
                          <span className="status-pill">
                              {st.isCompromised 
                                ? (st.reason === 'thief-spend' ? '🚨 เงินถูกขโมย' : '🚨 เงินสูญหาย') 
                                : st.isAtRisk ? '⚠️ มีความเสี่ยง' : '✅ ปลอดภัย'}
                          </span>
                      </div>
                      <p className="res-desc">
                          {st.isCompromised 
                              ? (st.reason === 'thief-spend' 
                                  ? `โจรสามารถเข้าถึงวัตถุพยานกุญแจและโอนเงินออกได้ทันที`
                                  : `โจรสามารถขโมยวัดถุพยานกุญแจไปได้ ถึงแม้ข้อมูลเหล่านั้นจะถูกปกป้องด้วยรหัสหรือไม่ครบถ้วนพอที่โจรจะโอนเงินออก แต่เนื่องจากคุณไม่มีสำเนาของข้อมูลดังกล่าวอยู่ที่อื่นเลย คุณจึงสูญเสียการเข้าถึงเงินอย่างถาวร`)
                              : st.isAtRisk 
                              ? (st.reason === 'privacy-loss'
                                  ? `โจรเข้าถึง Wallet Descriptor ได้ แม้จะขโมยเงินไม่ได้ในตอนนี้ แต่ข้อมูลความเป็นส่วนตัวของคุณรั่วไหล และโจรจะสามารถติดตามยอดเงินของคุณได้และรู้ว่าคุณมีเงินเท่าไร`
                                  : st.reason === 'privacy-crack-risk'
                                  ? `สื่อที่ใช้บันทึก Wallet Descriptor อยู่ในจุดที่โจรสามารถเข้าถึงได้แต่ได้รับการปกป้องไว้ด้วยรหัสหรือกุญแจล็อค หากโจรแกะรหัสหรือสะเดาะกุญแจได้ โจรจะสามารถขโมยไปได้ ทำให้คุณใช้สำเนา Descriptor ชุดนั้นไม่ได้ และเสียความเป็นส่วนตัว`
                                  : st.reason === 'crack-risk'
                                  ? `ข้อมูลที่โจรต้องใช้เพื่อโอนเงินออกถูกปกป้องไว้ด้วยรหัส PIN รหัสตู้เซฟ หรือกุญแจเซฟ แต่หากโจรแกะรหัสได้เงินจะถูกขโมยทันที`
                                  : `ข้อมูลสำคัญของคุณถูกปกป้องไว้ด้วยตู้เซฟหรือกุญแจเซฟ หากโจรแกะรหัสในจุดเก็บนี้ได้และขโมย backup ไป แม้ข้อมูลนั้นไม่เพียงพอที่โจรจะโอนเงินออก แต่คุณจะไม่สามารถกู้คืนเงินได้อีกต่อไป เพราะคุณไม่มีสำเนาของข้อมูลนั้นอยู่ที่อื่นเลย`)
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

        {simulations.blackSwanCompromise?.statuses?.length > 0 && (() => {
          const mainId = 'black-swan-B-main';
          const isMainExpanded = expandedItems.has(mainId);
          return (
            <div className={`sim-cards black-swan-zone ${isMainExpanded ? 'expanded' : ''}`}>
              <div 
                className={`glass-card sim-card single-full scenario-block outcome-${simulations.blackSwanCompromise.outcome} res-expandable`}
                onClick={() => toggleExpand(mainId)}
              >
                <div className="loc-title black-swan-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="expand-icon" style={{ fontSize: '12px' }}>{isMainExpanded ? '▼' : '▶'}</span>
                    <span>📍 Black Swan</span>
                  </div>
                </div>
                <div className={`outcome-badge ${simulations.blackSwanCompromise.outcome}`}>
                   {simulations.blackSwanCompromise.outcome === 'safe' ? '✅ ปลอดภัย' : (simulations.blackSwanCompromise.outcome === 'warning' ? '⚠️ มีความเสี่ยง' : '🚨 วิกฤต')}
                </div>
                <p className="scenario-intro">หากเกิดการโจรกรรมพร้อมกันมากกว่าหนึ่งสถานที่ โดยกลุ่มโจรที่วางแผนร่วมกัน</p>
                
                {isMainExpanded && (
                  <div className="sim-results animate-slide-down">
                    {(simulations.blackSwanCompromise?.statuses || []).map((sim, i) => {
                      const isOnlyCombo = simulations.blackSwanCompromise.statuses.length === 1;
                      const comboId = `black-swan-B-${sim.combinationId}`;
                      const isExpanded = isOnlyCombo || expandedItems.has(comboId);
                      return (
                        <div key={i} className={`res-item res-expandable ${sim.outcome} ${isExpanded ? 'expanded' : ''}`} onClick={(e) => { if(isOnlyCombo) return; e.stopPropagation(); toggleExpand(comboId); }}>
                          <div className="res-header">
                            <strong>บุกรุก: {sim.combinationLabel}</strong>
                            <span className="status-pill">{sim.outcome === 'critical' ? '🚨 วิกฤต' : (sim.outcome === 'warning' ? '⚠️ เสี่ยง' : '✅ ปลอดภัย')}</span>
                          </div>
                          <p className="res-desc">
                            {sim.outcome === 'critical' ? 'หากทั้งสองจุดถูกบุกรุก เงินจะถูกขโมยหรือสูญเสียการเข้าถึงอย่างถาวร' : (sim.outcome === 'warning' ? 'จุดที่ถูกเลือกมีข้อมูลสำคัญ แต่ยังไม่เพียงพอที่โจรจะขโมยเงินได้ทันทีหากคุณยังมีรหัสป้องกันที่ดี' : 'ปลอดภัย: ปริมาณกุญแจที่ถูกขโมยไปยังไม่เพียงพอที่จะโอนเงินออก')}
                          </p>
                          {isExpanded && (
                            <div className="black-swan-drilldown">
                              {(sim?.statuses || []).map((st, j) => {
                                const methodId = `${comboId}-method-${j}`;
                                const isMethodExpanded = expandedItems.has(methodId);
                                const isOnlyMethod = (sim?.statuses || []).length === 1;
                                const showNestedDetails = isMethodExpanded || isOnlyMethod;
                                return (
                                  <div 
                                    key={j} 
                                    className={`res-item res-expandable nested ${st.isCompromised ? 'critical' : (st.isAtRisk ? 'warning' : 'safe')} ${showNestedDetails ? 'expanded' : ''}`} 
                                    onClick={(e) => { 
                                      if (isOnlyMethod) return; // No need to toggle if only one
                                      e.stopPropagation(); 
                                      toggleExpand(methodId); 
                                    }}
                                  >
                                    <div className="res-header">
                                      <strong>{st.methodLabel}</strong>
                                      <span className="status-pill">
                                        {st.isCompromised ? '🚨 วิกฤต' : (st.isAtRisk ? '⚠️ เสี่ยง' : '✅ ปลอดภัย')}
                                      </span>
                                    </div>
                                    {showNestedDetails && renderDetailedList(st.details)}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </section>

      <section className="simulation-zone">
        <h3>C - หากเกิดภัยพิบัติ (Disaster Simulation)</h3>
        <div className="sim-cards">
          {(simulations.disaster || []).map((sim, idx) => (
            <div key={idx} className={`glass-card sim-card outcome-${sim.outcome}`}>
              <div className="loc-title">🔥 {sim.location.label}</div>
              <div className={`outcome-badge ${sim.outcome}`}>
                 {sim.outcome === 'safe' ? '✅ กู้คืนได้' : (sim.outcome === 'warning' ? '⚠️ มีความเสี่ยง' : '🚨 เงินสูญหาย')}
              </div>
              {sim.workingMethods.length > 0 && (
                <div className="card-working-methods">
                  กู้คืนได้ด้วยวิธี: {sim.workingMethods.join(', ')}
                </div>
              )}
              <div className="sim-results">
                {(sim?.statuses || []).map((st, i) => {
                  const itemId = `${sim.location.id}-C-${i}`;
                  const isExpanded = expandedItems.has(itemId);
                  return (
                    <div 
                      key={i} 
                      className={`res-item res-expandable ${st.status} ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleExpand(itemId)}
                    >
                      <div className="res-header">
                          <strong>{st.methodLabel}</strong>
                          <span className="status-pill">
                              {st.status === 'safe' ? '✅ ปลอดภัย' : st.status === 'warning' ? '⚠️ มีความเสี่ยง' : '🚨 เงินสูญหาย'}
                          </span>
                      </div>
                      <p className="res-desc">
                          {st.status === 'safe' 
                              ? `หากที่นี่ถูกทำลาย คุณยังสามารถกู้คืนเงินได้จากสำเนาหรือส่วนแบ่งกุญแจที่เก็บไว้ในที่ปลอดภัยอื่นๆ`
                              : st.status === 'warning'
                              ? `Wallet Descriptor สูญหายโดยไม่มีสำเนาสำรองอยู่ที่อื่น แต่คุณยังมีกุญแจ (Seeds) ครบถ้วนพอที่จะสร้าง Descriptor ขึ้นมาใหม่และกู้คืนกระเป๋าได้ (มีความเสี่ยงหากคุณจำโครงสร้างเดิมไม่ได้)`
                              : `คำเตือน! หากเกิดภัยพิบัติที่นี่และทุกสิ่งที่เก็บไว้ที่นี่ถูกทำลาย คุณจะไม่สามารถเข้าถึงเงินได้อีกต่อไป`}
                      </p>
                      {isExpanded && renderDetailedList(st.details)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {simulations.blackSwanDisaster?.statuses?.length > 0 && (() => {
          const mainId = 'black-swan-C-main';
          const isMainExpanded = expandedItems.has(mainId);
          return (
            <div className={`sim-cards black-swan-zone ${isMainExpanded ? 'expanded' : ''}`}>
              <div 
                className={`glass-card sim-card single-full scenario-block outcome-${simulations.blackSwanDisaster.outcome} res-expandable`}
                onClick={() => toggleExpand(mainId)}
              >
                <div className="loc-title black-swan-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="expand-icon" style={{ fontSize: '12px' }}>{isMainExpanded ? '▼' : '▶'}</span>
                    <span>🔥 Black Swan</span>
                  </div>
                </div>
                <div className={`outcome-badge ${simulations.blackSwanDisaster.outcome}`}>
                   {simulations.blackSwanDisaster.outcome === 'safe' ? '✅ กู้คืนได้' : (simulations.blackSwanDisaster.outcome === 'warning' ? '⚠️ มีความเสี่ยง' : '🚨 เงินสูญหาย')}
                </div>
                <p className="scenario-intro">หากเกิดภัยพิบัติหรือเหตุการณ์ไม่คาดฝันพร้อมกันมากกว่าหนึ่งสถานที่</p>
                
                {isMainExpanded && (
                  <div className="sim-results animate-slide-down">
                    {(simulations.blackSwanDisaster?.statuses || []).map((sim, i) => {
                      const isOnlyCombo = (simulations.blackSwanDisaster?.statuses || []).length === 1;
                      const comboId = `black-swan-C-${sim.combinationId}`;
                      const isExpanded = isOnlyCombo || expandedItems.has(comboId);
                      return (
                        <div key={i} className={`res-item res-expandable ${sim.outcome} ${isExpanded ? 'expanded' : ''}`} onClick={(e) => { if(isOnlyCombo) return; e.stopPropagation(); toggleExpand(comboId); }}>
                          <div className="res-header">
                            <strong>ภัยพิบัติ: {sim.combinationLabel}</strong>
                            <span className="status-pill">{sim.outcome === 'critical' ? '🚨 สูญหาย' : (sim.outcome === 'warning' ? '⚠️ เสี่ยง' : '✅ ปลอดภัย')}</span>
                          </div>
                          <p className="res-desc">
                            {sim.outcome === 'critical' ? 'ข้อมูลในจุดที่เลือกสูญหายหมด และข้อมูลที่เหลืออยู่ไม่เพียงพอที่จะกู้คืนเงินได้' : (sim.outcome === 'warning' ? 'คุณสูญเสีย Wallet Descriptor และกุญแจบางส่วน แต่ยังเหลือเมล็ดพันธุ์เพียงพอที่จะสร้างกระเป๋าขึ้นมาใหม่ได้' : 'เครื่องมือการกู้คืนของคุณยังกระจายตัวอยู่ในจุดอื่นๆ มากพอที่จะกู้เงินคืนได้')}
                          </p>
                          {isExpanded && (
                            <div className="black-swan-drilldown">
                              {(sim?.statuses || []).map((st, j) => {
                                const methodId = `${comboId}-method-${j}`;
                                const isMethodExpanded = expandedItems.has(methodId);
                                const isOnlyMethod = (sim?.statuses || []).length === 1;
                                const showNestedDetails = isMethodExpanded || isOnlyMethod;
                                return (
                                  <div 
                                    key={j} 
                                    className={`res-item res-expandable nested ${st.status} ${showNestedDetails ? 'expanded' : ''}`} 
                                    onClick={(e) => { 
                                      if (isOnlyMethod) return; // No need to toggle if only one
                                      e.stopPropagation(); 
                                      toggleExpand(methodId); 
                                    }}
                                  >
                                    <div className="res-header">
                                      <strong>{st.methodLabel}</strong>
                                      <span className="status-pill">
                                        {st.status === 'safe' ? '✅ ปลอดภัย' : st.status === 'warning' ? '⚠️ มีความเสี่ยง' : '🚨 เงินสูญหาย'}
                                      </span>
                                    </div>
                                    {showNestedDetails && renderDetailedList(st.details)}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
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
                 {scenario.data.outcome === 'safe' ? '✅ กู้คืนได้' : (scenario.data.outcome === 'warning' ? '⚠️ มีความเสี่ยง' : '🚨 เงินสูญหาย')}
              </div>
              {scenario.data.workingMethods.length > 0 && (
                 <div className="card-working-methods">
                   กู้คืนได้ด้วยวิธี: {scenario.data.workingMethods.join(', ')}
                 </div>
              )}
              <p className="scenario-intro">{scenario.desc}</p>
              <div className="sim-results">
                {(scenario.data?.statuses || []).map((st, i) => {
                  const itemId = `memory-D-${scenario.id}-${i}`;
                  const isExpanded = expandedItems.has(itemId);
                  return (
                    <div 
                      key={i}
                      className={`res-item res-expandable ${st.status} ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleExpand(itemId)}
                    >
                      <div className="res-header">
                          <strong>{st.methodLabel}</strong>
                          <span className="status-pill">
                              {st.status === 'safe' ? '✅ ปลอดภัย' : st.status === 'warning' ? '⚠️ มีความเสี่ยง' : '🚨 เงินสูญหาย'}
                          </span>
                      </div>
                      <p className="res-desc">
                          {st.status === 'safe' 
                              ? `คุณยังปลอดภัย เพราะมีสิ่งของทางกายภาพเพียงพอที่จะกู้คืนเงินได้แม้จะลืมข้อมูลในหัวไป (แต่ยังต้องจำสถานที่เก็บสำเนาข้อมูลเหล่านั้นได้)`
                              : st.status === 'warning'
                              ? `Wallet Descriptor สูญหายโดยไม่มีสำเนาสำรองอยู่ที่อื่น แต่คุณยังมีกุญแจ (Seeds) ครบถ้วนพอที่จะสร้าง Descriptor ขึ้นมาใหม่และกู้คืนกระเป๋าได้ (มีความเสี่ยงหากคุณจำโครงสร้างเดิมไม่ได้)`
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
