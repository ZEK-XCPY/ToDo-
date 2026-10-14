import { useCallback, useEffect, useMemo, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...options,
  });

  if (response.status === 204) return null;

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || 'Something went wrong. Please try again.');
    error.status = response.status;
    throw error;
  }
  return result;
}

function dateInputValue(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

function dueDateLabel(value) {
  if (!value) return '';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function greetingName(username = '') {
  return username.charAt(0).toUpperCase() + username.slice(1);
}

function AuthScreen({ onAuthenticated, initialMessage }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialMessage || '');
  const isSignup = mode === 'signup';

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await api(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      onAuthenticated(result.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <a className="brand brand-centered" href="#" aria-label="Daymark home">
          <span className="brand-mark">d</span>
          <span>daymark</span>
        </a>
        <p className="eyebrow auth-eyebrow">A little more focus, every day</p>
        <h1>{isSignup ? 'Make space for what matters.' : 'Welcome back.'}</h1>
        <p className="auth-copy">
          {isSignup
            ? 'Create an account to keep your tasks safe and close at hand.'
            : 'Sign in to pick up right where you left off.'}
        </p>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            autoComplete="username"
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9._-]+"
            placeholder="e.g. alex.morgan"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            minLength={8}
            maxLength={128}
            placeholder="At least 8 characters"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
            {!busy && <span aria-hidden="true">→</span>}
          </button>
        </form>
        <p className="auth-switch">
          {isSignup ? 'Already have an account?' : 'New to Daymark?'}
          <button
            type="button"
            onClick={() => {
              setMode(isSignup ? 'login' : 'signup');
              setError('');
            }}
          >
            {isSignup ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </section>
      <p className="auth-footnote">Simple plans. Quieter days.</p>
    </main>
  );
}

function TaskForm({ task, onClose, onSave }) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(dateInputValue(task?.dueDate));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        priority,
        dueDate: dueDate || null,
      });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-form-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{task ? 'A small adjustment' : 'One thing at a time'}</p>
            <h2 id="task-form-title">{task ? 'Edit task' : 'Add a task'}</h2>
          </div>
          <button className="icon-button close-button" type="button" onClick={onClose} aria-label="Close form">×</button>
        </div>
        <form className="task-form" onSubmit={submit}>
          <label htmlFor="task-title">Task name <span className="required-mark">*</span></label>
          <input
            id="task-title"
            autoFocus
            maxLength={200}
            placeholder="What needs to get done?"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <label htmlFor="task-description">A little detail <span className="optional-label">Optional</span></label>
          <textarea
            id="task-description"
            rows={3}
            maxLength={2000}
            placeholder="Add a note or some context…"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="form-row">
            <div>
              <label htmlFor="task-priority">Priority</label>
              <select id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label htmlFor="task-due-date">Due date <span className="optional-label">Optional</span></label>
              <input id="task-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button className="button button-quiet" type="button" onClick={onClose}>Cancel</button>
            <button className="button button-primary" type="submit" disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : task ? 'Save changes' : 'Add task'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TaskRow({ task, index, total, canReorder, onToggle, onEdit, onDelete, onMove }) {
  const [deleting, setDeleting] = useState(false);
  async function remove() {
    if (!window.confirm(`Delete "${task.title}"? This can’t be undone.`)) return;
    setDeleting(true);
    try {
      await onDelete(task.id);
    } catch {
      setDeleting(false);
    }
  }

  const isOverdue = task.dueDate && !task.completed
    && new Date(`${task.dueDate.slice(0, 10)}T23:59:59`) < new Date();

  return (
    <article className={`task-row${task.completed ? ' is-complete' : ''}`}>
      <button
        className={`task-check${task.completed ? ' checked' : ''}`}
        type="button"
        aria-label={task.completed ? `Mark ${task.title} active` : `Mark ${task.title} complete`}
        onClick={() => onToggle(task)}
      >
        {task.completed && <span aria-hidden="true">✓</span>}
      </button>
      <div className="task-content">
        <button className="task-title" type="button" onClick={() => onEdit(task)}>{task.title}</button>
        {task.description && <p className="task-description">{task.description}</p>}
        <div className="task-meta">
          <span className={`priority-pill priority-${task.priority}`}>
            <span className="priority-dot" />{task.priority}
          </span>
          {task.dueDate && (
            <span className={`due-label${isOverdue ? ' overdue' : ''}`}>
              <span aria-hidden="true">◷</span> {isOverdue ? 'Overdue · ' : ''}{dueDateLabel(task.dueDate)}
            </span>
          )}
        </div>
      </div>
      <div className="task-actions">
        {canReorder && (
          <div className="reorder-buttons" aria-label="Reorder task">
            <button className="icon-button" type="button" aria-label="Move task up" disabled={index === 0} onClick={() => onMove(index, -1)}>↑</button>
            <button className="icon-button" type="button" aria-label="Move task down" disabled={index === total - 1} onClick={() => onMove(index, 1)}>↓</button>
          </div>
        )}
        <button className="icon-button task-action" type="button" aria-label={`Edit ${task.title}`} onClick={() => onEdit(task)}>✎</button>
        <button className="icon-button task-action delete-action" type="button" aria-label={`Delete ${task.title}`} onClick={remove} disabled={deleting}>
          {deleting ? '…' : '×'}
        </button>
      </div>
    </article>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [todos, setTodos] = useState([]);
  const [counts, setCounts] = useState({ all: 0, active: 0, completed: 0 });
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [sort, setSort] = useState('manual');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loadingTodos, setLoadingTodos] = useState(false);
  const [notice, setNotice] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    api('/auth/me')
      .then((result) => {
        if (active) setUser(result.user);
      })
      .catch((error) => {
        if (active && error.status !== 401) setSessionError(error.message);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;
    const params = new URLSearchParams({ status, priority, q: search, sort });
    setLoadingTodos(true);
    api(`/todos?${params}`)
      .then((result) => {
        if (!active) return;
        setTodos(result.todos);
        setCounts(result.counts);
      })
      .catch((error) => {
        if (!active) return;
        setNotice(error.message);
        if (error.status === 401) setUser(null);
      })
      .finally(() => {
        if (active) setLoadingTodos(false);
      });
    return () => { active = false; };
  }, [user, status, priority, search, sort, refresh]);

  const visibleLabel = useMemo(() => ({
    all: 'All tasks',
    active: 'In progress',
    completed: 'Completed',
  }[status]), [status]);

  const canReorder = sort === 'manual' && status === 'all' && priority === 'all' && !search;

  const showNotice = useCallback((message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4500);
  }, []);

  async function saveTask(values) {
    if (editingTask) {
      await api(`/todos/${editingTask.id}`, { method: 'PATCH', body: JSON.stringify(values) });
      showNotice('Task updated.');
    } else {
      await api('/todos', { method: 'POST', body: JSON.stringify(values) });
      showNotice('Task added to your list.');
    }
    setShowTaskForm(false);
    setEditingTask(null);
    setRefresh((value) => value + 1);
  }

  async function toggleTask(task) {
    try {
      await api(`/todos/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !task.completed }),
      });
      setRefresh((value) => value + 1);
    } catch (error) {
      showNotice(error.message);
    }
  }

  async function deleteTask(id) {
    try {
      await api(`/todos/${id}`, { method: 'DELETE' });
      showNotice('Task deleted.');
      setRefresh((value) => value + 1);
    } catch (error) {
      showNotice(error.message);
      throw error;
    }
  }

  async function moveTask(index, direction) {
    const reordered = [...todos];
    const nextIndex = index + direction;
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setTodos(reordered);
    try {
      await api('/todos/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ ids: reordered.map((task) => task.id) }),
      });
      setRefresh((value) => value + 1);
    } catch (error) {
      showNotice(error.message);
      setRefresh((value) => value + 1);
    }
  }

  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      setTodos([]);
      showNotice('You’re signed out.');
    } catch (error) {
      showNotice(error.message);
    }
  }

  if (checkingSession) {
    return <main className="loading-screen"><span className="brand-mark">d</span><p>Getting things ready…</p></main>;
  }
  if (!user) return <AuthScreen onAuthenticated={setUser} initialMessage={sessionError} />;

  const completedToday = todos.filter((task) => task.completed).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Daymark home">
          <span className="brand-mark">d</span>
          <span>daymark</span>
        </a>
        <div className="workspace-label">YOUR SPACE</div>
        <nav className="main-nav" aria-label="Task views">
          {[
            { key: 'all', label: 'All tasks', icon: '▤', count: counts.all },
            { key: 'active', label: 'In progress', icon: '◷', count: counts.active },
            { key: 'completed', label: 'Completed', icon: '✓', count: counts.completed },
          ].map((item) => (
            <button
              className={`nav-item${status === item.key ? ' selected' : ''}`}
              key={item.key}
              type="button"
              onClick={() => setStatus(item.key)}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              <span className="nav-count">{item.count}</span>
            </button>
          ))}
        </nav>
        <button className="sidebar-add" type="button" onClick={() => { setEditingTask(null); setShowTaskForm(true); }}>
          <span aria-hidden="true">＋</span> Add a task
        </button>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-spark" aria-hidden="true">✳</span>
            <p>Small steps still move you forward.</p>
          </div>
          <div className="profile">
            <span className="avatar">{user.username.charAt(0).toUpperCase()}</span>
            <span className="profile-name">{user.username}</span>
            <button className="icon-button profile-menu" type="button" aria-label="Sign out" title="Sign out" onClick={logout}>↗</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">d</span><span>daymark</span></div>
          <div className="breadcrumb">My tasks <span>/</span> <strong>{visibleLabel}</strong></div>
          <button className="mobile-logout" type="button" onClick={logout}>Sign out</button>
          <div className="today-label"><span className="today-dot" /> Your personal space</div>
        </header>

        <section className="task-page">
          <div className="page-intro">
            <div>
              <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              <h1>{status === 'all' ? `A good day to begin, ${greetingName(user.username)}.` : visibleLabel}</h1>
              <p className="page-subtitle">
                {counts.active === 0
                  ? 'You’re all caught up. Enjoy the breathing room.'
                  : `You have ${counts.active} ${counts.active === 1 ? 'thing' : 'things'} to take care of.`}
              </p>
            </div>
            <button className="button button-primary add-task-button" type="button" onClick={() => { setEditingTask(null); setShowTaskForm(true); }}>
              <span aria-hidden="true">＋</span> New task
            </button>
          </div>

          <section className="summary-card" aria-label="Task overview">
            <div className="summary-item">
              <span className="summary-icon open-icon" aria-hidden="true">◷</span>
              <div><span className="summary-number">{counts.active}</span><span className="summary-label">to do</span></div>
            </div>
            <span className="summary-divider" />
            <div className="summary-item">
              <span className="summary-icon done-icon" aria-hidden="true">✓</span>
              <div><span className="summary-number">{counts.completed}</span><span className="summary-label">completed</span></div>
            </div>
            <div className="summary-message">
              <span aria-hidden="true">✳</span>
              {completedToday > 0 ? `${completedToday} task${completedToday === 1 ? '' : 's'} completed in this view` : 'Make a little progress, at your own pace.'}
            </div>
          </section>

          <div className="list-toolbar">
            <div>
              <h2>{visibleLabel} <span className="list-total">{counts[status]}</span></h2>
              <p>Keep your next steps close.</p>
            </div>
            <div className="toolbar-controls">
              <label className="search-box">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={searchInput}
                  maxLength={200}
                  placeholder="Search tasks"
                  aria-label="Search tasks"
                  onChange={(event) => setSearchInput(event.target.value)}
                />
              </label>
              <label className="select-control">
                <span className="sr-only">Filter by priority</span>
                <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                  <option value="all">All priorities</option>
                  <option value="high">High priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="low">Low priority</option>
                </select>
              </label>
              <label className="select-control sort-control">
                <span className="sr-only">Sort tasks</span>
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="manual">My order</option>
                  <option value="created-desc">Newest first</option>
                  <option value="created">Oldest first</option>
                  <option value="dueDate">Due date</option>
                  <option value="priority">Priority</option>
                </select>
              </label>
            </div>
          </div>

          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button className="icon-button" type="button" aria-label="Dismiss message" onClick={() => setNotice('')}>×</button>
            </div>
          )}

          <section className="task-list" aria-label={visibleLabel}>
            {loadingTodos && todos.length === 0 ? (
              <div className="list-placeholder"><span className="loading-spinner" /> Loading your tasks…</div>
            ) : todos.length > 0 ? (
              todos.map((task, index) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  index={index}
                  total={todos.length}
                  canReorder={canReorder}
                  onToggle={toggleTask}
                  onEdit={(selectedTask) => { setEditingTask(selectedTask); setShowTaskForm(true); }}
                  onDelete={deleteTask}
                  onMove={moveTask}
                />
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-illustration" aria-hidden="true">
                  <span className="empty-sun">✳</span>
                  <span className="empty-paper"><i /><i /><i /></span>
                  <span className="empty-leaf">⌁</span>
                </div>
                <h3>{search ? 'Nothing matched that search.' : status === 'completed' ? 'Nothing checked off just yet.' : status === 'active' ? 'You’ve cleared the list.' : 'A fresh page.'}</h3>
                <p>{search ? 'Try another word, or clear your search.' : status === 'completed' ? 'When you finish a task, it’ll find a home here.' : 'Add your first task and give your day a little shape.'}</p>
                {search ? (
                  <button className="button button-quiet" type="button" onClick={() => setSearchInput('')}>Clear search</button>
                ) : status !== 'completed' && (
                  <button className="button button-primary" type="button" onClick={() => { setEditingTask(null); setShowTaskForm(true); }}>
                    <span aria-hidden="true">＋</span> Add your first task
                  </button>
                )}
              </div>
            )}
          </section>
          {canReorder && todos.length > 1 && <p className="reorder-hint">Use the arrows to arrange tasks in your own order.</p>}
          <footer className="page-footer">One step at a time <span aria-hidden="true">·</span> You’re doing just fine.</footer>
        </section>
      </main>

      {showTaskForm && (
        <TaskForm
          task={editingTask}
          onClose={() => { setShowTaskForm(false); setEditingTask(null); }}
          onSave={saveTask}
        />
      )}
    </div>
  );
}

export default App;
