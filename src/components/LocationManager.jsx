import React from 'react';
import { useSimulation } from '../store/SimulationContext';

function LocationManager() {
  const { state, dispatch } = useSimulation();

  return (
    <div className="location-manager">
      <div className="card-grid">
        {/* 1. Physical Locations (Buildings) */}
        {state.locations.map((loc, index) => {
          const locChar = String.fromCharCode(65 + index);
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

        {/* 2. Cloud Storages */}
        {state.clouds.map((cloud, index) => {
          const cloudChar = String.fromCharCode(65 + index);
          return (
            <div key={cloud.id} className="glass-card location-card type-cloud animate-fade-in">
              <div className="card-header">
                <div className="title-area">
                  <span className="static-id">คลาวด์ {cloudChar}</span>
                  <span className="pencil-icon" title="แก้ไขชื่อเรียก">✎</span>
                  <input 
                    className="editable-title"
                    value={cloud.label}
                    onChange={(e) => dispatch({ type: 'UPDATE_CLOUD_LABEL', id: cloud.id, label: e.target.value })}
                  />
                </div>
                <button 
                  className="icon-btn trash-btn"
                  title="ลบคลาวด์นี้"
                  onClick={() => dispatch({ type: 'DELETE_CLOUD', id: cloud.id })}
                >
                  🗑️
                </button>
              </div>

              <div className="cloud-content" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginTop: '8px' }}>
                 <div className="storage-point-item" style={{ border: 'none', background: 'transparent', padding: '0' }}>
                    <div className="point-info">
                       <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          การเข้ารหัสลับ (Encryption)
                       </span>
                       <div 
                        className="lock-control"
                        title={cloud.isLocked 
                          ? "มีการเข้ารหัส ผู้ให้บริการหรือแฮ็กเกอร์ไม่สามารถอ่านไฟล์ได้หากไม่มีรหัส เช่น Bitwarden" 
                          : "ไม่มีการเข้ารหัส ข้อมูลสามารถถูกอ่านได้โดยผู้ให้บริการหรือแฮ็กเกอร์ เช่น การฝากไฟล์ใน Google Drive หรือ Dropbox"}
                      >
                        <label className="toggle-switch">
                          <input 
                            type="checkbox" 
                            checked={cloud.isLocked}
                            onChange={() => dispatch({ type: 'TOGGLE_CLOUD_LOCK', id: cloud.id })}
                          />
                          <span className="slider"></span>
                        </label>
                        <span className="lock-icon-btn">
                          {cloud.isLocked ? '🔒' : '🔓'}
                        </span>
                      </div>
                    </div>
                 </div>
              </div>
            </div>
          );
        })}

        <div className="split-add-area">
          <button className="add-btn" onClick={() => dispatch({ type: 'ADD_LOCATION' })}>
            <span className="add-icon">+</span>
            เพิ่มสถานที่ (อาคาร)
          </button>
          <button className="add-btn" onClick={() => dispatch({ type: 'ADD_CLOUD' })}>
            <span className="add-icon">+</span>
            เพิ่มคลาวด์
          </button>
        </div>

      </div>
    </div>
  );
}

export default LocationManager;
