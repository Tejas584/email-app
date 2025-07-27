let sessionId = null;
let lastLimit = 0;
let lastBatchCount = 0;
let isSending = false;

// Local Storage Log Management
const LOG_STORAGE_KEY = 'emailLogs';

// Initialize logs from localStorage
let emailLogs = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');

// Save logs to localStorage
function saveLogsToStorage() {
  localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(emailLogs));
}

// Add a new log entry
function addLogEntry(sessionId, logData, timestamp = new Date().toISOString()) {
  const logEntry = {
    sessionId,
    timestamp,
    data: logData,
    total: logData.total || 0,
    sent: logData.sent || 0,
    failed: logData.failed || 0,
    pending: logData.pending || 0
  };
  
  // Check if session already exists, update it
  const existingIndex = emailLogs.findIndex(log => log.sessionId === sessionId);
  if (existingIndex !== -1) {
    emailLogs[existingIndex] = logEntry;
  } else {
    emailLogs.unshift(logEntry); // Add to beginning
  }
  
  saveLogsToStorage();
  updateLogDisplay();
}

// Delete a specific log
function deleteLog(sessionId) {
  emailLogs = emailLogs.filter(log => log.sessionId !== sessionId);
  saveLogsToStorage();
  updateLogDisplay();
  
  // If current session is deleted, clear sessionId
  if (sessionId === window.currentSessionId) {
    window.currentSessionId = null;
  }
}

// Delete all logs
function deleteAllLogs() {
  const warningMessage = `⚠️ DELETE ALL LOGS WARNING ⚠️

🚨 PERMANENT ACTION: All logs will be deleted and cannot be recovered!

📋 What will be deleted:
• ${emailLogs.length} email campaign logs
• All session data with timestamps
• Complete email sending history
• All statistics and results

💡 CRITICAL RECOMMENDATION: Download all important logs first!

❓ Do you want to delete ALL ${emailLogs.length} logs permanently?`;

  const confirmed = confirm(warningMessage);
  
  if (confirmed) {
    emailLogs = [];
    saveLogsToStorage();
    updateLogDisplay();
    window.currentSessionId = null;
    showError(`✅ All ${emailLogs.length} logs deleted successfully.`);
    
    // Close popup
    const popup = document.getElementById('custom-popup');
    if (popup) popup.remove();
  } else {
    showError('Delete all operation cancelled.');
  }
}

// Update log display in UI
function updateLogDisplay() {
  const logCount = emailLogs.length;
  const logBtn = document.getElementById('Download-log');
  const deleteBtn = document.getElementById('delete-log');
  
  if (logBtn) {
    logBtn.innerHTML = `<i class="fa-solid fa-download"></i> Download Log (${logCount})`;
    logBtn.disabled = logCount === 0;
  }
  
  if (deleteBtn) {
    deleteBtn.innerHTML = `<i class="fa-solid fa-trash"></i> Delete Log (${logCount})`;
    deleteBtn.disabled = logCount === 0;
  }
}

// File upload handler
const fileInput = document.getElementById('file');
if (fileInput) {
  fileInput.addEventListener('change', function(e) {
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    fetch('/recipients', {
      method: 'POST',
      body: formData
    })
    .then(async res => {
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) {
        showError(data.error || 'File upload failed.');
        return;
      }
      if (data.total !== undefined) {
        // Reset all counters for new session
        document.getElementById('total').textContent = data.total;
        document.getElementById('queue').textContent = 0;
        document.getElementById('total-sending').textContent = 0;
        document.getElementById('limit').textContent = 0;
        document.getElementById('pending').textContent = data.total;
        document.getElementById('sent').textContent = 0;
        document.getElementById('failed').textContent = 0;
        window.validRecipients = data.validRecipients;
        sessionId = data.sessionId;
        lastLimit = 0;
        lastBatchCount = 0;
        isSending = false;
        startStatusPolling();
        showError('');
      } else if (data.error) {
        showError(data.error);
      }
    })
    .catch(err => showError('Upload failed: ' + (err.message || err)));
  });
}

