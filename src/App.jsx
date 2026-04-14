import React, { useState } from 'react';
import { SimulationProvider } from './store/SimulationContext';
import LocationManager from './components/LocationManager';
import KeyLab from './components/KeyLab';
import StrategyDesigner from './components/StrategyDesigner';
import AnalysisSummary from './components/AnalysisSummary';
import StateManagement from './components/StateManagement';
import TemplatePanel from './components/TemplatePanel';
import './App.css';

function App() {
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false);

  const scrollTo = (id) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100; // 80px header + 20px padding
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <SimulationProvider>
      <div className="app-shell">
        <header className="main-header">
          <div className="container header-content">
            <div className="logo">
              <span className="bitcoin-icon">🔒</span>
              <h1>Self-Custody <span className="accent-text">Risk Lab</span></h1>
            </div>
            <nav className="main-nav">
              <button className="nav-item" onClick={() => scrollTo('setup')}>
                ออกแบบวิธีเก็บรักษา
              </button>
              <button className="nav-item" onClick={() => scrollTo('summary')}>
                ผลวิเคราะห์ความเสี่ยง
              </button>
              <button 
                className="nav-item template-toggle-btn" 
                onClick={() => setIsTemplatePanelOpen(true)}
                title="เลือกเทมเพลตมาตรฐาน"
              >
                ☰
              </button>
            </nav>
          </div>
        </header>

        <main className="container main-content animate-fade-in">
          <div className="combined-layout">
            <div id="setup" className="input-journey">
              <section className="journey-section">
                <header className="section-header-inline">
                  <h2>1. ข้อมูลสถานที่ (Locations)</h2>
                  <p>ระบุอาคารและจุดเก็บของที่คุณใช้รักษากุญแจบิทคอยน์</p>
                </header>
                <LocationManager />
              </section>

              <hr className="divider" />

              <section className="journey-section">
                <header className="section-header-inline">
                  <h2>2. คีย์และวอลเล็ต (Keys & Wallets)</h2>
                  <p>ระบุการสร้าง Seed, Passphrase และประเภทของ Address</p>
                </header>
                <KeyLab />
              </section>

              <hr className="divider" />

              <section className="journey-section">
                <header className="section-header-inline">
                  <h2>3. วิธีการใช้เงินและวัตถุ (Strategies & Objects)</h2>
                  <p>เชื่อมโยงกุญแจเข้ากับกลยุทธ์การถอนเงิน และย้ายวัตถุไปเก็บตามสถานที่</p>
                </header>
                <StrategyDesigner />
              </section>
            </div>

            <div id="summary" className="summary-section-wrapper">
              <header className="section-header-inline">
                <h2>บทสรุปและการจำลองความเสี่ยง</h2>
                <p>ผลลัพธ์แบบ Real-time จากการตั้งค่าด้านบน</p>
              </header>
              <div className="summary-view">
                <AnalysisSummary />
              </div>
            </div>
          </div>
        </main>

        <footer className="main-footer">
          <div className="container">
            <div className="footer-credits">
                <p>Vibe coding by <a href="https://www.facebook.com/takrudcrypto21" target="_blank" rel="noopener noreferrer" className="credit-link">ขิงว่านะ</a></p>
                <a href="https://github.com/Khing021/selfcustodyrisklab" target="_blank" rel="noopener noreferrer" className="github-btn">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    View on GitHub
                </a>
            </div>
            <p className="disclaimer-text">© 2026 Bitcoin Self-Custody Risk Lab - Free & Opensource. Built for educational purposes.</p>
            <StateManagement />
          </div>
        </footer>
        <TemplatePanel 
          isOpen={isTemplatePanelOpen} 
          onClose={() => setIsTemplatePanelOpen(false)} 
        />
      </div>
    </SimulationProvider>
  );
}

export default App;
