/**
 * HabitWall - Loop-Style Habit Deep-Dive Studio
 * Inspired by Loop Habit Tracker (Alinson Xavier)
 * Smooth Continuous Strength Graph, Full Interactive Monthly Calendar, and Revision Feed
 */

class AnalyticsModalStudio {
  constructor() {
    this.strengthChartInstance = null;
    this.weekdayChartInstance = null;
    this.currentHabit = null;
    this.calendarRecords = {};
    this.revisionNotes = [];
    this.strengthHistory = [];

    // Interactive calendar state
    const now = new Date();
    this.calMonth = now.getMonth(); // 0-11
    this.calYear = now.getFullYear();

    this.init();
  }

  init() {
    this.setupTooltip();
    this.setupSearchFilter();
    this.setupCalendarNav();
  }

  setupTooltip() {
    this.tooltip = document.getElementById('heatmap-tooltip');
    if (!this.tooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.id = 'heatmap-tooltip';
      document.body.appendChild(this.tooltip);
    }
  }

  setupSearchFilter() {
    const searchInput = document.getElementById('revision-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        this.filterRevisionLog(query);
      });
    }
  }

  setupCalendarNav() {
    const btnPrev = document.getElementById('btn-cal-prev-month');
    const btnNext = document.getElementById('btn-cal-next-month');

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        this.calMonth--;
        if (this.calMonth < 0) {
          this.calMonth = 11;
          this.calYear--;
        }
        this.renderInteractiveCalendar();
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        this.calMonth++;
        if (this.calMonth > 11) {
          this.calMonth = 0;
          this.calYear++;
        }
        this.renderInteractiveCalendar();
      });
    }
  }

  async open(habitId) {
    try {
      const modalEl = document.getElementById('modal-habit-analytics');
      if (!modalEl) return;

      const modal = new bootstrap.Modal(modalEl);
      modal.show();

      document.getElementById('analytics-habit-title').textContent = 'Loading statistics...';

      const res = await fetch(`/api/analytics/habit/${habitId}`);
      const data = await res.json();

      if (data.status !== 'success') {
        alert(data.message || 'Error loading habit analytics');
        return;
      }

      this.currentHabit = data.habit;
      this.revisionNotes = data.revision_log || [];
      this.strengthHistory = data.strength_history || [];
      this.calendarRecords = data.calendar_records || {};

      const now = new Date();
      this.calMonth = now.getMonth();
      this.calYear = now.getFullYear();

      this.renderHeader(data.habit, data.metrics, data.strength_change_30d);
      this.renderStrengthChart(this.strengthHistory, data.habit.hex_color);
      this.renderInteractiveCalendar();
      this.renderStatCards(data.metrics, data.stats_breakdown);
      this.renderWeekdayChart(data.day_of_week_stats, data.habit.hex_color);
      this.renderRevisionLog(this.revisionNotes);
    } catch (err) {
      console.error('Failed to open analytics modal:', err);
    }
  }

  renderHeader(habit, metrics, strengthChange) {
    const titleEl = document.getElementById('analytics-habit-title');
    const badgeEl = document.getElementById('analytics-habit-category');
    const heroScore = document.getElementById('strength-hero-score');
    const trendBadge = document.getElementById('strength-trend-badge');

    if (titleEl) titleEl.textContent = habit.name;
    if (badgeEl) {
      badgeEl.textContent = habit.category;
      badgeEl.style.backgroundColor = habit.hex_color || '#4F46E5';
      badgeEl.style.color = '#FFFFFF';
    }

    if (heroScore) {
      heroScore.textContent = `${metrics?.habit_strength || 0}%`;
      heroScore.style.color = habit.hex_color || '#4F46E5';
    }

    if (trendBadge) {
      const change = strengthChange || 0;
      if (change >= 0) {
        trendBadge.className = 'strength-trend-badge trend-up';
        trendBadge.textContent = `↑ +${change}% this month`;
      } else {
        trendBadge.className = 'strength-trend-badge trend-down';
        trendBadge.textContent = `↓ ${change}% this month`;
      }
    }
  }

  // Loop's Signature Continuous Smooth Strength Spline Graph
  renderStrengthChart(history, hexColor) {
    const canvas = document.getElementById('chart-habit-strength-curve');
    if (!canvas) return;

    if (this.strengthChartInstance) {
      this.strengthChartInstance.destroy();
    }

    const labels = history.map(item => {
      const parts = item.date.split('-');
      return `${parts[1]}/${parts[2]}`;
    });
    const scores = history.map(item => item.strength);
    const color = hexColor || '#4F46E5';

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, color + '55');
    gradient.addColorStop(1, color + '00');

    this.strengthChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Habit Strength %',
          data: scores,
          borderColor: color,
          borderWidth: 2.5,
          backgroundColor: gradient,
          fill: true,
          tension: 0.35, // Smooth spline curve
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: color,
          pointHoverBorderColor: '#FFFFFF',
          pointHoverBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context) => `Strength: ${context.parsed.y}%`
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              callback: (v) => `${v}%`,
              color: '#94A3B8',
              font: { size: 10 }
            },
            grid: { color: 'rgba(255, 255, 255, 0.06)' }
          },
          x: {
            ticks: {
              maxTicksLimit: 8,
              color: '#94A3B8',
              font: { size: 10 }
            },
            grid: { display: false }
          }
        }
      }
    });
  }

  // Loop's Signature Interactive Monthly Calendar View
  renderInteractiveCalendar() {
    const titleEl = document.getElementById('calendar-current-month-label');
    const gridEl = document.getElementById('calendar-interactive-grid');
    if (!titleEl || !gridEl) return;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    titleEl.textContent = `${monthNames[this.calMonth]} ${this.calYear}`;

    gridEl.innerHTML = '';

    // Day headers: Mon to Sun
    const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayHeaders.forEach(dh => {
      const hEl = document.createElement('div');
      hEl.className = 'calendar-day-header';
      hEl.textContent = dh;
      gridEl.appendChild(hEl);
    });

    const firstDayIndex = (new Date(this.calYear, this.calMonth, 1).getDay() + 6) % 7; // Monday = 0
    const totalDaysInMonth = new Date(this.calYear, this.calMonth + 1, 0).getDate();
    const prevMonthDays = new Date(this.calYear, this.calMonth, 0).getDate();

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const cell = document.createElement('div');
      cell.className = 'calendar-day-cell other-month';
      cell.textContent = prevMonthDays - i;
      gridEl.appendChild(cell);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const color = this.currentHabit?.hex_color || '#4F46E5';

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${this.calYear}-${String(this.calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const record = this.calendarRecords[dateStr];
      const isToday = (dateStr === todayStr);

      const cell = document.createElement('div');
      cell.className = `calendar-day-cell ${isToday ? 'today' : ''}`;
      cell.textContent = d;

      if (record) {
        if (record.status === 'COMPLETED') {
          cell.className += ' completed';
          cell.style.backgroundColor = color;
        } else if (record.status === 'SKIPPED') {
          cell.className += ' skipped';
        } else if (record.status === 'PARTIAL') {
          cell.style.backgroundColor = color + '44';
          cell.style.border = `1px solid ${color}`;
        }
      }

      // Interactive Click on any day to toggle check-in
      cell.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/checkins/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              habit_id: this.currentHabit.id,
              checkin_date: dateStr
            })
          });
          const resData = await res.json();
          if (resData.status === 'success') {
            if (resData.checkin.status === 'UNCHECKED') {
              delete this.calendarRecords[dateStr];
            } else {
              this.calendarRecords[dateStr] = resData.checkin;
            }
            this.renderInteractiveCalendar();
            if (window.HabitApp) window.HabitApp.loadDashboardData(false);
          }
        } catch (e) {
          console.error('Error toggling calendar day:', e);
        }
      });

      gridEl.appendChild(cell);
    }
  }

  renderStatCards(metrics, breakdown) {
    if (!metrics) return;
    document.getElementById('stat-habit-strength').textContent = `${metrics.habit_strength}%`;
    document.getElementById('stat-current-streak').textContent = `${metrics.current_streak} days`;
    document.getElementById('stat-best-streak').textContent = `${metrics.best_streak} days`;
    
    const rate = breakdown ? `${breakdown.success_rate}%` : `${metrics.total_completions} logged`;
    document.getElementById('stat-total-completions').textContent = rate;
  }

  renderWeekdayChart(weekdayStats, hexColor) {
    const canvas = document.getElementById('chart-weekday-breakdown');
    if (!canvas) return;

    if (this.weekdayChartInstance) {
      this.weekdayChartInstance.destroy();
    }

    const labels = weekdayStats.map(s => s.day_name);
    const rates = weekdayStats.map(s => s.completion_rate);
    const color = hexColor || '#4F46E5';

    const ctx = canvas.getContext('2d');
    this.weekdayChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Completion %',
          data: rates,
          backgroundColor: color + 'CC',
          borderColor: color,
          borderWidth: 1.5,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const stat = weekdayStats[context.dataIndex];
                return `${context.parsed.y}% (${stat.completed_count}/${stat.scheduled_count} days)`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (v) => `${v}%`,
              color: '#94A3B8',
              font: { size: 10 }
            },
            grid: { color: 'rgba(255, 255, 255, 0.06)' }
          },
          x: {
            ticks: { color: '#94A3B8', font: { size: 11, weight: 'bold' } },
            grid: { display: false }
          }
        }
      }
    });
  }

  renderRevisionLog(notes) {
    const listContainer = document.getElementById('revision-log-container');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (!notes || notes.length === 0) {
      listContainer.innerHTML = '<div class="text-muted text-center py-3">No study revision notes logged yet.</div>';
      return;
    }

    notes.forEach(item => {
      const el = document.createElement('div');
      el.className = 'revision-log-item';
      el.innerHTML = `
        <div class="log-item-header">
          <span>📅 ${item.date}</span>
          <span class="badge bg-secondary">${item.value_completed > 0 ? `${item.value_completed} ${item.unit || ''}` : item.status}</span>
        </div>
        <div class="log-item-note">${item.note || '<em>No specific study note recorded</em>'}</div>
      `;
      listContainer.appendChild(el);
    });
  }

  filterRevisionLog(query) {
    if (!query) {
      this.renderRevisionLog(this.revisionNotes);
      return;
    }
    const filtered = this.revisionNotes.filter(item => {
      const noteMatch = (item.note || '').toLowerCase().includes(query);
      const dateMatch = (item.date || '').includes(query);
      return noteMatch || dateMatch;
    });
    this.renderRevisionLog(filtered);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.AnalyticsModal = new AnalyticsModalStudio();
});
