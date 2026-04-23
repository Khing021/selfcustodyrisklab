export class RiskEngine {
  constructor(state, allObjects) {
    this.state = state;
    this.allObjects = allObjects;
    this.mapping = state.objectMapping || {};
  }

  // Helper
  getContext(obj) {
    const map = this.mapping[obj.id];
    if (!map) return { isValid: false };
    const locId = map.locationId;
    const isCloud = locId?.startsWith('Cloud-');
    const isMemory = locId === 'memory';
    const cloudInfo = isCloud ? (this.state.clouds || []).find(c => c.id === locId) : null;
    const locInfo = (!isCloud && !isMemory) ? (this.state.locations || []).find(l => l.id === locId) : null;
    const pointInfo = locInfo ? (locInfo.storagePoints || []).find(p => p.id === map.storagePointId) : null;
    return { isValid: !!locId && locId !== '-- ไม่ใช้ --', locId, isCloud, isMemory, cloudInfo, locInfo, pointInfo };
  }

  evaluateObject(obj, scenario, params = {}) {
    const ctx = this.getContext(obj);
    if (!ctx.isValid) return 'Ignored';

    if (scenario === 'A_NORMAL') {
      if (ctx.isCloud && !ctx.cloudInfo?.isLocked) return 'Exposed';
      if (ctx.isCloud && ctx.cloudInfo?.isLocked) return 'Expostable';
      return 'Safe';
    }

    if (scenario === 'B_COMPROMISE') {
      const baseline = this.evaluateObject(obj, 'A_NORMAL');
      const tLocs = params.locIds || [];
      const isAtTarget = tLocs.includes(ctx.locId);
      
      if (isAtTarget) {
        const isHW = obj.type === 'hw-wallet';
        const isLocked = ctx.pointInfo?.isLocked;
        if (!isHW && !isLocked) return 'Compromised';
        if (!isHW && isLocked) return 'Compromisable';
        if (isHW && isLocked) return 'CompromisableWithPIN';
        if (isHW && !isLocked) return 'CompromisedWithPIN';
      }
      return baseline;
    }

    if (scenario === 'C_DISASTER') {
      const baseline = this.evaluateObject(obj, 'A_NORMAL');
      const tLocs = params.locIds || [];
      if (tLocs.includes(ctx.locId)) return 'Lost';
      return baseline === 'Safe' ? 'Available' : baseline;
    }

    if (scenario === 'D_FORGET') {
      const baseline = this.evaluateObject(obj, 'A_NORMAL');
      const type = params.type;
      let ld1 = ctx.isMemory && ['mnemonic', 'share', 'passphrase'].includes(obj.type);
      let ld2 = obj.type === 'hw-wallet';
      let ld3 = ctx.isCloud && ctx.cloudInfo?.isLocked;
      let rec3 = ctx.isCloud && !ctx.cloudInfo?.isLocked;

      if (type === 'secrets') return ld1 ? 'Lost' : (baseline === 'Safe' ? 'Available' : baseline);
      if (type === 'pin') return ld2 ? 'Lost' : (baseline === 'Safe' ? 'Available' : baseline);
      if (type === 'cloud') {
         if (ld3) return 'Lost';
         if (rec3) return 'Recoverable';
         return baseline === 'Safe' ? 'Available' : baseline;
      }
      if (type === 'everything') {
         if (ld1 || ld2 || ld3) return 'Lost';
         if (rec3) return 'Recoverable';
         return baseline === 'Safe' ? 'Available' : baseline;
      }
    }
    return 'Unknown';
  }

  getObjStatus(objId, scenario, params) {
    const obj = this.allObjects.find(o => o.id === objId);
    if(!obj) return 'Unknown';
    return this.evaluateObject(obj, scenario, params);
  }

  getRelevantObjects(method) {
    const relevant = [];
    if (!method || !method.keySlots) return relevant;
    for (let accId of method.keySlots) {
       if (!accId) continue;
       const account = (this.state.seeds || []).flatMap(s => s.accounts || []).find(a => a.id === accId);
       const seed = (this.state.seeds || []).find(s => (s.accounts || []).some(a => a.id === accId));
       if (!account || !seed) continue;

       this.allObjects.forEach(o => {
          if (o.type === 'passphrase' && o.passphraseId === account.passphraseId) relevant.push(o);
          if (o.type === 'hw-wallet' && o.seedId === seed.id) relevant.push(o);
          if (o.type === 'mnemonic' && o.seedId === seed.id) relevant.push(o);
          if (o.type === 'share' && o.seedId === seed.id) relevant.push(o);
       });
    }
    this.allObjects.forEach(o => {
       if (o.type === 'descriptor') relevant.push(o);
    });
    return relevant;
  }

  checkSatisfiedWithStatuses(scenario, params, method, allowedStatuses) {
    if (!method || !method.keySlots) return false;
    let satisfiedCount = 0;
    
    for (let accId of method.keySlots) {
       if (!accId) continue;
       const account = (this.state.seeds || []).flatMap(s => s.accounts || []).find(a => a.id === accId);
       const seed = (this.state.seeds || []).find(s => (s.accounts || []).some(a => a.id === accId));
       if (!account || !seed) continue;

       const validR = o => allowedStatuses.includes(this.getObjStatus(o.id, scenario, params));

       const passphrases = this.allObjects.filter(o => o.type === 'passphrase' && o.passphraseId === account.passphraseId);
       const hasPass = account.passphraseId ? passphrases.some(validR) : true;

       const hws = this.allObjects.filter(o => o.type === 'hw-wallet' && o.seedId === seed.id);
       const hasHW = hws.some(validR);

       let hasSeed = false;
       if (seed.type === 'single') {
          hasSeed = this.allObjects.filter(o => o.type === 'mnemonic' && o.seedId === seed.id).some(validR);
       } else {
          const validShares = this.allObjects.filter(o => o.type === 'share' && o.seedId === seed.id).filter(validR);
          const uniqueSharesCount = new Set(validShares.map(s => s.logicalId)).size;
          hasSeed = uniqueSharesCount >= seed.threshold;
       }

       if ((hasHW || hasSeed) && hasPass) {
          satisfiedCount++;
       }
    }
    return satisfiedCount >= method.threshold;
  }

  hasDescriptor(scenario, params, allowedStatuses) {
    return this.allObjects.filter(o => o.type === 'descriptor').some(o => allowedStatuses.includes(this.getObjStatus(o.id, scenario, params)));
  }

  evaluateMethod(method, scenario, params, hasDescReq) {
    const isDescAvail = !hasDescReq || this.hasDescriptor(scenario, params, ['Safe', 'Available', 'Exposed']);
    const isDescRecov = !hasDescReq || this.hasDescriptor(scenario, params, ['Safe', 'Available', 'Recoverable', 'Compromisable', 'CompromisableWithPIN', 'Expostable', 'Exposed']);
    
    // For spending, if desc is NOT required, the thief effectively "has" everything they need on the desc front.
    const thiefHasExpDesc = !hasDescReq || this.hasDescriptor(scenario, params, ['Exposed']);
    const thiefHasExpExpostDesc = !hasDescReq || this.hasDescriptor(scenario, params, ['Exposed', 'Expostable']);
    
    // For privacy, if desc is NOT required (doesn't exist), it cannot leak privacy.
    const descPrivacyLeaked = hasDescReq && this.hasDescriptor(scenario, params, ['Exposed']);
    // For privacy in Scenario B, we only care about what the thief gets DURING the burglary.
    // However, if it's already leaked on the cloud (Scenario A), we factor that in.
    const userHasExpDescForPrivacyB = hasDescReq && this.hasDescriptor('A_NORMAL', {}, ['Exposed']); 
    const userHasExpExpostDescForPrivacyB = hasDescReq && this.hasDescriptor('A_NORMAL', {}, ['Exposed', 'Expostable']);

    if (scenario === 'A_NORMAL') {
      const expSpend = this.checkSatisfiedWithStatuses(scenario, params, method, ['Exposed']);
      const expExpostSpend = this.checkSatisfiedWithStatuses(scenario, params, method, ['Exposed', 'Expostable']);
      const hasSafe = this.checkSatisfiedWithStatuses(scenario, params, method, ['Safe']);
      const privacyLeaked = descPrivacyLeaked || this.checkSatisfiedWithStatuses(scenario, params, method, ['Exposed']);
      
      const relevantObjects = this.getRelevantObjects(method);
      const anySecretExposed = relevantObjects.some(o => 
        ['mnemonic', 'share', 'passphrase'].includes(o.type) && 
        this.getObjStatus(o.id, scenario, params) === 'Exposed'
      );

      let reason = 'safe';
      if (expSpend && thiefHasExpDesc) reason = 'exposed-spend';
      else if (anySecretExposed) reason = 'exposed-partial';
      else if (expExpostSpend && thiefHasExpExpostDesc) reason = 'exposed-crack-risk';
      else if (privacyLeaked) reason = 'exposed-privacy';
      else if (!hasSafe) reason = 'cloud-dependency';

      let status = 'safe';
      if (reason === 'exposed-spend') status = 'critical';
      else if (reason !== 'safe') status = 'warning';

      return { status, reason };
    }

    if (scenario === 'B_COMPROMISE') {
      const m1_available = this.checkSatisfiedWithStatuses(scenario, params, method, ['Safe', 'Exposed', 'Expostable']) && isDescAvail;
      
      const hasAnyRecov = this.checkSatisfiedWithStatuses(scenario, params, method, ['Safe', 'Exposed', 'Expostable', 'Compromisable', 'CompromisableWithPIN', 'CompromisedWithPIN', 'Recoverable']);
      const m1_lost_entirely = !hasAnyRecov || !isDescRecov;
      
      const isDescLostable = !hasDescReq || this.hasDescriptor(scenario, params, ['Safe', 'Exposed', 'Expostable', 'Compromisable', 'CompromisableWithPIN', 'Lostable', 'Expostable']);
      const m1_lostable = !m1_available && !m1_lost_entirely && this.checkSatisfiedWithStatuses(scenario, params, method, ['Safe', 'Exposed', 'Expostable', 'Compromisable', 'CompromisableWithPIN', 'Lostable']) && isDescLostable;
      
      const dim1 = m1_available ? 'Available' : (m1_lost_entirely ? 'Lost' : 'Lostable');

      const m2_exposted = this.checkSatisfiedWithStatuses(scenario, params, method, ['Exposed', 'Compromised']) && thiefHasExpDesc;
      const m2_expExpost = this.checkSatisfiedWithStatuses(scenario, params, method, ['Exposed', 'Compromised', 'CompromisedWithPIN', 'Expostable', 'Compromisable', 'CompromisableWithPIN']) && thiefHasExpExpostDesc;
      const dim2 = m2_exposted ? 'FundExposed' : (m2_expExpost ? 'FundExpostable' : 'Secure');

      let isCompromised = false;
      let isAtRisk = false;
      let reason = 'safe';

      if (dim2 === 'FundExposed') { isCompromised = true; reason = 'thief-spend'; }
      else if (dim1 === 'Lost') { isCompromised = true; reason = 'user-loss'; }
      else if (dim2 === 'FundExpostable') { isAtRisk = true; reason = 'crack-risk'; }
      else if (dim1 === 'Lostable') { isAtRisk = true; reason = 'lock-survival'; }
      else if (userHasExpDescForPrivacyB || (hasDescReq && this.hasDescriptor(scenario, params, ['Compromised', 'CompromisedWithPIN']))) { isAtRisk = true; reason = 'privacy-loss'; }
      else if (hasDescReq && this.hasDescriptor(scenario, params, ['Compromisable', 'CompromisableWithPIN'])) { isAtRisk = true; reason = 'privacy-crack-risk'; }

      return { isCompromised, isAtRisk, reason, canSpend: dim1 === 'Available' };
    }

    if (scenario === 'C_DISASTER') {
      const keysAvailable = this.checkSatisfiedWithStatuses(scenario, params, method, ['Available']);
      if (keysAvailable && isDescAvail) return { status: 'safe' };
      if (keysAvailable && !isDescAvail) return { status: 'warning' };
      return { status: 'critical' };
    }

    if (scenario === 'D_FORGET') {
      const keysAvailable = this.checkSatisfiedWithStatuses(scenario, params, method, ['Available']);
      const keysRecoverable = this.checkSatisfiedWithStatuses(scenario, params, method, ['Available', 'Recoverable']);
      
      if (keysAvailable && isDescAvail) return { status: 'safe' };
      if (keysAvailable && !isDescAvail) return { status: 'warning' };
      if (keysRecoverable) return { status: 'warning' };
      return { status: 'critical' };
    }
  }

  getUIStatusClass(objStatus) {
    if (['Safe', 'Available'].includes(objStatus)) return { icon: '✅', type: 'safe' };
    if (['Expostable', 'Compromisable', 'CompromisableWithPIN', 'Recoverable'].includes(objStatus)) return { icon: '⚠️', type: 'warning' };
    if (['Exposed', 'Compromised', 'CompromisedWithPIN', 'Lost'].includes(objStatus)) return { icon: '🚨', type: 'danger' };
    return { icon: '❓', type: 'danger' };
  }

  static getStatusThai(status) {
    const mapping = {
      'Safe': 'ปลอดภัย',
      'Available': 'เข้าถึงได้',
      'Expostable': 'อาจจะรั่วไหล',
      'Compromisable': 'อาจจะถูกขโมย',
      'CompromisableWithPIN': 'อาจจะถูกขโมย (มีรหัส PIN)',
      'Recoverable': 'สามารถกู้คืนได้',
      'Exposed': 'รั่วไหล',
      'Compromised': 'ถูกขโมย',
      'CompromisedWithPIN': 'ถูกขโมย (มีรหัส PIN)',
      'Lost': 'สูญหาย',
      'Ignored': 'ไม่นำมาคำนวณ',
      'Unknown': 'ไม่ทราบสถานะ'
    };
    return mapping[status] || status;
  }

  // L5: Scenario Aggregation
  aggregateScenario(scenario, params) {
    const methods = this.state.spendingMethods || [];
    const hasDescReq = methods.length > 1 || (methods.length === 1 && methods[0].type === 'multi-sig');
    
    const results = methods.map(m => {
       const evalResult = this.evaluateMethod(m, scenario, params, hasDescReq);
       
       // Build details for drilldown
       const relevantObjects = this.getRelevantObjects(m);
       const details = relevantObjects.map(o => {
         const st = this.evaluateObject(o, scenario, params);
         const ui = this.getUIStatusClass(st);
         return {
           id: o.id,
           name: o.name || o.label || o.id,
           logicalId: o.logicalId || o.id,
           type: o.type,
           icon: ui.icon,
           statusLabel: st
         };
       }).filter(d => d.statusLabel !== 'Ignored');

       return { method: m, methodLabel: m.label, ...evalResult, details };
    });

    let outcome = 'safe';
    let workingMethods = [];

    if (scenario === 'A_NORMAL') {
      if (results.some(r => r.status === 'critical')) outcome = 'critical';
      else if (results.some(r => r.status === 'warning')) outcome = 'warning';
    } else if (scenario === 'B_COMPROMISE') {
      if (results.some(r => r.isCompromised)) outcome = 'critical';
      else if (results.some(r => r.isAtRisk)) outcome = 'warning';
      workingMethods = results.filter(r => r.canSpend).map(r => r.methodLabel);
    } else {
      // C and D
      if (results.every(r => r.status === 'critical')) outcome = 'critical';
      else if (results.some(r => r.status === 'warning')) outcome = 'warning';
      workingMethods = results.filter(r => r.status === 'safe' || r.status === 'warning').map(r => r.methodLabel);
    }

    return { statuses: results, outcome, workingMethods };
  }

  // Build full report
  runSimulations() {
    const res = { normal: {}, compromise: [], disaster: [], forget: {}, blackSwanCompromise: {}, blackSwanDisaster: {} };

    res.normal = this.aggregateScenario('A_NORMAL', {});
    
    for (let loc of this.state.locations || []) {
      res.compromise.push({ location: loc, ...this.aggregateScenario('B_COMPROMISE', { locIds: [loc.id] }) });
      res.disaster.push({ location: loc, ...this.aggregateScenario('C_DISASTER', { locIds: [loc.id] }) });
    }

    res.forget.secrets = this.aggregateScenario('D_FORGET', { type: 'secrets' });
    res.forget.pin = this.aggregateScenario('D_FORGET', { type: 'pin' });
    res.forget.clouds = this.aggregateScenario('D_FORGET', { type: 'cloud' });
    res.forget.everything = this.aggregateScenario('D_FORGET', { type: 'everything' });

    // Black Swan
    const locs = this.state.locations || [];
    const bsCombinations = this.getAllCombinations(locs, 2).sort((a, b) => a.length - b.length);

    const bsCompStates = [];
    const bsDisStates = [];

    for (let combo of bsCombinations) {
       const lbl = combo.map(l => l.label).join(' & ');
       const cid = combo.map(l => l.id).join('_');
       bsCompStates.push({ combinationId: cid, combinationLabel: lbl, ...this.aggregateScenario('B_COMPROMISE', { locIds: combo.map(l => l.id) }) });
       bsDisStates.push({ combinationId: cid, combinationLabel: lbl, ...this.aggregateScenario('C_DISASTER', { locIds: combo.map(l => l.id) }) });
    }

    res.blackSwanCompromise = {
      statuses: bsCompStates,
      outcome: bsCompStates.some(r => r.outcome === 'critical') ? 'critical' : (bsCompStates.some(r => r.outcome === 'warning') ? 'warning' : 'safe')
    };

    res.blackSwanDisaster = {
      statuses: bsDisStates,
      outcome: bsDisStates.some(r => r.outcome === 'critical') ? 'critical' : (bsDisStates.some(r => r.outcome === 'warning') ? 'warning' : 'safe')
    };

    res.overall = this.calculateOverallStatus(res);

    return res;
  }

  calculateOverallStatus(res) {
    // 1. CRITICAL: Unsafe in normal situation
    if (res.normal.outcome === 'critical') return 'CRITICAL';

    const allSingleOutcome = [
      ...res.compromise.map(r => r.outcome),
      ...res.disaster.map(r => r.outcome),
      res.forget.secrets.outcome,
      res.forget.pin.outcome,
      res.forget.clouds.outcome,
      res.forget.everything.outcome
    ];

    // 2. FAIR: Single Point of Failure (Any single location/memory loss is critical)
    if (allSingleOutcome.some(o => o === 'critical')) return 'FAIR';

    // 3. PEACEFUL: No total loss on single point, but has some risks (warning)
    if (allSingleOutcome.some(o => o === 'warning')) return 'PEACEFUL';

    const allBSOutcome = [
      res.blackSwanCompromise.outcome,
      res.blackSwanDisaster.outcome
    ];

    // 4. SECURE: Single points are safe, but Black Swan is critical
    if (allBSOutcome.some(o => o === 'critical')) return 'SECURE';

    // 5. HIGH SECURITY: Single points safe, Black Swan is warning
    if (allBSOutcome.some(o => o === 'warning')) return 'HIGH SECURITY';

    // 6. ULTRA SECURITY: Everything is safe
    return 'ULTRA SECURITY';
  }

  // Helper to get all combinations of size >= minSize
  getAllCombinations(array, minSize = 1) {
    const result = [];
    const f = (prefix, chars) => {
      for (let i = 0; i < chars.length; i++) {
        const next = prefix.concat([chars[i]]);
        if (next.length >= minSize) result.push(next);
        f(next, chars.slice(i + 1));
      }
    };
    f([], array);
    return result;
  }
}
