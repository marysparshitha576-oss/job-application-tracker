const $ = (id) => document.getElementById(id);
const dialog = $("applicationDialog");
const form = $("applicationForm");
let applications = [];
let toastTimer;

const statusLabels = {
  Applied: "Applied", Assessment: "Assessment", Interview: "Interview",
  Offer: "Offer", Rejected: "Rejected", Withdrawn: "Withdrawn"
};

function dateOnly(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function prettyDate(value, options = { day: "numeric", month: "short", year: "numeric" }) {
  if (!value) return "Not set";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Not set" : d.toLocaleDateString(undefined, options);
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}
async function api(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}
async function loadApplications() {
  try {
    const params = new URLSearchParams();
    if ($("statusFilter").value !== "All") params.set("status", $("statusFilter").value);
    if ($("searchInput").value.trim()) params.set("search", $("searchInput").value.trim());
    applications = await api(`/api/applications?${params.toString()}`);
    renderTable();
    await loadStatsAndReminders();
  } catch (error) {
    $("applicationsTable").innerHTML = `<tr><td colspan="4" class="empty-state">${escapeHtml(error.message)}<br>Check that the server and MongoDB are running.</td></tr>`;
  }
}
async function loadStatsAndReminders() {
  // Fetch all records for accurate dashboard counts even when the table is filtered.
  const all = await api("/api/applications");
  $("totalCount").textContent = all.length;
  $("progressCount").textContent = all.filter(a => ["Applied", "Assessment", "Interview"].includes(a.status)).length;
  $("interviewCount").textContent = all.filter(a => a.status === "Interview" || a.interviewDate).length;
  $("offerCount").textContent = all.filter(a => a.status === "Offer").length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const future = new Date(today);
  future.setDate(future.getDate() + 30);
  const reminders = [];
  all.forEach(app => {
    [["Interview", app.interviewDate], ["Follow-up", app.followUpDate]].forEach(([type, value]) => {
      if (!value) return;
      const d = new Date(value);
      d.setHours(0, 0, 0, 0);
      if (d >= today && d <= future) reminders.push({ type, date: d, company: app.company, title: app.jobTitle, id: app._id });
    });
  });
  reminders.sort((a, b) => a.date - b.date);
  $("remindersList").innerHTML = reminders.length ? reminders.slice(0, 6).map(r => `
    <div class="reminder-item">
      <div class="reminder-date"><strong>${r.date.getDate()}</strong><span>${r.date.toLocaleDateString(undefined, { month: "short" })}</span></div>
      <div class="reminder-info"><strong>${escapeHtml(r.company)}</strong><p>${escapeHtml(r.title)}</p><span class="reminder-type">${r.type}</span></div>
      <button class="icon-btn" title="Edit application" data-edit="${r.id}">↗</button>
    </div>`).join("") : `<p class="muted">Nothing scheduled in the next 30 days. Add an interview or follow-up date to see it here.</p>`;
}
function renderTable() {
  const rows = applications.slice(0, 8);
  $("applicationsTable").innerHTML = rows.length ? rows.map(a => `
    <tr>
      <td><div class="company-name">${escapeHtml(a.company)}</div><div class="job-title">${escapeHtml(a.jobTitle)}</div></td>
      <td>${prettyDate(a.appliedDate, { day: "numeric", month: "short" })}</td>
      <td><span class="status-badge status-${escapeHtml(a.status)}">${escapeHtml(statusLabels[a.status] || a.status)}</span></td>
      <td><div class="row-actions"><button class="icon-btn" title="Edit" data-edit="${a._id}">✎</button><button class="icon-btn" title="Delete" data-delete="${a._id}">⌫</button></div></td>
    </tr>`).join("") : `<tr><td colspan="4" class="empty-state">No applications yet. Click “Add application” to get started.</td></tr>`;
  $("tableFoot").textContent = `Showing ${rows.length} of ${applications.length} matching applications`;
}
function resetForm() {
  form.reset();
  $("applicationId").value = "";
  $("appliedDate").value = dateOnly(new Date());
  $("dialogTitle").textContent = "Add application";
  $("saveBtn").textContent = "Save application";
  $("resumeStatus").textContent = "Save the application before attaching a resume.";
  $("resumeFile").value = "";
  $("formMessage").textContent = "";
}
function openNewDialog() {
  resetForm();
  dialog.showModal();
}
async function openEditDialog(id) {
  try {
    const a = await api(`/api/applications/${id}`);
    resetForm();
    $("applicationId").value = a._id;
    $("company").value = a.company || "";
    $("jobTitle").value = a.jobTitle || "";
    $("location").value = a.location || "";
    $("jobLink").value = a.jobLink || "";
    $("salary").value = a.salary || "";
    $("status").value = a.status || "Applied";
    $("appliedDate").value = dateOnly(a.appliedDate);
    $("interviewDate").value = dateOnly(a.interviewDate);
    $("followUpDate").value = dateOnly(a.followUpDate);
    $("notes").value = a.notes || "";
    $("dialogTitle").textContent = "Edit application";
    $("saveBtn").textContent = "Save changes";
    $("resumeStatus").textContent = a.resume && a.resume.filename ? `Attached: ${a.resume.originalName}` : "No resume attached. Save changes before uploading.";
    dialog.showModal();
  } catch (error) { showToast(error.message); }
}
function formPayload() {
  return {
    company: $("company").value.trim(),
    jobTitle: $("jobTitle").value.trim(),
    location: $("location").value.trim(),
    jobLink: $("jobLink").value.trim(),
    salary: $("salary").value.trim(),
    status: $("status").value,
    appliedDate: $("appliedDate").value || new Date().toISOString().slice(0, 10),
    interviewDate: $("interviewDate").value || null,
    followUpDate: $("followUpDate").value || null,
    notes: $("notes").value.trim()
  };
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  $("formMessage").textContent = "";
  const id = $("applicationId").value;
  const file = $("resumeFile").files[0];
  try {
    const saved = await api(id ? `/api/applications/${id}` : "/api/applications", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formPayload())
    });
    if (file) {
      const body = new FormData();
      body.append("resume", file);
      await api(`/api/applications/${saved._id}/resume`, { method: "POST", body });
    }
    dialog.close();
    showToast(id ? "Application updated!" : "Application saved!");
    await loadApplications();
  } catch (error) {
    $("formMessage").textContent = error.message;
  }
});
$("resumeFile").addEventListener("change", () => {
  const file = $("resumeFile").files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    $("formMessage").textContent = "Resume must be 5 MB or smaller.";
    $("resumeFile").value = "";
    return;
  }
  $("resumeStatus").textContent = `Selected: ${file.name} (will upload when you save)`;
});
$("addApplicationBtn").addEventListener("click", openNewDialog);
$("closeDialog").addEventListener("click", () => dialog.close());
$("cancelDialog").addEventListener("click", () => dialog.close());
$("navDashboard").addEventListener("click", () => {
  $("pageTitle").textContent = "Dashboard";
  $("navDashboard").classList.add("active");
  $("navApplications").classList.remove("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
});
function showAllApplications() {
  $("pageTitle").textContent = "Applications";
  $("navApplications").classList.add("active");
  $("navDashboard").classList.remove("active");
  $("searchInput").focus();
  $("applicationsSection").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("navApplications").addEventListener("click", showAllApplications);
$("viewAllBtn").addEventListener("click", showAllApplications);
$("searchInput").addEventListener("input", () => {
  clearTimeout(window.searchDebounce);
  window.searchDebounce = setTimeout(loadApplications, 250);
});
$("statusFilter").addEventListener("change", loadApplications);
document.addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit]");
  const del = event.target.closest("[data-delete]");
  if (edit) return openEditDialog(edit.dataset.edit);
  if (del) {
    const ok = window.confirm("Delete this application and its attached resume?");
    if (!ok) return;
    try {
      await api(`/api/applications/${del.dataset.delete}`, { method: "DELETE" });
      showToast("Application deleted.");
      await loadApplications();
    } catch (error) { showToast(error.message); }
  }
});

loadApplications();
