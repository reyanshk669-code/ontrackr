/**
 * OnTrack - Multi-Timeframe Activity Analyser Studio
 * Analyzes habits on a Weekly, Monthly, and Yearly basis across every activity.
 * Offline-resilient with Chart.js visualization and deep-dive modal links.
 */

const TimeframeAnalyser = {
  currentPeriod: 'weekly',
  chartInstance: null,

  init() {
    this.bindEvents();
    // Render immediate local fallback synchronously so screen is never blank
    const localData = this.calculateLocalTimeframe(this.currentPeriod);
    this.renderUI(localData);
    this.loadAnalysis(this.currentPeriod);
  },

  bindEvents() {
    document.querySelectorAll('.timeframe-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const period = btn.getAttribute('data-period');
        if (period && period !== this.currentPeriod) {
          this.currentPeriod = period;
          document.querySelectorAll('.timeframe-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const badge = document.getElementById('analyser-period-badge');
          if (badge) {
            badge.textContent = period === 'weekly' ? 'Weekly View' : (period === 'monthly' ? 'Monthly View' : 'Yearly View');
          }

          this.loadAnalysis(period);
        }
      });
    });
  },

  async loadAnalysis(period) {
    try {
      const res = await fetch(`/api/analytics/timeframe?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          this.renderUI(data);
          return;
        }
      }
    } catch (err) {
      console.warn('Network timeframe fetch failed, using client-side calculation:', err);
    }

    // Client-side fallback calculation from HabitApp.habits
    const fallbackData = this.calculateLocalTimeframe(period);
    this.renderUI(fallbackData);
  },

  renderUI(data) {
    const kpis = data.kpis || {};
    const habitsBreakdown = data.habits_breakdown || [];
    const hasTasks = habitsBreakdown.length > 0;

    // Callout banner when 0 tasks entered
    const noTasksCallout = document.getElementById('analyser-no-tasks-callout');
    if (noTasksCallout) {
      noTasksCallout.style.display = hasTasks ? 'none' : 'flex';
    }

    // 1. Update Executive KPIs
    const elAdherence = document.getElementById('analyser-kpi-adherence');
    if (elAdherence) elAdherence.textContent = `${kpis.overall_adherence_rate || 0}%`;

    const elCompleted = document.getElementById('analyser-kpi-completed');
    if (elCompleted) elCompleted.textContent = `${kpis.total_completed_checks || 0} / ${kpis.total_scheduled_checks || 0}`;

    const elFocus = document.getElementById('analyser-kpi-focus');
    if (elFocus) elFocus.textContent = `${kpis.total_focus_minutes || 0} mins`;

    const elMvp = document.getElementById('analyser-kpi-mvp');
    if (elMvp) elMvp.textContent = kpis.mvp_activity || 'None';

    const elCount = document.getElementById('analyser-activities-count');
    if (elCount) elCount.textContent = `${habitsBreakdown.length} Tracked`;

    // 2. Render Chart (Always renders so the graph is always visible)
    this.renderChart(data.chart_data);

    // 3. Render Every Activity Breakdown Cards
    this.renderActivitiesList(habitsBreakdown);
  },

  renderChart(chartData) {
    const canvas = document.getElementById('timeframe-analytics-chart');
    if (!canvas || !window.Chart) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const ctx = canvas.getContext('2d');
    const safeData = chartData || {};
    const labels = (safeData.labels && safeData.labels.length)
      ? safeData.labels
      : (this.currentPeriod === 'weekly'
          ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
          : (this.currentPeriod === 'monthly' ? ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'] : ['Q1', 'Q2', 'Q3', 'Q4']));
    const completionRates = (safeData.completion_rates && safeData.completion_rates.length)
      ? safeData.completion_rates
      : labels.map(() => 0);
    const completedTasks = (safeData.completed_tasks && safeData.completed_tasks.length)
      ? safeData.completed_tasks
      : (safeData.focus_minutes || labels.map(() => 0));

    this.chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Consistency Rate %',
            data: completionRates,
            type: 'line',
            borderColor: '#7A9A78',
            backgroundColor: 'rgba(122, 154, 120, 0.16)',
            borderWidth: 2.8,
            tension: 0.35,
            fill: true,
            yAxisID: 'y',
            pointBackgroundColor: '#7A9A78',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Tasks Completed',
            data: completedTasks,
            type: 'bar',
            backgroundColor: 'rgba(122, 154, 120, 0.38)',
            hoverBackgroundColor: 'rgba(122, 154, 120, 0.75)',
            borderRadius: 6,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#202920',
            titleFont: { size: 12, weight: 'bold' },
            padding: 10,
            cornerRadius: 10,
            callbacks: {
              label: function(context) {
                if (context.dataset.type === 'line') {
                  return `Consistency: ${context.parsed.y}%`;
                }
                return `Completed: ${context.parsed.y} tasks`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 }, color: '#7B8679' }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            min: 0,
            max: 100,
            ticks: {
              callback: val => `${val}%`,
              font: { size: 9 },
              color: '#7A9A78',
              stepSize: 25
            },
            grid: { color: 'rgba(122, 154, 120, 0.14)' }
          },
          y1: {
            type: 'linear',
            display: false,
            position: 'right',
            grid: { drawOnChartArea: false },
            min: 0
          }
        }
      }
    });
  },

  renderActivitiesList(activities) {
    const container = document.getElementById('analyser-activities-list');
    if (!container) return;

    if (!activities.length) {
      container.innerHTML = `
        <div style="text-align:center; padding:22px 16px; background:var(--bg-secondary, #F7F5EE); border-radius:18px; border:1.5px dashed var(--border-color, rgba(122,154,120,0.3));">
          <span style="font-size:1.8rem; display:block; margin-bottom:6px;">🌱</span>
          <div style="font-weight:800; font-size:0.88rem; color:var(--text-primary); margin-bottom:3px;">No Tasks Entered Yet</div>
          <p style="font-size:0.75rem; color:var(--text-muted); max-width:280px; margin:0 auto 12px auto;">Enter your daily tasks to track your daily progress and consistency curve across Weekly, Monthly, and Yearly timeframes.</p>
          <button type="button" class="btn btn-sm btn-primary rounded-pill px-3 py-1 font-weight-bold" data-bs-toggle="modal" data-bs-target="#modal-add-habit" style="font-weight:700;">
            + Enter Tasks
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = activities.map(act => {
      const color = act.hex_color || '#7C5CFC';
      return `
        <div class="analyser-activity-card">
          <div class="analyser-activity-header">
            <div class="analyser-activity-title">
              <span style="width:10px; height:10px; border-radius:50%; background:${color}; display:inline-block;"></span>
              <span>${act.name}</span>
            </div>
            <span class="analyser-grade-tag ${act.grade_badge || 'primary'}">${act.grade || 'Consistent'}</span>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-secondary); margin-bottom:6px;">
            <span>${act.category} • Target: ${act.target_value} ${act.unit || ''}</span>
            <span style="font-weight:700;">${act.completed_days} / ${act.scheduled_days} Days (${act.adherence_rate}%)</span>
          </div>

          <!-- Segmented Adherence Bar -->
          <div style="background:var(--bg-secondary); height:7px; border-radius:999px; overflow:hidden; margin-bottom:8px;">
            <div style="width:${Math.min(100, act.adherence_rate)}%; height:100%; background:${color}; border-radius:999px;"></div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.73rem; color:var(--text-muted);">
            <div>
              <span title="Running Streak">🔥 ${act.current_streak}d</span> &nbsp;•&nbsp; 
              <span title="Best Streak">🏆 Best: ${act.best_streak}d</span> &nbsp;•&nbsp; 
              <span title="Habit Strength Score">⚡ Strength: ${Math.round(act.habit_strength || 0)}%</span>
            </div>
            <button class="btn btn-sm btn-link p-0 text-decoration-none" style="font-size:0.73rem; font-weight:800; color:${color};" onclick="AnalyticsModal.open(${act.id})">
              Deep Dive ➔
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.AdvancedFeatures && window.AdvancedFeatures.observeNewElements) {
      window.AdvancedFeatures.observeNewElements(container);
    }
  },

  calculateLocalTimeframe(period) {
    const habits = (window.AppState && Array.isArray(window.AppState.habits)) ? window.AppState.habits : [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const today = new Date();

    if (habits.length === 0) {
      const emptyLabels = period === 'weekly' 
        ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] 
        : (period === 'monthly' ? ['Week 1', 'Week 2', 'Week 3', 'Week 4'] : ['Q1', 'Q2', 'Q3', 'Q4']);
      return {
        period: period,
        kpis: {
          overall_adherence_rate: 0,
          total_completed_checks: 0,
          total_scheduled_checks: 0,
          total_focus_minutes: 0,
          mvp_activity: 'None'
        },
        chart_data: {
          labels: emptyLabels,
          completion_rates: emptyLabels.map(() => 0),
          completed_tasks: emptyLabels.map(() => 0),
          focus_minutes: emptyLabels.map(() => 0)
        },
        habits_breakdown: []
      };
    }

    // Build timeline date array
    const daysCount = period === 'weekly' ? 7 : (period === 'monthly' ? 30 : 365);
    const dateList = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dateList.push({
        date: d.toISOString().split('T')[0],
        day_name: dayNames[d.getDay()],
        day_num: d.getDate(),
        month_name: monthNames[d.getMonth()]
      });
    }

    // Calculate day-after-day stats for each date
    let totalScheduledAll = 0;
    let totalCompletedAll = 0;
    let totalFocusMinsAll = 0;

    const dailyRates = [];
    const dailyCompleted = [];
    const dailyLabels = [];

    if (period === 'weekly') {
      dateList.forEach(d => {
        dailyLabels.push(d.day_name);
        let sched = habits.length;
        let comp = 0;
        let focus = 0;

        habits.forEach(h => {
          const hist = (h.history && h.history[d.date]) || (Array.isArray(h.seven_days) && h.seven_days.find(s => s.checkin_date === d.date));
          if (hist && (hist.status === 'COMPLETED' || hist.status === 'MICRO_DOSE')) {
            comp += 1;
          }
          if (hist && hist.value_completed && h.habit_type === 'MEASURABLE') {
            focus += parseFloat(hist.value_completed);
          }
        });

        totalScheduledAll += sched;
        totalCompletedAll += comp;
        totalFocusMinsAll += focus;

        const rate = sched > 0 ? Math.round((comp / sched) * 100) : 0;
        dailyRates.push(rate);
        dailyCompleted.push(comp);
      });
    } else if (period === 'monthly') {
      // 30 days grouped into 6 5-day intervals
      const intervalSize = 5;
      for (let i = 0; i < dateList.length; i += intervalSize) {
        const slice = dateList.slice(i, i + intervalSize);
        const label = `${slice[0].day_num} ${slice[0].month_name}`;
        dailyLabels.push(label);

        let sched = slice.length * habits.length;
        let comp = 0;
        let focus = 0;

        slice.forEach(d => {
          habits.forEach(h => {
            const hist = (h.history && h.history[d.date]) || (Array.isArray(h.seven_days) && h.seven_days.find(s => s.checkin_date === d.date));
            if (hist && (hist.status === 'COMPLETED' || hist.status === 'MICRO_DOSE')) {
              comp += 1;
            }
            if (hist && hist.value_completed && h.habit_type === 'MEASURABLE') {
              focus += parseFloat(hist.value_completed);
            }
          });
        });

        totalScheduledAll += sched;
        totalCompletedAll += comp;
        totalFocusMinsAll += focus;

        const rate = sched > 0 ? Math.round((comp / sched) * 100) : 0;
        dailyRates.push(rate);
        dailyCompleted.push(comp);
      }
    } else {
      // Yearly: 12 months
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.forEach(m => {
        dailyLabels.push(m);
        dailyRates.push(0);
        dailyCompleted.push(0);
      });
    }

    // Breakdown for every individual habit
    const breakdown = habits.map(h => {
      let completedInPeriod = 0;
      let focusInPeriod = 0;

      dateList.forEach(d => {
        const hist = (h.history && h.history[d.date]) || (Array.isArray(h.seven_days) && h.seven_days.find(s => s.checkin_date === d.date));
        if (hist && (hist.status === 'COMPLETED' || hist.status === 'MICRO_DOSE')) {
          completedInPeriod += 1;
        }
        if (hist && hist.value_completed && h.habit_type === 'MEASURABLE') {
          focusInPeriod += parseFloat(hist.value_completed);
        }
      });

      const schedDays = dateList.length;
      const adherence = schedDays > 0 ? Math.round((completedInPeriod / schedDays) * 100) : 0;
      let grade = 'Developing';
      let badge = 'primary';
      if (adherence >= 80) { grade = 'A Master'; badge = 'success'; }
      else if (adherence >= 50) { grade = 'B Solid'; badge = 'info'; }
      else if (adherence < 30) { grade = 'At Risk'; badge = 'danger'; }

      return {
        id: h.id,
        name: h.name,
        category: h.category,
        hex_color: h.hex_color || '#7C5CFC',
        target_value: h.target_value,
        unit: h.unit || '',
        scheduled_days: schedDays,
        completed_days: completedInPeriod,
        adherence_rate: adherence,
        current_streak: h.metrics?.current_streak || 0,
        best_streak: h.metrics?.best_streak || (h.metrics?.current_streak || 0),
        habit_strength: Math.round(h.metrics?.habit_strength || 0),
        grade: grade,
        grade_badge: badge
      };
    });

    breakdown.sort((a, b) => b.completed_days - a.completed_days);
    const overallAdherence = totalScheduledAll > 0 ? Math.round((totalCompletedAll / totalScheduledAll) * 100) : 0;
    const mvpHabit = (breakdown.length > 0 && breakdown[0].completed_days > 0) ? breakdown[0].name : 'None';

    return {
      period: period,
      kpis: {
        overall_adherence_rate: overallAdherence,
        total_completed_checks: totalCompletedAll,
        total_scheduled_checks: totalScheduledAll,
        total_focus_minutes: Math.round(totalFocusMinsAll),
        mvp_activity: mvpHabit
      },
      chart_data: {
        labels: dailyLabels,
        completion_rates: dailyRates,
        completed_tasks: dailyCompleted,
        focus_minutes: dailyCompleted
      },
      habits_breakdown: breakdown
    };
  }
};

window.TimeframeAnalyser = TimeframeAnalyser;
document.addEventListener('DOMContentLoaded', () => {
  TimeframeAnalyser.init();
});
