import React from 'react';
import { useSimulation } from '../store/SimulationContext';

function LocationManager() {
  const { state, dispatch } = useSimulation();

  return (
    <div className="location-manager">
      <div className="card-grid">
        {state.locations.map((loc, index) => {
          const locChar = String.fromCharCode(65 + index); // 0 -> A, 1 -> B...
          return (
            <div key={loc.id} className="glass-card location-card animate-fade-in">
              <div className="card-header">
                <div className="title-area">
                  <span className="static-id">สถานที่ {locChar}</span>
                  <span className="pencil-icon" title="แก้ไขชื่อเรียก">✎</span>
                  <input 
                    className="editable-title"
                    value={loc.label}
                    onChange={(e) => dispatch({ type: 'UPDATE_LOCATION_LABEL', id: loc.id, label: e.target.value })}
                  />
                </div>
                <button 
                  className="icon-btn trash-btn"
                  title="ลบสถานที่นี้"
                  onClick={() => dispatch({ type: 'DELETE_LOCATION', id: loc.id })}
                >
                  🗑️
                </button>
              </div>
              
              <div className="storage-points-list">
                {loc.storagePoints.map((point, pointIndex) => {
                  const pointCode = `${locChar}${pointIndex + 1}`;
                  return (
                    <div key={point.id} className="tree-row">
                      <span className="tree-branch">{pointIndex === loc.storagePoints.length - 1 ? '└─' : '├─'}</span>
                      <div className="storage-point-item">
                        <div className="point-info">
                          <span className="static-id small">จุดเก็บของ {pointCode}</span>
                          <span className="pencil-icon small" title="แก้ไขชื่อเรียก">✎</span>
                          <input 
                            className="point-input"
                            value={point.label.replace(/\(.*\)/, '').trim()}
                            onChange={(e) => dispatch({ 
                              type: 'UPDATE_POINT_LABEL', 
                              locationId: loc.id, 
                              pointId: point.id, 
                              label: e.target.value 
                            })}
                          />
                          <div 
                            className="lock-control"
                            title={point.isLocked ? "ถูกล็อคด้วยรหัสผ่านหรือกุญแจ เช่น เก็บในตู้เซฟ" : "ไม่ได้ถูกล็อคด้วยรหัสผ่านหรือกุญแจ"}
                          >
                            <label className="toggle-switch">
                              <input 
                                type="checkbox" 
                                checked={point.isLocked}
                                onChange={() => dispatch({ type: 'TOGGLE_STORAGE_LOCK', pointId: point.id })}
                              />
                              <span className="slider"></span>
                            </label>
                            <span className="lock-icon-btn">
                              {point.isLocked ? '🔒' : '🔓'}
                            </span>
                          </div>
                        </div>
                        <button 
                          className="point-delete-btn"
                          title="ลบจุดเก็บนี้"
                          onClick={() => dispatch({ type: 'DELETE_STORAGE_POINT', locationId: loc.id, pointId: point.id })}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button 
                  className="add-sub-btn"
                  onClick={() => dispatch({ type: 'ADD_STORAGE_POINT', locationId: loc.id })}
                >
                  + เพิ่มจุดเก็บของ
                </button>
              </div>
            </div>
          );
        })}

        <button className="add-btn" onClick={() => dispatch({ type: 'ADD_LOCATION' })}>
          <span className="add-icon">+</span>
          เพิ่มสถานที่ (อาคาร)
        </button>
      </div>
    </div>
  );
}

export default LocationManager;
