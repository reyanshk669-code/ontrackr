/**
 * HabitWall - Printable Wall Studio & Timetable Generator
 * High-Resolution PNG (300 DPI scale) & A4 Landscape PDF Exporter
 */

class PrintWallStudio {
  constructor() {
    this.selectedTemplate = 'matrix'; // 'matrix' or 'timetable'
    this.selectedTheme = 'theme-pastel'; // 'theme-pastel', 'theme-blueprint', 'theme-dark-poster'
    this.isCompletedMode = false; // false = Blank Printable Template, true = Completed Trophy Grid
    this.selectedMonth = new Date().getMonth(); // 0-11
    this.selectedYear = new Date().getFullYear();
    this.customTimetableBlocks = []; // Extra lectures/classes added by student

    this.init();
  }

  init() {
    this.cacheElements();
    this.setupListeners();
    this.populateMonthSelector();
    this.loadCustomBlocks();
    this.renderPreview();
  }

  cacheElements() {
    this.canvas = document.getElementById('print-a4-canvas');
    this.selectTemplate = document.getElementById('print-template-select');
    this.selectTheme = document.getElementById('print-theme-select');
    this.selectMonth = document.getElementById('print-month-select');
    this.toggleCompletedMode = document.getElementById('print-mode-toggle');
    this.btnExportPng = document.getElementById('btn-export-png');
    this.btnExportPdf = document.getElementById('btn-export-pdf');
    this.btnAddBlock = document.getElementById('btn-add-custom-block');
  }