// SMTP credentials save/load in localStorage
const smtpFields = [
  { id: 'smtp-host', key: 'smtpHost' },
  { id: 'smtp-port', key: 'smtpPort' },
  { id: 'smtp-user', key: 'smtpUser' },
  { id: 'smtp-pass', key: 'smtpPass' }
];

function loadSmtpCreds() {
  smtpFields.forEach(f => {
    const el = document.getElementById(f.id);
    if (el && localStorage.getItem(f.key)) {
      el.value = localStorage.getItem(f.key);
    }
  });
}
function saveSmtpCreds() {
  smtpFields.forEach(f => {
    const el = document.getElementById(f.id);
    if (el) {
      localStorage.setItem(f.key, el.value);
    }
  });
}
window.addEventListener('DOMContentLoaded', loadSmtpCreds);

// Email form AJAX submit
const emailForm = document.getElementById('email-form');
if (emailForm) {
  emailForm.addEventListener('submit', function(e) {
    e.preventDefault();
    saveSmtpCreds();
    const formData = new FormData(emailForm);
    // Only append sessionId if bulk mode is selected
    if (bulkRadio && bulkRadio.checked && sessionId) formData.append('sessionId', sessionId);
    lastLimit = parseInt(formData.get('limit')) || 0;
    isSending = true;
    fetch('/send-email', {
      method: 'POST',
      body: new URLSearchParams([...formData])
    })
    .then(async res => {
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) {
        showError(data.error || 'Send failed.');
        return;
      }
      if (data.status === 'enqueued') {
        showError(''); // clear errors
        lastBatchCount = data.batchCount;
        // Update UI immediately
        document.getElementById('total-sending').textContent = lastLimit;
        document.getElementById('limit').textContent = lastBatchCount;
        startStatusPolling();
      } else if (data.error) {
        showError(data.error);
      }
    })
    .catch(err => showError('Send failed: ' + (err.message || err)));
  });
}

// Live status polling
let statusInterval = null;
let fastPollTimeout = null;
function startStatusPolling() {
  if (statusInterval) clearInterval(statusInterval);
  if (fastPollTimeout) clearTimeout(fastPollTimeout);
  if (!sessionId) return;
  let pollInterval = 2000;
  // After sending, poll every 1s for 10s, then revert to 2s
  if (isSending) {
    pollInterval = 1000;
    fastPollTimeout = setTimeout(() => {
      if (statusInterval) clearInterval(statusInterval);
      statusInterval = setInterval(pollStatus, 2000);
    }, 10000);
  }
  statusInterval = setInterval(pollStatus, pollInterval);
}

function pollStatus() {
  fetch(`/status?sessionId=${sessionId}`)
    .then(async res => {
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) {
        showError(data.error || 'Status fetch failed.');
        return;
      }
      if (data.total !== undefined) {
        document.getElementById('total').textContent = data.total;
        // Queue: emails in queue (not yet sent/failed)
        const queueCount = Math.max(0, (data.sentIndex || 0) - (data.sent || 0) - (data.failed || 0));
        document.getElementById('queue').textContent = queueCount;
        // Limit: batch size set by user
        document.getElementById('total-sending').textContent = lastLimit;
        // Live sending: current batch being processed
        const liveSending = isSending ? Math.min(lastBatchCount, (data.sent || 0) + (data.failed || 0)) : 0;
        document.getElementById('limit').textContent = liveSending;
        // Pending: remaining emails to send
        document.getElementById('pending').textContent = data.pending;
        // Total Sent: always use backend's sent value
        document.getElementById('sent').textContent = data.sent || 0;
        // Total Failed: always use backend's failed value
        document.getElementById('failed').textContent = data.failed || 0;
        
        // Save log data to localStorage
        addLogEntry(sessionId, data);
        window.currentSessionId = sessionId;
        
        // If current batch is complete, stop live sending indicator
        if ((data.sent + data.failed) >= (data.sentIndex || 0)) {
          isSending = false;
          document.getElementById('limit').textContent = 0;
        }
        if (data.lastError) {
          showError(data.lastError);
        } else {
          showError('');
        }
      }
    })
    .catch(err => showError('Status fetch failed: ' + (err.message || err)));
}

