import React, { useState } from 'react';
import { SimulationProvider } from './store/SimulationContext';
import LocationManager from './components/LocationManager';
import KeyLab from './components/KeyLab';
import StrategyDesigner from './components/StrategyDesigner';
import AnalysisSummary from './components/AnalysisSummary';
import StateManagement from './components/StateManagement';
import './App.css';

function App() {
  const scrollTo = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <SimulationProvider>
      <div className="app-shell">
        <header className="main-header">
          <div className="container header-content">
            <div className="logo">
              <span className="bitcoin-icon">₿</span>
              <h1>Self-Custody <span className="accent-text">Risk Lab</span></h1>
            </div>
            <nav className="main-nav">
              <button className="nav-item" onClick={() => scrollTo('setup')}>
                1. ตั้งค่าการจัดเก็บ
              </button>
              <button className="nav-item result-nav-btn" onClick={() => scrollTo('summary')}>
                2. สรุปผลความเสี่ยง
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
            <p>© 2026 Bitcoin Self-Custody Simulation Tool - Built for educational purposes.</p>
            <StateManagement />
          </div>
        </footer>
      </div>
    </SimulationProvider>
  );
}

export default App;