  setupListeners() {
    if (this.selectTemplate) {
      this.selectTemplate.addEventListener('change', (e) => {
        this.selectedTemplate = e.target.value;
        const matrixControls = document.getElementById('print-matrix-controls');
        if (matrixControls) {
          matrixControls.style.display = this.selectedTemplate === 'matrix' ? 'flex' : 'none';
        }
        this.renderPreview();
      });
    }

    if (this.selectTheme) {
      this.selectTheme.addEventListener('change', (e) => {
        this.selectedTheme = e.target.value;
        this.renderPreview();
      });
    }

    if (this.selectMonth) {
      this.selectMonth.addEventListener('change', (e) => {
        const [year, month] = e.target.value.split('-').map(Number);
        this.selectedYear = year;
        this.selectedMonth = month;
        this.renderPreview();
      });
    }

    if (this.toggleCompletedMode) {
      this.toggleCompletedMode.addEventListener('change', (e) => {
        this.isCompletedMode = e.target.checked;
        const label = document.getElementById('print-mode-label');
        if (label) {
          label.textContent = this.isCompletedMode ? 'Completed Trophy Grid' : 'Blank Printable Wall Template';
        }
        this.renderPreview();
      });
    }

    if (this.btnExportPng) {
      this.btnExportPng.addEventListener('click', () => this.exportPNG());
    }

    if (this.btnExportPdf) {
      this.btnExportPdf.addEventListener('click', () => this.exportPDF());
    }

    if (this.btnAddBlock) {
      this.btnAddBlock.addEventListener('click', () => this.openAddBlockModal());
    }

    // Save custom timetable block modal form
    const formBlock = document.getElementById('form-add-timetable-block');
    if (formBlock) {
      formBlock.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('input-block-title').value.trim();
        const day = parseInt(document.getElementById('input-block-day').value);
        const start = document.getElementById('input-block-start').value;
        const end = document.getElementById('input-block-end').value;
        const color = document.getElementById('input-block-color').value;

        if (title && start && end) {
          this.customTimetableBlocks.push({
            title, day, start, end, color
          });
          this.saveCustomBlocks();
          const modalEl = document.getElementById('modal-add-timetable-block');
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
          formBlock.reset();
          this.renderPreview();
        }
      });
    }
  }

  populateMonthSelector() {
    if (!this.selectMonth) return;
    this.selectMonth.innerHTML = '';
    const date = new Date();

    // Past 3 months and next 3 months
    for (let offset = -2; offset <= 3; offset++) {
      const d = new Date(date.getFullYear(), date.getMonth() + offset, 1);
      const val = `${d.getFullYear()}-${d.getMonth()}`;
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (offset === 0) opt.selected = true;
      this.selectMonth.appendChild(opt);
    }
  }

  loadCustomBlocks() {
    try {
      const saved = localStorage.getItem('habitwall_custom_blocks');
      if (saved) {
        this.customTimetableBlocks = JSON.parse(saved);
      }
    } catch (e) {}
  }

  saveCustomBlocks() {
    localStorage.setItem('habitwall_custom_blocks', JSON.stringify(this.customTimetableBlocks));
  }

  openAddBlockModal() {
    const modalEl = document.getElementById('modal-add-timetable-block');
    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  renderPreview() {
    if (!this.canvas) return;

    // Apply print theme class
    this.canvas.className = `a4-landscape-canvas ${this.selectedTheme}`;

    if (this.selectedTemplate === 'matrix') {
      this.renderMonthlyMatrix();
    } else {
      this.renderWeeklyTimetable();
    }
  }

  renderMonthlyMatrix() {
    const habits = AppState.habits || [];
    const daysInMonth = new Date(this.selectedYear, this.selectedMonth + 1, 0).getDate();
    const monthName = new Date(this.selectedYear, this.selectedMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    let headerHtml = `
      <div class="sheet-header-block">
        <div class="sheet-header-title">
          <span>📅</span> ${monthName} Habit Tracking Wall
        </div>
        <div class="sheet-header-meta">
          <div>Mode: <strong>${this.isCompletedMode ? 'Trophy Record Grid' : 'Blank Wall Planner'}</strong></div>
          <div>Student Edition • Habit Strength Target: 80%+</div>
        </div>
      </div>
    `;

    // Table Header with Days 1..31
    let tableHead = `<tr><th class="col-habit-name">Habit / Subject Module</th>`;
    for (let d = 1; d <= daysInMonth; d++) {
      tableHead += `<th class="col-day-cell">${d}</th>`;
    }
    tableHead += `</tr>`;

    // Habit Rows
    let tableBody = '';
    habits.forEach(h => {
      const color = h.hex_color || '#4F46E5';
      tableBody += `<tr>`;
      tableBody += `
        <td class="col-habit-name" title="${h.name}">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${color}; margin-right:6px;"></span>
          <strong>${h.name}</strong> <span style="font-size:0.65rem; opacity:0.75;">(${h.category})</span>
        </td>
      `;

      // Check-ins lookup for habit
      const checkinMap = {};
      if (h.check_ins) {
        h.check_ins.forEach(c => {
          checkinMap[c.checkin_date] = c;
        });
      }

      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const dateStr = `${this.selectedYear}-${String(this.selectedMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const record = checkinMap[dateStr];

        if (!this.isCompletedMode) {
          // Blank Printable Mode: circle with habit outline for physical markers
          tableBody += `
            <td class="col-day-cell">
              <div class="matrix-check-dot blank-mode" style="border-color: ${color}99;"></div>
            </td>
          `;
        } else {
          // Completed Trophy Mode
          if (record && record.status === 'COMPLETED') {
            tableBody += `
              <td class="col-day-cell">
                <div class="matrix-check-dot completed-dot" style="background-color: ${color};">✓</div>
              </td>
            `;
          } else if (record && record.status === 'SKIPPED') {
            tableBody += `
              <td class="col-day-cell">
                <div class="matrix-check-dot skipped-dot">⏸</div>
              </td>
            `;
          } else if (record && record.status === 'PARTIAL') {
            tableBody += `
              <td class="col-day-cell">
                <div class="matrix-check-dot" style="background-color: ${color}44; color: ${color}; font-size:0.6rem;">${Math.round(record.value_completed)}</div>
              </td>
            `;
          } else {
            tableBody += `
              <td class="col-day-cell">
                <div class="matrix-check-dot" style="border: 1px dotted #CBD5E1;"></div>
              </td>
            `;
          }
        }
      }

      tableBody += `</tr>`;
    });

    let footerHtml = `
      <div class="sheet-footer-block">
        <div>Generated with <strong>HabitWall Studio</strong> • Pin to Study Wall</div>
        <div>Check legend: [✓] Completed • [⏸] Rest / Skipped Day (Streaks Protected)</div>
      </div>
    `;

    this.canvas.innerHTML = `
      ${headerHtml}
      <div class="wall-matrix-table-wrap">
        <table class="wall-table">
          <thead>${tableHead}</thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>
      ${footerHtml}
    `;
  }

  renderWeeklyTimetable() {
    const habits = AppState.habits || [];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    let headerHtml = `
      <div class="sheet-header-block">
        <div class="sheet-header-title">
          <span>🕒</span> Weekly Study Wall Timetable & Class Block Schedule
        </div>
        <div class="sheet-header-meta">
          <div>A4 Study Room Wall Display</div>
          <div>Color-Coded Habit Blocks & Lectures</div>
        </div>
      </div>
    `;

    // Timetable time slots: Morning, Afternoon, Evening, Night
    const timeSlots = [
      { label: '06:00 - 08:00 (Early Morning)', startH: 6, endH: 8 },
      { label: '08:00 - 10:00 (Morning Deep Work)', startH: 8, endH: 10 },
      { label: '10:00 - 12:00 (Mid-Day Lecture / Study)', startH: 10, endH: 12 },
      { label: '12:00 - 14:00 (Lunch & Review)', startH: 12, endH: 14 },
      { label: '14:00 - 16:30 (Afternoon Labs & Coding)', startH: 14, endH: 16.5 },
      { label: '16:30 - 18:30 (Revision & Problem Solving)', startH: 16.5, endH: 18.5 },
      { label: '18:30 - 20:30 (Evening Focus Habit)', startH: 18.5, endH: 20.5 },
      { label: '20:30 - 22:30 (Night Reading & Wrap-up)', startH: 20.5, endH: 22.5 }
    ];

    let tableHead = `<tr><th style="width: 130px;">Time Window</th>`;
    days.forEach(d => {
      tableHead += `<th class="timetable-header">${d}</th>`;
    });
    tableHead += `</tr>`;

    let tableBody = '';
    timeSlots.forEach((slot, slotIndex) => {
      tableBody += `<tr>`;
      tableBody += `<td style="font-weight:700; font-size:0.68rem; background-color:rgba(0,0,0,0.03); vertical-align:middle;">${slot.label}</td>`;

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        // Collect matching habits
        const matchingHabits = habits.filter(h => {
          if (!h.scheduled_time_slot) return false;
          // Check frequency
          if (h.frequency_type === 'SPECIFIC_DAYS') {
            const schedDays = (h.frequency_data || '').split(',').map(s => parseInt(s.trim()));
            if (!schedDays.includes(dayIdx)) return false;
          }
          // Parse habit time slot (e.g. "07:00 - 08:30" or "18:00 - 19:00")
          const habitHour = parseFloat(h.scheduled_time_slot.split(':')[0]) || 0;
          return habitHour >= slot.startH && habitHour < slot.endH;
        });

        // Collect custom blocks for this day and slot
        const matchingCustom = this.customTimetableBlocks.filter(b => {
          if (b.day !== dayIdx) return false;
          const bHour = parseFloat(b.start.split(':')[0]) || 0;
          return bHour >= slot.startH && bHour < slot.endH;
        });

        tableBody += `<td class="timetable-cell">`;
        matchingHabits.forEach(h => {
          tableBody += `
            <div class="timetable-slot-block" style="background-color: ${h.hex_color || '#4F46E5'};">
              <strong>${h.name}</strong><br/>
              <span>${h.scheduled_time_slot}</span>
            </div>
          `;
        });

        matchingCustom.forEach(cb => {
          tableBody += `
            <div class="timetable-slot-block" style="background-color: ${cb.color || '#10B981'};">
              <strong>${cb.title}</strong><br/>
              <span>${cb.start} - ${cb.end}</span>
            </div>
          `;
        });

        tableBody += `</td>`;
      }

      tableBody += `</tr>`;
    });

    let footerHtml = `
      <div class="sheet-footer-block">
        <div>Weekly Academic Schedule • HabitWall Studio</div>
        <div>Tip: Pin to your study desk for clear daily focus blocks.</div>
      </div>
    `;

    this.canvas.innerHTML = `
      ${headerHtml}
      <div class="timetable-grid-wrap">
        <table class="timetable-grid-table">
          <thead>${tableHead}</thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>
      ${footerHtml}
    `;
  }

  async exportPNG() {
    if (!this.canvas) return;
    const btn = this.btnExportPng;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Generating 300 DPI PNG...';
    btn.disabled = true;

    try {
      const canvasEl = await html2canvas(this.canvas, {
        scale: 3, // Razor-sharp 300 DPI scale
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: this.selectedTheme === 'theme-dark-poster' ? '#0F172A' : (this.selectedTheme === 'theme-pastel' ? '#FDFBF7' : '#FFFFFF')
      });

      const link = document.createElement('a');
      link.download = `HabitWall_${this.selectedTemplate}_${this.selectedYear}-${this.selectedMonth + 1}.png`;
      link.href = canvasEl.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('PNG export failed:', err);
      alert('Error generating PNG. Try printing directly via PDF.');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }

  async exportPDF() {
    if (!this.canvas) return;
    const btn = this.btnExportPdf;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Rendering A4 PDF...';
    btn.disabled = true;

    try {
      // Use html2canvas to capture pixel-perfect render
      const canvasEl = await html2canvas(this.canvas, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: this.selectedTheme === 'theme-dark-poster' ? '#0F172A' : (this.selectedTheme === 'theme-pastel' ? '#FDFBF7' : '#FFFFFF')
      });

      const imgData = canvasEl.toDataURL('image/jpeg', 0.95);
      const { jsPDF } = window.jspdf;

      // A4 Landscape is 297mm x 210mm
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210);
      pdf.save(`HabitWall_${this.selectedTemplate}_A4_${this.selectedYear}-${this.selectedMonth + 1}.pdf`);
    } catch (err) {
      console.error('PDF export failed, opening browser print dialog as fallback:', err);
      window.print();
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.PrintStudio = new PrintWallStudio();
});