// Error box
function showError(msg) {
  const errBox = document.getElementById('errors');
  if (errBox) errBox.textContent = msg;
}

// Preview popup
const previewBtn = document.getElementById('preview-html');
if (previewBtn) {
  previewBtn.addEventListener('click', function() {
    const msg = document.getElementById('message').value;
    const isHtml = document.getElementById('html').checked;
    if (isHtml) {
      showPopup('Preview', msg);
    } else {
      showPopup('Preview', `<pre style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(msg)}</pre>`);
    }
  });
}

// Helper to escape HTML
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showPopup(title, html) {
  // Remove any existing popup
  let oldPopup = document.getElementById('custom-popup');
  if (oldPopup) oldPopup.remove();

  // Create popup
  const popup = document.createElement('div');
  popup.id = 'custom-popup';
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.background = '#fff';
  popup.style.zIndex = 10000;
  popup.style.border = '1px solid #333';
  popup.style.boxShadow = '0 2px 10px #0002';
  popup.style.boxSizing = 'border-box';
  popup.style.overflowY = 'auto';
  popup.style.maxHeight = '90vh';
  popup.style.minWidth = '280px';
  popup.style.width = '90vw';
  popup.style.maxWidth = title === 'Preview' ? '900px' : '95vw';
  popup.style.padding = '2.5em 3em 1em 1em'; // More right padding for close button

  // Responsive: adjust padding and minWidth for small screens
  if (window.innerWidth < 400) {
    popup.style.padding = '2.5em 2em 0.5em 0.5em';
    popup.style.minWidth = '0';
  }

  // Close button (top right)
  const closeBtn = document.createElement('button');
  closeBtn.id = 'close-popup';
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '10px';
  closeBtn.style.right = '10px';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.fontSize = '1.5em';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.color = '#333';
  closeBtn.onclick = () => popup.remove();
  popup.appendChild(closeBtn);

  // Title
  const h3 = document.createElement('h3');
  h3.textContent = title;
  h3.style.marginTop = '0';
  h3.style.marginRight = '0';
  // h3.style.textAlign = 'center'; // REMOVE this line!
  popup.appendChild(h3);

  // Content
  const contentDiv = document.createElement('div');
  contentDiv.id = 'popup-content';

  if (title === 'Preview') {
    contentDiv.style.maxWidth = '900px';
    contentDiv.style.margin = '0 auto';
    contentDiv.style.background = '#f9f9f9';
    contentDiv.style.padding = '1em';
    contentDiv.style.borderRadius = '8px';
    contentDiv.style.boxShadow = '0 1px 4px #0001';
    contentDiv.style.overflow = 'auto';
    contentDiv.style.display = 'block';
    contentDiv.innerHTML = html;
  } else {
    contentDiv.innerHTML = html;
  }

  popup.appendChild(contentDiv);
  document.body.appendChild(popup);
  popup.style.display = 'block';
}

// Test/Bulk radio logic
const testRadio = document.getElementById('test');
const bulkRadio = document.getElementById('bulk');
const fileInputSection = document.getElementById('file');
const testRecpTextarea = document.getElementById('test-recp');

function updateModeUI() {
  if (testRadio && testRadio.checked) {
    if (fileInput) fileInput.disabled = true;
    if (testRecpTextarea) testRecpTextarea.disabled = false;
  } else if (bulkRadio && bulkRadio.checked) {
    if (fileInput) fileInput.disabled = false;
    if (testRecpTextarea) testRecpTextarea.disabled = true;
  }
}
if (testRadio) testRadio.addEventListener('change', updateModeUI);
if (bulkRadio) bulkRadio.addEventListener('change', updateModeUI);
window.addEventListener('DOMContentLoaded', updateModeUI);

