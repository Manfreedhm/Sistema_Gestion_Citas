// frontend/js/dashboard.js

// Estado global de la sesión
const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user')) || null
};

// Renderizar Vistas según Rol
function renderDashboard() {
  const container = document.getElementById('dashboard-app');
  if (!container || !state.token) return;

  container.innerHTML = `
    <div class="flex h-screen bg-slate-100">
      <!-- Sidebar -->
      <aside class="w-64 bg-slate-900 text-white flex flex-col p-4 space-y-2">
        <h2 class="text-xl font-bold p-2 border-b border-slate-700">Panel Control</h2>
        <span class="text-xs text-indigo-400 font-semibold uppercase px-2">${state.user.role}</span>
        
        <nav class="flex-1 space-y-1 mt-4">
          <button onclick="loadSection('citas')" class="w-full text-left px-3 py-2 rounded hover:bg-slate-800"><i class="fa-solid fa-calendar-check mr-2"></i> Citas & Calendario</button>
          <button onclick="loadSection('pacientes')" class="w-full text-left px-3 py-2 rounded hover:bg-slate-800"><i class="fa-solid fa-user-group mr-2"></i> Pacientes</button>
          ${state.user.role !== 'PROFESIONAL' ? `
            <button onclick="loadSection('caja')" class="w-full text-left px-3 py-2 rounded hover:bg-slate-800"><i class="fa-solid fa-cash-register mr-2"></i> Caja Diaria</button>
            <button onclick="loadSection('pagos')" class="w-full text-left px-3 py-2 rounded hover:bg-slate-800"><i class="fa-solid fa-receipt mr-2"></i> Pagos</button>
          ` : ''}
          ${state.user.role === 'ADMINISTRADOR' ? `
            <button onclick="loadSection('servicios')" class="w-full text-left px-3 py-2 rounded hover:bg-slate-800"><i class="fa-solid fa-hand-holding-medical mr-2"></i> Servicios</button>
            <button onclick="loadSection('usuarios')" class="w-full text-left px-3 py-2 rounded hover:bg-slate-800"><i class="fa-solid fa-users-gear mr-2"></i> Usuarios</button>
          ` : ''}
        </nav>

        <button onclick="logout()" class="bg-red-600 hover:bg-red-700 text-white p-2 rounded text-center w-full font-bold">
          Cerrar Sesión
        </button>
      </aside>

      <!-- Main Content Container -->
      <main id="main-content" class="flex-1 overflow-y-auto p-8">
        <h1 class="text-2xl font-bold">Bienvenido/a, ${state.user.name}</h1>
        <p class="text-slate-500">Selecciona una opción del menú lateral para gestionar la información.</p>
      </main>
    </div>
  `;
}

function loadSection(section) {
  const content = document.getElementById('main-content');
  if (section === 'caja') {
    content.innerHTML = `
      <h2 class="text-2xl font-bold mb-6">Módulo de Caja Diaria (RF-11)</h2>
      <div class="grid md:grid-cols-2 gap-6">
        <div class="bg-white p-6 rounded-xl shadow-sm border">
          <h3 class="font-bold text-lg mb-4">Apertura de Caja</h3>
          <form id="open-register-form" onsubmit="handleOpenRegister(event)" class="space-y-4">
            <div>
              <label class="block text-sm font-medium">Monto Inicial (Q)</label>
              <input type="number" step="0.01" id="initial-amount" required class="w-full border rounded p-2">
            </div>
            <button type="submit" class="bg-emerald-600 text-white px-4 py-2 rounded font-bold w-full">Abrir Caja</button>
          </form>
        </div>

        <div class="bg-white p-6 rounded-xl shadow-sm border">
          <h3 class="font-bold text-lg mb-4">Cierre de Caja</h3>
          <form id="close-register-form" onsubmit="handleCloseRegister(event)" class="space-y-4">
            <div>
              <label class="block text-sm font-medium">Efectivo Contado al Cierre (Q)</label>
              <input type="number" step="0.01" id="counted-cash" required class="w-full border rounded p-2">
            </div>
            <button type="submit" class="bg-slate-900 text-white px-4 py-2 rounded font-bold w-full">Calcular y Cerrar Caja</button>
          </form>
        </div>
      </div>
    `;
  }
}

function logout() {
  localStorage.clear();
  window.location.reload();
}