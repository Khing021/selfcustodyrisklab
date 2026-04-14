# Bitcoin Self-Custody Risk Simulator 🔒

[![GitHub Actions Workflow](https://img.shields.io/github/actions/workflow/status/Khing021/selfcustodyrisklab/deploy.yml)](https://github.com/Khing021/selfcustodyrisklab/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[🇹🇭 ภาษาไทยด้านล่าง](#thai-version)**

A free, open-source advanced interactive web application designed to help Bitcoiners simulate and evaluate the risks associated with their self-custody wallet setups. Test your strategies against theft, disaster, memory loss, and more.

## ⚠️ Disclaimer

**This is a "Vibe Coding" project.** 
The majority of the source code and logic for this tool was algorithmically generated using AI coding assistants. While great care has been taken to make the simulations realistic and useful, it may contain logical inconsistencies or bugs. 

**Do NOT rely solely on this tool for determining the security of your life savings.** Always conduct your own research, consult multiple security models, and verify hardware wallet setup instructions from official sources before entrusting real funds to any strategy.

## Key Features
- Design multi-sig & passphrase architectures.
- Define custom geographical and cloud storage locations for your keys.
- Simulate and analyze vulnerabilities under 4 major categories:
    - **A:** Normal Operation (Cloud dependency, privacy leaks)
    - **B:** Compromise (Theft, Burglary, including multi-location Black Swan)
    - **C:** Disaster (Fire, Flood, including multi-location Black Swan)
    - **D:** Memory Loss (Forgetting PINs, Phrases, or Device Access)
- **Advanced Black Swan Simulation**: Evaluate what happens when multiple locations or backups fail simultaneously.

---

<a name="thai-version"></a>
# โปรแกรมจำลองความเสี่ยงการเก็บรักษาบิตคอยน์ด้วยตนเอง 🔒

แอปพลิเคชันรูปแบบ Web-app เปิดให้ใช้งานฟรี (Free & Open Source Software) ที่ออกแบบมาเพื่อช่วยวิเคราะห์และจำลองความเสี่ยงในการจัดการกระเป๋าบิตคอยน์ด้วยตนเอง (Self-Custody) คุณสามารถทดสอบการวางแผนและประเมินความเสี่ยงต่อเหตุการณ์ต่างๆ เช่น โจรปล้น ภัยพิบัติทางธรรมชาติ หรือการสูญเสียความทรงจำ

## ⚠️ คำเตือน (Disclaimer)

**โปรเจกต์นี้เกิดจากการทำ "Vibe Coding"**
โค้ดส่วนใหญ่และตรรกะในระบบการจำลองถูกสร้างขึ้นด้วย AI (Agentic AI) แม้ระบบจะถูกออกแบบมาอย่างเต็มที่เพื่อให้ผลการจำลองมีความแม่นยำและสมจริง แต่ระบบอาจยังคงมีข้อผิดพลาดแฝงอยู่ (Bugs/Logical Inconsistencies)

**โปรดอย่ายึดถือผลวิเคราะห์จากเครื่องมือนี้เป็นตัวตัดสินสุดท้ายเพียงหนึ่งเดียว ในการจัดการพอร์ตการลงทุนหรือเงินออมทั้งชีวิตของคุณ** โปรดศึกษาข้อมูลเพิ่มเติม ตรวจสอบทฤษฎีความปลอดภัยอื่นๆ ควบคู่กัน และทำตามคู่มือจากผู้ผลิต Hardware Wallet อย่างเคร่งครัดเสมอ

## ฟีเจอร์หลัก
- ออกแบบโครงสร้างแบบ Multi-sig และ Passphrase ได้อิสระ
- กำหนดตำแหน่งพื้นที่จัดเก็บของวัตถุกุญแจได้อย่างแม่นยำ (สถานที่จริง และ ระบบคลาวด์)
- ทดสอบความปลอดภัยผ่าน 4 หมวดหมู่หลัก:
    - **A:** สถานะปกติ (การพึ่งพาคลาวด์, การรั่วไหลของข้อมูล)
    - **B:** โจรกรรม (บ้านถูกงัด, ตู้เซฟโดนขโมย รวมถึงเหตุการณ์ Black Swan หลายจุดพร้อมกัน)
    - **C:** ภัยพิบัติ (อัคคีภัย, ของสูญหาย รวมถึงเหตุการณ์ Black Swan หลายจุดพร้อมกัน)
    - **D:** การลืมข้อมูล (ลืมรหัส PIN, ลืมชุดคำ หรือลืมวิธีเข้าถึงอุปกรณ์)
- **ระบบจำลอง Black Swan ขั้นสูง**: ประเมินผลลัพธ์ในกรณีที่สถานที่เก็บของหลายแห่งเกิดปัญหาขึ้นพร้อมกัน

---

## Developer / Credits
**Vibe coding by [ขิงว่านะ](https://www.facebook.com/takrudcrypto21)**

## Running Locally

1. `npm install`
2. `npm run dev`
3. Access at `http://localhost:5173`