// Info popup
const infoBtn = document.getElementById('info');
if (infoBtn) {
  infoBtn.addEventListener('click', function() {
    showPopup('Info', `
      <b>Bulk Email Sender - How to Use</b><br><br>
      <ul>
        <li><b>1. Upload Recipients:</b> Upload a file (.csv, .txt, .xlsx, .xls, .json) containing email addresses. Only valid emails are counted. The total is shown in the status panel. <b>If you select Test mode, file upload is disabled.</b></li>
        <li><b>2. Configure SMTP:</b> Enter your SMTP server details (host, port, user, password). This is required to send emails.</li>
        <li><b>3. Email Configuration:</b>
          <ul>
            <li><b>Test or Bulk:</b> Choose <b>Test</b> to send to test recipients (entered below), or <b>Bulk</b> to use the uploaded file. <b>Switching between Test and Bulk is allowed at any time. Bulk progress is preserved if you pause to send a test email.</b></li>
            <li><b>Test Recipients:</b> (for Test mode) Enter one or more email addresses, separated by commas. <b>This field is disabled in Bulk mode.</b></li>
            <li><b>Limit:</b> Set how many emails to send in one batch. For example, if you upload 100 emails and set limit to 25, only the first 25 will be sent. Next batch will start from the next email.</li>
            <li><b>From Name/Email:</b> Set the sender's name and email address.</li>
            <li><b>Subject:</b> Enter the email subject.</li>
            <li><b>Message Type:</b> Choose <b>Plain</b> for plain text or <b>HTML</b> for HTML emails.</li>
            <li><b>Message/HTML:</b> Enter your email content. Use the Preview button to see how it will look.</li>
          </ul>
        </li>
        <li><b>4. Send Email:</b> Click <b>Send Email</b> to start sending. The system will send emails in batches as per your limit. No duplicate emails will be sent. <b>You can pause bulk sending, send a test email, and then resume bulk sending from where you left off.</b></li>
        <li><b>5. Live Status:</b> The status panel shows:
          <ul>
            <li><b>Total:</b> Total valid emails uploaded</li>
            <li><b>Queue:</b> Emails waiting to be sent</li>
            <li><b>Limit:</b> The batch size you set</li>
            <li><b>Live Sending:</b> Number of emails being sent in the current batch</li>
            <li><b>Pending:</b> Emails left to send</li>
            <li><b>Total Sent:</b> Emails sent successfully</li>
            <li><b>Total Failed:</b> Emails that failed to send</li>
          </ul>
        </li>
        <li><b>6. Download Log:</b> 
          <ul>
            <li><b>Browser Storage:</b> All email logs are automatically saved in your browser's localStorage</li>
            <li><b>Persistent Logs:</b> Logs remain available even after closing browser or refreshing page</li>
            <li><b>Log Selection:</b> Click "Download Log" to see all available logs and choose which to download</li>
            <li><b>Server Fallback:</b> If server logs exist, they're downloaded; otherwise, CSV is created from browser data</li>
            <li><b>Log Count:</b> Button shows number of available logs (e.g., "Download Log (5)")</li>
          </ul>
        </li>
        <li><b>7. Delete Log:</b>
          <ul>
            <li><b>⚠️ Warning System:</b> Delete operations show clear warnings before proceeding</li>
            <li><b>Individual Delete:</b> Delete specific session logs with confirmation</li>
            <li><b>Delete All:</b> Clear all stored logs at once with critical warning</li>
            <li><b>Permanent Action:</b> Deleted logs cannot be recovered - download important data first!</li>
            <li><b>Log Count:</b> Button shows number of available logs (e.g., "Delete Log (5)")</li>
          </ul>
        </li>
        <li><b>8. Error Handling:</b> All errors (upload, send, status, log) are shown in the error box below the status panel. No page reloads are needed.</li>
        <li><b>9. Info & Preview:</b> Use the Info button (this popup) for help, and the Preview button to see your message before sending.</li>
      </ul>
      <b>🆕 New Features:</b><br>
      - <b>Persistent Log Storage:</b> All email logs are automatically saved in browser localStorage<br>
      - <b>Cross-Session Logs:</b> Logs persist across browser sessions, page refreshes, and browser restarts<br>
      - <b>Smart Log Management:</b> Download specific logs or delete individual/all logs as needed<br>
      - <b>Enhanced Safety:</b> Delete operations include clear warnings and confirmation dialogs<br>
      - <b>Unlimited Storage:</b> No limit on number of logs stored (limited only by browser storage capacity)<br><br>
      <b>Tips:</b><br>
      - Use batching (limit) to avoid SMTP rate limits.<br>
      - Always check the status and error box for feedback.<br>
      - <b>Download important logs before deleting them!</b><br>
      - For best results, use a reliable SMTP server.<br>
      - Logs are stored locally in your browser - they won't be lost when you close the page.<br><br><br>
    `);
  });
}

