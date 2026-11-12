/**
 * HabitWall - Backup, Restore & Data Ownership Engine
 * JSON & CSV Export/Import and Sample Data Seeding
 */

document.addEventListener('DOMContentLoaded', () => {
  const btnExportJson = document.getElementById('btn-backup-export-json');
  const btnExportCsv = document.getElementById('btn-backup-export-csv');
  const inputImportJson = document.getElementById('input-backup-import-json');
  const btnTriggerImport = document.getElementById('btn-backup-trigger-import');
  const btnSeedDemo = document.getElementById('btn-seed-sample-data');
  const btnResetDb = document.getElementById('btn-reset-database');

  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      window.location.href = '/api/backup/export-json';
    });
  }

  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      window.location.href = '/api/backup/export-csv';
    });
  }

  if (btnTriggerImport && inputImportJson) {
    btnTriggerImport.addEventListener('click', () => {
      inputImportJson.click();
    });

    inputImportJson.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const confirmRestore = confirm('Restoring a backup will replace your current habits and check-ins. Continue?');
      if (!confirmRestore) {
        inputImportJson.value = '';
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/backup/import-json', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.status === 'success') {
          alert(data.message);
          window.location.reload();
        } else {
          alert(data.message || 'Error restoring backup');
        }
      } catch (err) {
        console.error('Import failed:', err);
        alert('Failed to connect to server to restore backup.');
      } finally {
        inputImportJson.value = '';
      }
    });
  }

  if (btnSeedDemo) {
    btnSeedDemo.addEventListener('click', async () => {
      const confirmSeed = confirm('Load 5 realistic sample student habits with 30 days of check-in history and upcoming exams?');
      if (!confirmSeed) return;

      try {
        const res = await fetch('/api/backup/seed-demo', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success' || data.status === 'skipped') {
          alert(data.message);
          window.location.reload();
        } else {
          alert(data.message || 'Error loading demo data');
        }
      } catch (err) {
        console.error('Seed failed:', err);
      }
    });
  }

  if (btnResetDb) {
    btnResetDb.addEventListener('click', async () => {
      const confirmWipe = confirm('Are you sure you want to completely erase all habits, streaks, and check-ins? This cannot be undone.');
      if (!confirmWipe) return;

      try {
        const res = await fetch('/api/backup/reset', { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
          alert(data.message);
          window.location.reload();
        }
      } catch (err) {
        console.error('Reset failed:', err);
      }
    });
  }
});
