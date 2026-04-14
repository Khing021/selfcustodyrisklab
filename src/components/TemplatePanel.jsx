import React from 'react';
import { useSimulation } from '../store/SimulationContext';
import { templates } from '../data/templates';
import './TemplatePanel.css';

function TemplatePanel({ isOpen, onClose }) {
  const { dispatch } = useSimulation();

  const handleLoadTemplate = (templateKey) => {
    if (window.confirm('การโหลดเทมเพลตจะเขียนทับข้อมูลปัจจุบันทั้งหมด คุณแน่ใจหรือไม่?')) {
      dispatch({ 
        type: 'LOAD_STATE', 
        payload: templates[templateKey].state 
      });
      onClose();
    }
  };

  const handleReset = () => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลทั้งหมดและกลับสู่ค่าเริ่มต้น?')) {
      dispatch({ type: 'RESET_TO_DEFAULT' });
      onClose();
    }
  };

  return (
    <>
      <div className={`template-panel-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`template-panel ${isOpen ? 'open' : ''}`}>
        <div className="panel-header">
          <h3>เทมเพลต</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="panel-content">
          <p className="panel-hint">เลือกเทมเพลตมาตรฐานเพื่อเริ่มต้นจำลองความเสี่ยงได้ทันที</p>
          
          <div className="template-list">
            {Object.entries(templates).map(([key, template]) => (
              <button 
                key={key} 
                className="template-item-btn"
                onClick={() => handleLoadTemplate(key)}
              >
                <span className="template-icon">🛡️</span>
                <span className="template-label">{template.label}</span>
              </button>
            ))}
          </div>

          <div className="panel-footer">
            <button className="reset-btn" onClick={handleReset}>
              🔄 คืนค่าเริ่มต้น (Reset to Default)
            </button>
            <p className="footer-disclaimer">
              * การโหลดเทมเพลตจะแทนที่ข้อมูลที่คุณตั้งค่าไว้ทั้งหมดกรุณาตรวจสอบก่อนกด
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default TemplatePanel;