// Log download
const logBtn = document.getElementById('Download-log');
if (logBtn) {
  logBtn.addEventListener('click', function() {
    if (emailLogs.length === 0) {
      showError('No logs available in browser storage.');
      return;
    }
    
    // Show log selection popup
    showLogSelectionPopup();
  });
}

// Show log selection popup
function showLogSelectionPopup() {
  if (emailLogs.length === 0) {
    showError('No logs available.');
    return;
  }
  
  let popupContent = '<div style="margin-bottom: 15px;"><b>Select a log to download:</b></div>';
  popupContent += '<div style="max-height: 300px; overflow-y: auto;">';
  
  emailLogs.forEach((log, index) => {
    const date = new Date(log.timestamp).toLocaleString();
    const status = log.pending > 0 ? 'In Progress' : 'Completed';
    const statusColor = log.pending > 0 ? 'orange' : 'green';
    
    popupContent += `
      <div style="border: 1px solid #ddd; margin: 5px 0; padding: 10px; border-radius: 5px; cursor: pointer;" 
           onclick="downloadSelectedLog('${log.sessionId}')">
        <div style="font-weight: bold;">Session: ${log.sessionId}</div>
        <div style="font-size: 0.9em; color: #666;">Date: ${date}</div>
        <div style="font-size: 0.9em;">
          Total: ${log.total} | Sent: ${log.sent} | Failed: ${log.failed} | Pending: ${log.pending}
        </div>
        <div style="color: ${statusColor}; font-weight: bold;">Status: ${status}</div>
      </div>
    `;
  });
  
  popupContent += '</div>';
  
  showPopup('Download Log', popupContent);
}

