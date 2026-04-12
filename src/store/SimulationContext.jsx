import React, { createContext, useContext, useReducer, useEffect } from 'react';

const SimulationContext = createContext();

const initialState = {
  locations: [
    {
      id: 'L-A',
      label: 'บ้าน',
      storagePoints: [
        { id: 'S-A1', label: 'ห้องนอน (A1)', isLocked: false }
      ]
    }
  ],
  clouds: [],
  seeds: [
    {
      id: 'Seed-A',
      label: 'Seed A',
      type: 'single', // single or multi
      threshold: 1,
      shareCount: 1,
      passphrases: [],
      accounts: [
        { id: 'Acc-A1', label: 'Standard - Single Sig #1', type: 'single-sig', passphraseId: null }
      ]
    }
  ],
  spendingMethods: [
    {
      id: 'Method-1',
      label: 'Daily Spending',
      type: 'single-sig',
      threshold: 1,
      keySlots: [null]
    }
  ],
  objectMapping: {}, // key: objectInstanceId, value: { locationId, storagePointId }
  replication: {},    // key: logicalObjectId, value: count of EXTRA copies
  nextIds: {
    location: 1,
    cloud: 0,
    seed: 1,
    method: 2
  }
};

const ensureStateSafety = (state) => {
  if (!state) return initialState;
  return {
    ...initialState,
    ...state,
    nextIds: {
      ...initialState.nextIds,
      ...(state.nextIds || {})
    },
    // Ensure all critical top-level arrays/objects exist
    clouds: state.clouds || [],
    locations: state.locations || initialState.locations,
    seeds: state.seeds || initialState.seeds,
    spendingMethods: state.spendingMethods || initialState.spendingMethods,
    objectMapping: state.objectMapping || {},
    replication: state.replication || {}
  };
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_STATE':
      return ensureStateSafety(action.payload);

    case 'ADD_LOCATION': {
      const char = String.fromCharCode(65 + state.nextIds.location); // A=65
      const newLoc = {
        id: `L-${char}`,
        label: `สถานที่ ${char}`,
        storagePoints: [{ id: `S-${char}1`, label: `${char}1`, isLocked: false }]
      };
      return {
        ...state,
        locations: [...state.locations, newLoc],
        nextIds: { ...state.nextIds, location: state.nextIds.location + 1 }
      };
    }

    case 'DELETE_LOCATION':
      return {
        ...state,
        locations: state.locations.filter(l => l.id !== action.id)
      };

    case 'UPDATE_LOCATION_LABEL':
        return {
          ...state,
          locations: state.locations.map(l => l.id === action.id ? { ...l, label: action.label } : l)
        };

    case 'ADD_CLOUD': {
      const char = String.fromCharCode(65 + state.nextIds.cloud);
      const newCloud = {
        id: `Cloud-${char}`,
        label: `Cloud ${char}`,
        isLocked: false // Defaults to Unencrypted
      };
      return {
        ...state,
        clouds: [...state.clouds, newCloud],
        nextIds: { ...state.nextIds, cloud: state.nextIds.cloud + 1 }
      };
    }

    case 'DELETE_CLOUD':
      return {
        ...state,
        clouds: state.clouds.filter(c => c.id !== action.id),
        objectMapping: Object.fromEntries(
            Object.entries(state.objectMapping).filter(([objId, mapping]) => mapping.locationId !== action.id)
        )
      };

    case 'UPDATE_CLOUD_LABEL':
        return {
          ...state,
          clouds: state.clouds.map(c => c.id === action.id ? { ...c, label: action.label } : c)
        };

    case 'TOGGLE_CLOUD_LOCK':
      return {
        ...state,
        clouds: state.clouds.map(c => c.id === action.id ? { ...c, isLocked: !c.isLocked } : c)
      };

    case 'ADD_STORAGE_POINT': {
      const loc = state.locations.find(l => l.id === action.locationId);
      const locChar = loc.id.split('-')[1];
      const nextNum = loc.storagePoints.length + 1;
      const newPoint = { id: `S-${locChar}${nextNum}`, label: `${locChar}${nextNum}`, isLocked: false };
      return {
        ...state,
        locations: state.locations.map(l => l.id === action.locationId ? 
          { ...l, storagePoints: [...l.storagePoints, newPoint] } : l)
      };
    }

    case 'DELETE_STORAGE_POINT':
        return {
          ...state,
          locations: state.locations.map(l => l.id === action.locationId ? 
            { ...l, storagePoints: l.storagePoints.filter(p => p.id !== action.pointId) } : l)
        };

    case 'TOGGLE_STORAGE_LOCK':
      return {
        ...state,
        locations: state.locations.map(l => ({
          ...l,
          storagePoints: l.storagePoints.map(p => p.id === action.pointId ? { ...p, isLocked: !p.isLocked } : p)
        }))
      };

    // Seeds & Accounts
    case 'ADD_SEED': {
        const char = String.fromCharCode(65 + state.nextIds.seed);
        const newSeed = {
            id: `Seed-${char}`,
            label: `Seed ${char}`,
            type: 'single',
            threshold: 1,
            shareCount: 1,
            passphrases: [],
            accounts: [
                { id: `Acc-${char}1`, label: `${char}: Standard - Single Sig #1`, type: 'single-sig', passphraseId: null }
            ]
        };
        return {
            ...state,
            seeds: [...state.seeds, newSeed],
            nextIds: { ...state.nextIds, seed: state.nextIds.seed + 1 }
        };
    }

    case 'UPDATE_SEED_TYPE':
        return {
            ...state,
            seeds: state.seeds.map(s => {
                if (s.id === action.id) {
                    const shareCount = action.shareCount ?? s.shareCount;
                    const threshold = Math.min(Math.max(action.threshold ?? s.threshold, 1), shareCount);
                    return { ...s, type: action.seedType || s.type, threshold, shareCount };
                }
                return s;
            })
        };

    case 'UPDATE_SEED_LABEL':
        return {
            ...state,
            seeds: state.seeds.map(s => s.id === action.id ? { ...s, label: action.label } : s)
        };

    case 'DELETE_SEED': {
        const seedToDelete = state.seeds.find(s => s.id === action.id);
        const accountIdsToDelete = seedToDelete ? seedToDelete.accounts.map(a => a.id) : [];
        
        return {
            ...state,
            seeds: state.seeds.filter(s => s.id !== action.id),
            spendingMethods: state.spendingMethods.map(m => ({
                ...m,
                keySlots: m.keySlots.filter(accId => !accountIdsToDelete.includes(accId))
            })),
            objectMapping: Object.fromEntries(
                Object.entries(state.objectMapping).filter(([objId]) => {
                    const isMnemonic = objId.startsWith('obj-mnemonic-') && objId.endsWith(action.id);
                    const isShare = objId.startsWith('obj-share-') && objId.includes(action.id);
                    const isAcc = objId.startsWith('obj-hw-') && accountIdsToDelete.some(aid => objId.endsWith(aid));
                    const isPass = objId.startsWith('obj-pass-') && seedToDelete?.passphrases.some(p => objId.endsWith(p.id));
                    return !isMnemonic && !isShare && !isAcc && !isPass;
                })
            )
        };
    }

    case 'ADD_PASSPHRASE': {
        const seedId = action.seedId;
        const newPassId = `P-${Date.now()}`;
        const newPass = { id: newPassId, label: `Passphrase` };
        const newAcc = { 
            id: `Acc-${Date.now()}-P`, 
            label: `New Account`, 
            type: 'single-sig',
            passphraseId: newPassId
        };
        return {
            ...state,
            seeds: state.seeds.map(s => s.id === seedId ? 
                { ...s, passphrases: [...s.passphrases, newPass], accounts: [...s.accounts, newAcc] } : s)
        };
    }

    case 'UPDATE_PASSPHRASE_LABEL':
        return {
            ...state,
            seeds: state.seeds.map(s => ({
                ...s,
                passphrases: s.passphrases.map(p => p.id === action.id ? { ...p, label: action.label } : p)
            }))
        };

    case 'DELETE_PASSPHRASE':
        return {
            ...state,
            seeds: state.seeds.map(s => ({
                ...s,
                passphrases: s.passphrases.filter(p => p.id !== action.id),
                accounts: s.accounts.filter(a => a.passphraseId !== action.id)
            }))
        };

    case 'ADD_ACCOUNT': {
        const seed = state.seeds.find(s => s.id === action.seedId);
        const seedChar = seed.id.split('-')[1];
        const newAcc = { 
            id: `Acc-${Date.now()}-${Math.random()}`, 
            label: `New Account`, 
            type: 'single-sig',
            passphraseId: action.passphraseId || null
        };
        return {
            ...state,
            seeds: state.seeds.map(s => s.id === action.seedId ? { ...s, accounts: [...s.accounts, newAcc] } : s)
        };
    }

    case 'DELETE_ACCOUNT':
        return {
            ...state,
            seeds: state.seeds.map(s => ({
                ...s,
                accounts: s.accounts.filter(a => a.id !== action.id)
            })),
            spendingMethods: state.spendingMethods.map(m => {
                const newSlots = m.keySlots.filter(accId => accId !== action.id);
                return {
                    ...m,
                    keySlots: newSlots,
                    threshold: Math.min(m.threshold, newSlots.length > 0 ? newSlots.length : 1)
                };
            })
        };

    case 'UPDATE_ACCOUNT_TYPE':
        return {
            ...state,
            seeds: state.seeds.map(s => ({
                ...s,
                accounts: s.accounts.map(a => a.id === action.id ? { ...a, type: action.accType } : a)
            }))
        };

    case 'ADD_SPENDING_METHOD': {
        const nextId = state.nextIds.method;
        const methodCount = state.spendingMethods.length;
        return {
            ...state,
            spendingMethods: [...state.spendingMethods, {
                id: `Method-${Date.now()}`,
                label: methodCount >= 1 ? 'Recovery Key' : 'Daily Spending',
                type: 'single-sig',
                threshold: 1,
                keySlots: [null]
            }],
            nextIds: { ...state.nextIds, method: nextId + 1 }
        };
    }

    case 'UPDATE_METHOD':
        return {
            ...state,
            spendingMethods: state.spendingMethods.map(m => {
                if (m.id === action.id) {
                    const updates = { ...action.updates };
                    let newSlots = [...m.keySlots];

                    // Auto-scale slots if n (shareCount) or type changes
                    if (updates.type === 'single-sig') {
                        newSlots = [m.keySlots[0] || null];
                        updates.threshold = 1;
                    } else if (updates.type === 'multi-sig') {
                        // Default to 2/3 for new multisig
                        newSlots = [null, null, null];
                        updates.threshold = 2;
                    }

                    if (updates.shareCount !== undefined) {
                        const target = updates.shareCount;
                        if (newSlots.length < target) {
                            while (newSlots.length < target) newSlots.push(null);
                        } else {
                            newSlots = newSlots.slice(0, target);
                        }
                        // Ensure threshold doesn't exceed n
                        if (m.threshold > target) updates.threshold = target;
                    }

                    if (updates.keySlots !== undefined) {
                        newSlots = updates.keySlots;
                    }

                    return { ...m, ...updates, keySlots: newSlots };
                }
                return m;
            })
        };

    case 'RENAME_METHOD':
        return {
            ...state,
            spendingMethods: state.spendingMethods.map(m => m.id === action.id ? { ...m, label: action.label } : m)
        };

    case 'DELETE_METHOD':
        return {
            ...state,
            spendingMethods: state.spendingMethods.filter(m => m.id !== action.id)
        };

    case 'ADD_OBJECT_COPY': {
        const currentCount = state.replication[action.logicalId] || 0;
        return {
            ...state,
            replication: { ...state.replication, [action.logicalId]: currentCount + 1 }
        };
    }

    case 'DELETE_OBJECT_COPY': {
        const currentCount = state.replication[action.logicalId] || 0;
        const totalInstances = currentCount + 1;
        const delIdx = action.copyIdx; // 0 for Copy #1, 1 for Copy #2...
        
        let newMapping = { ...state.objectMapping };
        
        // Logical migration: If we delete an instance, we need to shift subsequent instances up
        // or just ensure that we are left with a valid chain.
        // For simplicity: Identify all instances of this logicalId
        const instances = [];
        for (let i = 0; i < totalInstances; i++) {
            instances.push(i === 0 ? action.logicalId : `${action.logicalId}-copy-${i}`);
        }

        // Remove the deleted one from the list of instances
        const remainingInstanceIds = instances.filter((_, idx) => idx !== delIdx);
        
        // Re-map remaining to normalized IDs (0 to N-1)
        const updatedMapping = { ...state.objectMapping };
        // 1. Remove all old mappings for this logical group
        instances.forEach(id => delete updatedMapping[id]);
        
        // 2. Place remaining mappings into new IDs sequentially
        remainingInstanceIds.forEach((oldId, newIdx) => {
            const newId = newIdx === 0 ? action.logicalId : `${action.logicalId}-copy-${newIdx}`;
            if (state.objectMapping[oldId]) {
                updatedMapping[newId] = state.objectMapping[oldId];
            }
        });

        return {
            ...state,
            replication: { ...state.replication, [action.logicalId]: Math.max(0, currentCount - 1) },
            objectMapping: updatedMapping
        };
    }

    case 'MAP_OBJECT':
        return {
            ...state,
            objectMapping: {
                ...state.objectMapping,
                [action.objectId]: { locationId: action.locationId, storagePointId: action.storagePointId }
            }
        };

    case 'UPDATE_POINT_LABEL':
        return {
            ...state,
            locations: state.locations.map(l => l.id === action.locationId ? 
              { ...l, storagePoints: l.storagePoints.map(p => p.id === action.pointId ? { ...p, label: action.label } : p) } : l)
        };

    default:
      return state;
  }
}

export function SimulationProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const saved = localStorage.getItem('bitcoin_risk_sim_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'LOAD_STATE', payload: ensureStateSafety(parsed) });
      } catch (e) {
        console.error('Failed to load state', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('bitcoin_risk_sim_state', JSON.stringify(state));
  }, [state]);

  return (
    <SimulationContext.Provider value={{ state, dispatch }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('useSimulation must be used within SimulationProvider');
  return context;
}
