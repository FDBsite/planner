document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const toggle = document.getElementById('themeToggle');
  const newTaskButton = document.getElementById('newTaskButton');
  const signInLink = document.getElementById('signInLink');
  const logoutLink = document.getElementById('logoutLink');
  const userNameEl = document.getElementById('userName');

  const todoList = document.getElementById('todoList');
  const progressList = document.getElementById('progressList');
  const completedSection = document.getElementById('completedSection');
  const completedList = document.getElementById('completedList');
  const completedCount = document.getElementById('completedCount');

  // Modali elements
  const signinBackdrop = document.getElementById('signinBackdrop');
  const signinModal = document.getElementById('signinModal');
  const signinForm = document.getElementById('signinForm');
  const signinError = document.getElementById('signinError');

  const signupBackdrop = document.getElementById('signupBackdrop');
  const signupModal = document.getElementById('signupModal');
  const signupForm = document.getElementById('signupForm');
  const signupError = document.getElementById('signupError');
  const signupLink = document.getElementById('signupLink');

  const newTaskBackdrop = document.getElementById('newTaskBackdrop');
  const newTaskModal = document.getElementById('newTaskModal');
  const newTaskForm = document.getElementById('newTaskForm');
  const newTaskError = document.getElementById('newTaskError');
  const assignToSelect = document.getElementById('assignToSelect');
  
  const editTaskBackdrop = document.getElementById('editTaskBackdrop');
  const editTaskModal = document.getElementById('editTaskModal');
  const editTaskForm = document.getElementById('editTaskForm');
  const editTaskError = document.getElementById('editTaskError');

  let currentUserId = null;

  // Applica il tema salvato
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    body.classList.add('dark');
    toggle.textContent = '☀';
    toggle.setAttribute('aria-label', 'Attiva modalità diurna');
  } else {
    body.classList.remove('dark');
    toggle.textContent = '🌙';
    toggle.setAttribute('aria-label', 'Attiva modalità notturna');
  }

  // Toggle tema
  toggle.addEventListener('click', () => {
    const isDark = body.classList.toggle('dark');
    if (isDark) {
      toggle.textContent = '☀';
      toggle.setAttribute('aria-label', 'Attiva modalità diurna');
      localStorage.setItem('theme', 'dark');
    } else {
      toggle.textContent = '🌙';
      toggle.setAttribute('aria-label', 'Attiva modalità notturna');
      localStorage.setItem('theme', 'light');
    }
  });

  // Helpers modale
  function openModal(modal, backdrop) {
    if (!modal || !backdrop) return;
    modal.hidden = false;
    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal(modal, backdrop) {
    if (!modal || !backdrop) return;
    modal.hidden = true;
    backdrop.hidden = true;
    document.body.style.overflow = '';
  }

  // Helpers formattazione task
  function formatDate(iso) {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  function priorityInfo(p) {
    const v = (p || '').toLowerCase();
    if (v.startsWith('ba') || v === 'low') return { label: 'LOW', cls: 'low' };
    if (v.startsWith('me') || v === 'medium') return { label: 'MEDIUM', cls: 'medium' };
    if (v.startsWith('al') || v === 'high') return { label: 'HIGH', cls: 'high' };
    return { label: (p || '').toUpperCase(), cls: 'medium' };
  }
  function renderTaskCard(task) {
    const canDelete = currentUserId && task.created_by === currentUserId;

    // Helper: format date time
    const formatDateTime = (iso) => {
        if (!iso) return '';
        let datePart = iso;
        let timePart = '';
        if (iso.includes(' ')) {
            [datePart, timePart] = iso.split(' ');
        } else if (iso.includes('T')) {
            [datePart, timePart] = iso.split('T');
        }
        
        const parts = datePart.split('-');
        if (parts.length !== 3) return iso;
        const [y, m, d] = parts;
        
        let timeStr = '';
        if (timePart) {
            const [hh, mm] = timePart.split(':');
            timeStr = ` ${hh}:${mm}`;
        }
        
        return `${d}/${m}/${y}${timeStr}`;
    };

    // Helper: render comments list
    const renderCommentsList = (comments) => {
        if (!comments || comments.length === 0) return '';
        let html = '<div class="card-comments">';
        comments.forEach(c => {
            html += `<div class="card-comment-item" style="border-bottom:1px solid var(--border); padding-bottom:4px; margin-bottom:6px;">
                        <div style="font-size:0.75rem; opacity:0.7; display:flex; justify-content:space-between;">
                            <span>${c.user_name}</span>
                            <span>${formatDateTime(c.created_at)}</span>
                        </div>
                        <div style="margin-top:2px;">${c.content}</div>
                     </div>`;
        });
        html += '</div>';
        return html;
    };

    // Se completata, usa un rendering semplificato
    if (task.status === 'Completed' || task.status === 'completed') {
      const el = document.createElement('div');
      el.className = 'task-card completed';
      el.innerHTML = `
        <div class="card-header-row">
          <span class="status-badge">COMPLETATO</span>
          ${canDelete ? `<button class="delete-btn" aria-label="Elimina">🗑</button>` : ''}
        </div>
        <div class="title">${task.title}</div>
        ${task.description ? `<div class="desc-box" style="font-size:0.9rem;">${task.description}</div>` : ''}
        <div class="card-comments-container">
          ${renderCommentsList(task.comments)}
        </div>
      `;
      // Bind delete
      const delBtn = el.querySelector('.delete-btn');
      if (delBtn) delBtn.addEventListener('click', () => deleteTask(task.id, el));
      return el;
    }

    const { label, cls } = priorityInfo(task.priority);
    const due = formatDate(task.due_date || task.dueDate || '');
    const isAssignedToOther = currentUserId && task.user_id && task.user_id !== currentUserId;
    
    const el = document.createElement('div');
    el.className = 'task-card';
    if (isAssignedToOther) {
        el.classList.add('assigned-out');
    }
    
    let assignedBadge = '';
    if (isAssignedToOther && task.assigned_to_name) {
        assignedBadge = `<div class="assigned-badge">➜ ${task.assigned_to_name}</div>`;
    }

    el.innerHTML = `
      <div class="card-top">
        <span class="handle" aria-hidden="true">⠿</span>
        <span class="priority-badge ${cls}">${label}</span>
        <button class="menu-btn" aria-label="More">⋮</button>
      </div>
      ${assignedBadge}
      <div class="title">${task.title}</div>
      ${task.description ? `<div class="desc-box">${task.description}</div>` : ''}
      ${due ? `<div class="due-box"><span class="icon">📅</span><span class="date">${due}</span></div>` : ''}
      <div class="divider"></div>
      <div class="actions">
        <button class="btn sm success btn-complete" type="button">Complete</button>
        <button class="btn sm purple btn-status" type="button">Status</button>
        ${canDelete ? `<button class="btn sm danger btn-delete" type="button">Delete</button>` : ''}
        ${canDelete ? `<button class="btn sm info btn-edit" type="button">Edit</button>` : ''}
      </div>
      
      <div class="card-comments-container">
          ${renderCommentsList(task.comments)}
      </div>

      <button class="comments-toggle-btn" type="button" style="margin-top:8px; width:100%; text-align:left; background:none; border:none; color:var(--primary); cursor:pointer; padding:4px 0; font-size:0.9rem;">
        <span class="icon">💬</span> Aggiungi commento...
      </button>

      <div class="inline-comment-form" hidden style="margin-top:8px;">
         <textarea placeholder="Scrivi un commento..." style="width:100%; padding:8px; border-radius:4px; border:1px solid var(--border); min-height:60px; font-family:inherit; margin-bottom:4px;"></textarea>
         <button class="btn-send btn sm primary" type="button">Invia</button>
      </div>
    `;
    
    // Bind actions
    const btnComplete = el.querySelector('.btn-complete');
    if (btnComplete) {
      btnComplete.addEventListener('click', () => updateTaskStatus(task.id, 'Completed', el));
    }
    const btnStatus = el.querySelector('.btn-status');
    if (btnStatus) {
      btnStatus.addEventListener('click', (e) => {
        e.stopPropagation();
        // Chiudi altri menu
        document.querySelectorAll('.dropdown-menu.show').forEach(d => d.remove());
        
        // Crea menu
        const menu = document.createElement('div');
        menu.className = 'dropdown-menu show';
        
        // Opzione To Do
        const optTodo = document.createElement('div');
        optTodo.className = 'dropdown-item';
        optTodo.textContent = 'To Do';
        optTodo.onclick = () => {
             updateTaskStatus(task.id, 'To Do', el);
             menu.remove();
        };
        
        // Opzione In Progress
        const optProgress = document.createElement('div');
        optProgress.className = 'dropdown-item';
        optProgress.textContent = 'In Progress';
        optProgress.onclick = () => {
             updateTaskStatus(task.id, 'In Progress', el);
             menu.remove();
        };

        menu.appendChild(optTodo);
        menu.appendChild(optProgress);
        
        document.body.appendChild(menu);
        
        // Posiziona
        const rect = btnStatus.getBoundingClientRect();
        menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
        menu.style.left = `${rect.left + window.scrollX}px`;
        
        // Chiudi cliccando fuori
        const closeMenu = (evt) => {
            if (!menu.contains(evt.target) && evt.target !== btnStatus) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
      });
    }
    const btnDelete = el.querySelector('.btn-delete');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => deleteTask(task.id, el));
    }
    const btnEdit = el.querySelector('.btn-edit');
    if (btnEdit) {
      btnEdit.addEventListener('click', () => openEditTaskModal(task));
    }
    
    // Comments Logic
    const btnComments = el.querySelector('.comments-toggle-btn');
    const formSection = el.querySelector('.inline-comment-form');
    const commentsContainer = el.querySelector('.card-comments-container');
    const txtArea = el.querySelector('textarea');
    const btnSend = el.querySelector('.btn-send');

    if (btnComments) {
        btnComments.addEventListener('click', () => {
            formSection.hidden = !formSection.hidden;
            if (!formSection.hidden) setTimeout(() => txtArea.focus(), 100);
        });
    }

    if (btnSend) {
        btnSend.addEventListener('click', async () => {
            const content = txtArea.value.trim();
            if (!content) return;
            btnSend.disabled = true;
            btnSend.textContent = 'Invio...';
            try {
                const res = await fetch(`/api/tasks/${task.id}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content })
                });
                if (res.ok) {
                    txtArea.value = '';
                    formSection.hidden = true;
                    // Refresh comments list
                    const cRes = await fetch(`/api/tasks/${task.id}/comments`);
                    if (cRes.ok) {
                        const data = await cRes.json();
                        commentsContainer.innerHTML = renderCommentsList(data.comments);
                    }
                } else {
                    alert('Errore invio commento');
                }
            } catch (e) {
                alert('Errore di rete');
            } finally {
                btnSend.disabled = false;
                btnSend.textContent = 'Invia';
            }
        });
    }

    return el;
  }

  function openEditTaskModal(task) {
    if (!editTaskModal || !editTaskForm) return;
    
    // Popola form
    const f = editTaskForm;
    f.elements['taskId'].value = task.id;
    f.elements['title'].value = task.title;
    f.elements['description'].value = task.description || '';
    f.elements['status'].value = task.status;
    
    // Map old Italian values to new English values for the dropdown
    let p = task.priority || '';
    if (p === 'Bassa') p = 'Low';
    else if (p === 'Media') p = 'Medium';
    else if (p === 'Alta') p = 'High';
    f.elements['priority'].value = p;

    f.elements['dueDate'].value = task.due_date || task.dueDate || '';
    
    if (editTaskError) editTaskError.textContent = '';
    
    openModal(editTaskModal, editTaskBackdrop);
  }

  // Handle Edit Submit
  if (editTaskForm) editTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (editTaskError) editTaskError.textContent = '';
    
    const fd = new FormData(editTaskForm);
    const taskId = fd.get('taskId');
    const payload = {
      title: fd.get('title')?.trim(),
      description: fd.get('description')?.trim(),
      status: fd.get('status'),
      priority: fd.get('priority'),
      dueDate: fd.get('dueDate')
    };

    if (!payload.title) {
      if (editTaskError) editTaskError.textContent = 'Il titolo è obbligatorio';
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        closeModal(editTaskModal, editTaskBackdrop);
        fetchTasks();
      } else {
        const data = await res.json();
        if (editTaskError) editTaskError.textContent = data.error || 'Errore modifica task';
      }
    } catch (err) {
      if (editTaskError) editTaskError.textContent = 'Errore di rete';
    }
  });

  async function updateTaskStatus(taskId, newStatus, cardEl) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        // Ricarica le task per aggiornare l'UI correttamente
        // (alternativamente potremmo spostare l'elemento nel DOM, ma fetchTasks è più sicuro per l'ordinamento)
        fetchTasks();
      } else {
        alert('Errore aggiornamento stato');
      }
    } catch (e) {
      alert('Errore di rete');
    }
  }

  async function deleteTask(taskId, cardEl) {
    if (!confirm('Sei sicuro di voler eliminare questa task?')) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        cardEl.remove();
        // Se era completata, aggiorna contatore
        if (cardEl.classList.contains('completed')) {
          updateCompletedCount();
        }
        // Se la lista originale è vuota, gestisci placeholder
        if (todoList && todoList.children.length === 0) {
          todoList.classList.add('empty');
          todoList.textContent = 'Nessuna task';
        }
        if (progressList && progressList.children.length === 0) {
          progressList.classList.add('empty');
          progressList.textContent = 'Nessuna task';
        }
        // Se lista completata vuota, nascondi sezione
        if (completedList && completedList.children.length === 0) {
          completedSection.hidden = true;
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Errore eliminazione task');
      }
    } catch (e) {
      alert('Errore di rete');
    }
  }

  function updateCompletedCount() {
    if (completedList && completedCount) {
      const count = completedList.children.length;
      completedCount.textContent = count;
      if (count === 0) {
        completedSection.hidden = true;
        completedSection.style.display = 'none';
      } else {
        completedSection.hidden = false;
        completedSection.style.display = 'block';
      }
    }
  }

  function addTaskToColumn(task) {
    if (task.status === 'Completed' || task.status === 'completed') {
      if (!completedList) return;
      completedList.appendChild(renderTaskCard(task));
      return; // Non aggiungerla alle colonne standard
    }

    const list = task.status === 'In Progress' ? progressList : todoList;
    if (!list) return;
    if (list.classList.contains('empty')) {
      list.classList.remove('empty');
      list.textContent = '';
    }
    list.appendChild(renderTaskCard(task));
  }


  function clearTasks() {
    if (todoList) {
      todoList.classList.add('empty');
      todoList.textContent = 'Nessuna task';
    }
    if (progressList) {
      progressList.classList.add('empty');
      progressList.textContent = 'Nessuna task';
    }
    if (completedList) {
      completedList.innerHTML = '';
      completedSection.hidden = true;
      completedSection.style.display = 'none';
      if (completedCount) completedCount.textContent = '0';
    }
  }

  async function fetchTasks() {
    try {
      const res = await fetch(`/api/tasks?t=${Date.now()}`);
      const data = await res.json();
      const tasks = data.tasks || [];
      clearTasks();
      if (tasks.length > 0) {
        // Rimuove 'Nessuna task' se ci sono task
        if (todoList) todoList.textContent = '';
        if (progressList) progressList.textContent = '';
        
        // Iteriamo e aggiungiamo
        tasks.forEach(addTaskToColumn);
        
        // Se una lista è rimasta vuota, rimettiamo il placeholder
        if (todoList && todoList.children.length === 0) {
          todoList.classList.add('empty');
          todoList.textContent = 'Nessuna task';
        }
        if (progressList && progressList.children.length === 0) {
          progressList.classList.add('empty');
          progressList.textContent = 'Nessuna task';
        }

        // Aggiorna contatore completate
        updateCompletedCount();
      }
    } catch (err) {}
  }


  function setAuthUI(authenticated, fullName = '') {
    const manageUsersBtn = document.getElementById('manageUsersBtn');
    if (authenticated) {
      if (signInLink) signInLink.hidden = true;
      if (userNameEl) {
        userNameEl.textContent = fullName;
        userNameEl.hidden = false;
      }
      if (logoutLink) logoutLink.hidden = false;
      if (newTaskButton) newTaskButton.hidden = false;
      if (manageUsersBtn) manageUsersBtn.hidden = false;
    } else {
      if (signInLink) signInLink.hidden = false;
      if (userNameEl) {
        userNameEl.textContent = '';
        userNameEl.hidden = true;
      }
      if (logoutLink) logoutLink.hidden = true;
      if (newTaskButton) newTaskButton.hidden = true;
      if (manageUsersBtn) manageUsersBtn.hidden = true;
    }
  }

  // Apri modali
  if (signInLink) signInLink.addEventListener('click', (e) => { e.preventDefault(); openModal(signinModal, signinBackdrop); });
  if (signupLink) signupLink.addEventListener('click', (e) => { 
    e.preventDefault(); 
    closeModal(signinModal, signinBackdrop); 
    if (signupForm) signupForm.reset();
    if (signupError) signupError.textContent = '';
    openModal(signupModal, signupBackdrop); 
  });

  // Chiudi modali
  document.querySelectorAll('[data-close="signin"]').forEach(el => {
    el.addEventListener('click', () => closeModal(signinModal, signinBackdrop));
  });
  if (signinBackdrop) signinBackdrop.addEventListener('click', () => closeModal(signinModal, signinBackdrop));

  document.querySelectorAll('[data-close="signup"]').forEach(el => {
    el.addEventListener('click', () => closeModal(signupModal, signupBackdrop));
  });
  if (signupBackdrop) signupBackdrop.addEventListener('click', () => closeModal(signupModal, signupBackdrop));

  document.querySelectorAll('[data-close="newtask"]').forEach(el => {
    el.addEventListener('click', () => closeModal(newTaskModal, newTaskBackdrop));
  });
  if (newTaskBackdrop) newTaskBackdrop.addEventListener('click', () => closeModal(newTaskModal, newTaskBackdrop));

  document.querySelectorAll('[data-close="edittask"]').forEach(el => {
    el.addEventListener('click', () => closeModal(editTaskModal, editTaskBackdrop));
  });
  if (editTaskBackdrop) editTaskBackdrop.addEventListener('click', () => closeModal(editTaskModal, editTaskBackdrop));


  // Submit Sign Up
  if (signupForm) signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signupError.textContent = '';
    const formData = new FormData(signupForm);
    const payload = {
      fullName: formData.get('fullName')?.trim() || '',
      password: formData.get('password') || '',
      confirmPassword: formData.get('confirmPassword') || '',
    };
    if (payload.password !== payload.confirmPassword) {
      signupError.textContent = 'Le password non coincidono';
      return;
    }
    try {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        
        let data;
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          data = await res.json();
        } else {
          const text = await res.text();
          console.error('Non-JSON response:', text);
          throw new Error('Risposta server non valida: ' + (res.statusText || res.status));
        }

        if (!res.ok) {
          signupError.textContent = data.error || 'Errore di registrazione';
          return;
        }
        closeModal(signupModal, signupBackdrop);
        alert('Registrazione completata. Ora effettua il login.');
        openModal(signinModal, signinBackdrop);
      } catch (err) {
        console.error('Signup error:', err);
        signupError.textContent = err.message || 'Errore di rete';
      }
    });

  // Submit Sign In
  if (signinForm) signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    signinError.textContent = '';
    const formData = new FormData(signinForm);
    const payload = {
      fullName: formData.get('fullName')?.trim() || '',
      password: formData.get('password') || '',
    };
    try {
      const res = await fetch('/api/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        signinError.textContent = data.error || 'Errore di accesso';
        return;
      }
      closeModal(signinModal, signinBackdrop);
      currentUserId = data.user_id;
      setAuthUI(true, data.user || '');
      // Carica le task dopo il login!
      fetchTasks();
    } catch (err) {
      signinError.textContent = 'Errore di rete';
    }
  });

  // Logout
  if (logoutLink) {
    logoutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const res = await fetch('/api/signout', { method: 'POST' });
        if (!res.ok) throw new Error('Signout failed');
      } catch (err) {
        // ignore
      } finally {
        currentUserId = null;
        setAuthUI(false, '');
        clearTasks();
      }
    });
  }

  async function loadUsers() {
    if (!assignToSelect) return;
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      const users = data.users || [];
      // Svuota tranne 'Me'
      assignToSelect.innerHTML = '<option value="" selected>Me</option>';
      users.forEach(u => {
        if (currentUserId && u.id === currentUserId) return;
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = u.name;
        assignToSelect.appendChild(opt);
      });
    } catch (e) {
      console.error('Error loading users', e);
    }
  }


  // New Task Button
  if (newTaskButton) {
    newTaskButton.addEventListener('click', (e) => {
      e.preventDefault();
      loadUsers();
      openModal(newTaskModal, newTaskBackdrop);
    });
  }

  // New Task Submit
  if (newTaskForm) newTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (newTaskError) newTaskError.textContent = '';
    const fd = new FormData(newTaskForm);
    const payload = {
      title: fd.get('title')?.trim() || '',
      description: fd.get('description')?.trim() || '',
      status: fd.get('status') || 'To Do',
      priority: fd.get('priority') || '',
      dueDate: fd.get('dueDate') || '',
      assignTo: fd.get('assignTo') || ''
    };
    if (!payload.title) {

      if (newTaskError) newTaskError.textContent = 'Il nome task è obbligatorio';
      return;
    }
    if (!payload.priority) {
      if (newTaskError) newTaskError.textContent = 'Seleziona una priorità';
      return;
    }
    if (payload.status !== 'To Do') {
      if (newTaskError) newTaskError.textContent = "In questa fase è consentito solo 'To Do'";
      return;
    }
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (newTaskError) newTaskError.textContent = data.error || 'Errore creazione task';
        return;
      }
      const task = data.task;
      addTaskToColumn(task);
      closeModal(newTaskModal, newTaskBackdrop);
      newTaskForm.reset();
    } catch (err) {
      if (newTaskError) newTaskError.textContent = 'Errore di rete';
    }
  });

  // Password visibility toggles
  function bindPasswordToggles() {
    document.querySelectorAll('.password-field').forEach(wrapper => {
      const input = wrapper.querySelector('input[type="password"], input[type="text"]');
      const btn = wrapper.querySelector('.toggle-password');
      if (!input || !btn) return;
      btn.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.textContent = isPassword ? '🙈' : '👁';
        btn.setAttribute('aria-label', isPassword ? 'Nascondi password' : 'Mostra password');
      });
    });
  }
  bindPasswordToggles();

  // Check Session at startup
  async function checkSession() {
    try {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (data.authenticated) {
        currentUserId = data.user_id;
        setAuthUI(true, data.user || '');
        fetchTasks();
      } else {
        currentUserId = null;
        setAuthUI(false, '');
        clearTasks();
      }
    } catch (e) {
      currentUserId = null;
      setAuthUI(false, '');
      clearTasks();
    }
  }
  checkSession();

  // Gestione Utenti
  const manageUsersBtn = document.getElementById('manageUsersBtn');
  const usersBackdrop = document.getElementById('usersBackdrop');
  const usersModal = document.getElementById('usersModal');
  const usersList = document.getElementById('usersList');
  
  const adminAuthBackdrop = document.getElementById('adminAuthBackdrop');
  const adminAuthModal = document.getElementById('adminAuthModal');
  const adminAuthForm = document.getElementById('adminAuthForm');
  const adminAuthError = document.getElementById('adminAuthError');
  
  let userToDelete = null;

  // Close handlers
  document.querySelectorAll('[data-close="users"]').forEach(el => {
    el.addEventListener('click', () => closeModal(usersModal, usersBackdrop));
  });
  if(usersBackdrop) usersBackdrop.addEventListener('click', () => closeModal(usersModal, usersBackdrop));
  
  document.querySelectorAll('[data-close="adminAuth"]').forEach(el => {
    el.addEventListener('click', () => closeModal(adminAuthModal, adminAuthBackdrop));
  });
  if(adminAuthBackdrop) adminAuthBackdrop.addEventListener('click', () => closeModal(adminAuthModal, adminAuthBackdrop));

  // Open Users List
  if (manageUsersBtn) {
    manageUsersBtn.addEventListener('click', async () => {
      openModal(usersModal, usersBackdrop);
      await fetchAndRenderUsers();
    });
  }

  async function fetchAndRenderUsers() {
    if (!usersList) return;
    usersList.innerHTML = '<li>Caricamento...</li>';
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      const users = data.users || [];
      usersList.innerHTML = '';
      
      if (users.length === 0) {
        usersList.innerHTML = '<li>Nessun utente trovato</li>';
        return;
      }
      
      users.forEach(u => {
        const li = document.createElement('li');
        
        const info = document.createElement('span');
        info.className = 'user-info';
        info.textContent = u.name;
        if (currentUserId && u.id === currentUserId) {
            info.textContent += ' (Me)';
        }
        
        const btn = document.createElement('button');
        btn.className = 'btn-delete';
        btn.textContent = 'Elimina';
        btn.onclick = () => {
             userToDelete = u.id;
             openModal(adminAuthModal, adminAuthBackdrop);
             if (adminAuthError) adminAuthError.textContent = '';
             adminAuthForm.reset();
        };
        
        li.appendChild(info);
        li.appendChild(btn);
        usersList.appendChild(li);
      });
      
    } catch (e) {
      usersList.innerHTML = '<li>Errore caricamento utenti</li>';
    }
  }

  // Submit Admin Auth
  if (adminAuthForm) {
      adminAuthForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!userToDelete) return;
          
          const fd = new FormData(adminAuthForm);
          const password = fd.get('adminPassword');
          
          try {
              const res = await fetch(`/api/users/${userToDelete}`, {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password })
              });
              const data = await res.json();
              
              if (!res.ok) {
                  if (adminAuthError) adminAuthError.textContent = data.error || 'Errore durante l\'eliminazione';
                  return;
              }
              
              // Success
              closeModal(adminAuthModal, adminAuthBackdrop);
              userToDelete = null;
              fetchAndRenderUsers(); // Reload list
              // Se abbiamo cancellato noi stessi, logout?
              // Per ora no, gestiamo solo cancellazione.
              
          } catch (err) {
              if (adminAuthError) adminAuthError.textContent = 'Errore di rete';
          }
      });
  }

});