// Download selected log
function downloadSelectedLog(sessionId) {
  // Try to get detailed log from server first
  fetch(`/log-download?sessionId=${sessionId}`)
    .then(async res => {
      if (res.ok) {
        // Server log exists, download it
        res.blob().then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `emaillog-${sessionId}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
          showError('');
          
          // Close popup
          const popup = document.getElementById('custom-popup');
          if (popup) popup.remove();
        });
      } else {
        // Server log doesn't exist, create from localStorage data
        const log = emailLogs.find(l => l.sessionId === sessionId);
        if (log) {
          downloadLogFromStorage(log);
        } else {
          showError('Log not found.');
        }
      }
    })
    .catch(err => {
      // Fallback to localStorage data
      const log = emailLogs.find(l => l.sessionId === sessionId);
      if (log) {
        downloadLogFromStorage(log);
      } else {
        showError('Log download failed: ' + (err.message || err));
      }
    });
}

// Download log from localStorage data
function downloadLogFromStorage(log) {
  const csvContent = [
    'Session ID,Timestamp,Total,Sent,Failed,Pending,Status',
    `${log.sessionId},${log.timestamp},${log.total},${log.sent},${log.failed},${log.pending},${log.pending > 0 ? 'In Progress' : 'Completed'}`
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `emaillog-${log.sessionId}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
  showError('');
  
  // Close popup
  const popup = document.getElementById('custom-popup');
  if (popup) popup.remove();
}

// Delete log functionality
const deleteBtn = document.getElementById('delete-log');
if (deleteBtn) {
  deleteBtn.addEventListener('click', function() {
    if (emailLogs.length === 0) {
      showError('No logs available to delete.');
      return;
    }
    
    // Show warning alert first
    showDeleteWarningAlert();
  });
}

// Show delete warning alert
function showDeleteWarningAlert() {
  const warningMessage = `⚠️ DELETE LOG WARNING ⚠️

🚨 PERMANENT ACTION: Deleted logs cannot be recovered!

📋 What will be deleted:
• All email campaign logs stored in your browser
• Session data with timestamps and statistics
• Email sending history and results

💡 RECOMMENDATION: Download important logs first using "Download Log" button

❓ Do you want to proceed with deleting ${emailLogs.length} log(s)?`;

  const confirmed = confirm(warningMessage);
  
  if (confirmed) {
    showDeleteLogPopup();
  } else {
    showError('Delete operation cancelled.');
  }
}

// Show delete log popup
function showDeleteLogPopup() {
  let popupContent = '<div style="margin-bottom: 15px;"><b>Select logs to delete:</b></div>';
  popupContent += '<div style="max-height: 300px; overflow-y: auto;">';
  
  emailLogs.forEach((log, index) => {
    const date = new Date(log.timestamp).toLocaleString();
    const status = log.pending > 0 ? 'In Progress' : 'Completed';
    const statusColor = log.pending > 0 ? 'orange' : 'green';
    
    popupContent += `
      <div style="border: 1px solid #ddd; margin: 5px 0; padding: 10px; border-radius: 5px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="flex: 1;">
            <div style="font-weight: bold;">Session: ${log.sessionId}</div>
            <div style="font-size: 0.9em; color: #666;">Date: ${date}</div>
            <div style="font-size: 0.9em;">
              Total: ${log.total} | Sent: ${log.sent} | Failed: ${log.failed} | Pending: ${log.pending}
            </div>
            <div style="color: ${statusColor}; font-weight: bold;">Status: ${status}</div>
          </div>
          <button onclick="deleteSelectedLog('${log.sessionId}')" 
                  style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-left: 10px;">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `;
  });
  
  popupContent += '</div>';
  popupContent += '<div style="margin-top: 15px; text-align: center;">';
  popupContent += '<button onclick="deleteAllLogs()" style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">';
  popupContent += '<i class="fa-solid fa-trash"></i> Delete All Logs';
  popupContent += '</button>';
  popupContent += '</div>';
  
  showPopup('Delete Logs', popupContent);
}

// Delete selected log
function deleteSelectedLog(sessionId) {
  const log = emailLogs.find(l => l.sessionId === sessionId);
  const date = log ? new Date(log.timestamp).toLocaleString() : '';
  
  const warningMessage = `⚠️ DELETE LOG WARNING ⚠️

🚨 PERMANENT ACTION: This log cannot be recovered!

📋 Log Details:
• Session ID: ${sessionId}
• Date: ${date}
• Total Emails: ${log ? log.total : 0}
• Sent: ${log ? log.sent : 0}
• Failed: ${log ? log.failed : 0}

💡 RECOMMENDATION: Download this log first if you need the data

❓ Do you want to delete this log permanently?`;

  const confirmed = confirm(warningMessage);
  
  if (confirmed) {
    deleteLog(sessionId);
    showError(`✅ Log for session ${sessionId} deleted successfully.`);
    
    // Close popup
    const popup = document.getElementById('custom-popup');
    if (popup) popup.remove();
  } else {
    showError('Delete operation cancelled.');
  }
}

// SMTP password eye toggle
window.addEventListener('DOMContentLoaded', function() {
  const passInput = document.getElementById('smtp-pass');
  const toggleBtn = document.getElementById('toggle-smtp-pass');
  const eyeIcon = document.getElementById('smtp-pass-eye');
  if (passInput && toggleBtn && eyeIcon) {
    toggleBtn.addEventListener('click', function() {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
      } else {
        passInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
      }
    });
  }
  
  // Initialize log display on page load
  updateLogDisplay();
});