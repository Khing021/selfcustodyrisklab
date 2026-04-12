import React, { useRef } from 'react';
import { useSimulation } from '../store/SimulationContext';

function StateManagement() {
  const { state, dispatch } = useSimulation();
  const fileInputRef = useRef(null);

  const handleExport = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `bitcoin_sim_state_${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        // Basic validation: check if it's a valid simulation state
        if (json.locations && json.seeds && json.spendingMethods) {
          dispatch({ type: 'LOAD_STATE', payload: json });
          alert('เรียกคืนค่าการตั้งค่าสำเร็จ');
        } else {
          alert('ไฟล์ไม่ถูกต้องตามรูปแบบการตั้งค่าของ simulator');
        }
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์ JSON');
        console.error(err);
      }
    };
    reader.readAsText(file);
    // Reset input value to allow importing the same file again if needed
    event.target.value = '';
  };

  const triggerImport = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="state-management-controls">
      <button className="btn-state-utility" onClick={handleExport}>
        <span className="btn-icon">📥</span> Export JSON
      </button>
      <button className="btn-state-utility" onClick={triggerImport}>
        <span className="btn-icon">📤</span> Import JSON
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImport}
        accept=".json"
        style={{ display: 'none' }}
      />
    </div>
  );
}

export default StateManagement;
